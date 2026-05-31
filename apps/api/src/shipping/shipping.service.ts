import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, ShipmentStatus, prisma } from '@omniseller/db';
import { Queue } from 'bullmq';
import { AddressDto } from './dto/address.dto';
import { CreateShippingRatesDto } from './dto/create-shipping-rates.dto';
import { PurchaseLabelDto } from './dto/purchase-label.dto';
import { EasyPostClient } from './providers/easypost.client';
import { SHIPPING_PROVIDER, SHIPPING_SYNC_JOB, SHIPPING_SYNC_QUEUE } from './shipping.constants';
import { isShippingConfigurationError } from './shipping-workflow-state';
import { ownsRecord, resolveUserId } from '../common/user-context';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly easyPostClient: EasyPostClient,
    @InjectQueue(SHIPPING_SYNC_QUEUE)
    private readonly shippingSyncQueue: Queue,
  ) {}

  getAvailabilitySummary() {
    const providerConfigured = this.easyPostClient.isConfigured();
    const defaultShipFromConfigured = Boolean(this.configService.get<string>('DEFAULT_SHIP_FROM_STREET1'));

    if (!providerConfigured) {
      return {
        provider: SHIPPING_PROVIDER,
        providerConfigured: false,
        defaultShipFromConfigured,
        canRequestRates: false,
        canPurchaseLabels: false,
        blockedReason:
          'Shipping is unavailable in this environment. Set EASYPOST_API_KEY to enable rates and label purchase.',
      };
    }

    if (!defaultShipFromConfigured) {
      return {
        provider: SHIPPING_PROVIDER,
        providerConfigured: true,
        defaultShipFromConfigured: false,
        canRequestRates: false,
        canPurchaseLabels: true,
        blockedReason:
          'Shipping defaults are incomplete. Set DEFAULT_SHIP_FROM_* environment variables before requesting rates.',
      };
    }

    return {
      provider: SHIPPING_PROVIDER,
      providerConfigured: true,
      defaultShipFromConfigured: true,
      canRequestRates: true,
      canPurchaseLabels: true,
      blockedReason: null,
    };
  }

  async getShipmentsForOrder(orderId: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    await this.requireOrderForUser(orderId, ownerId);

    return prisma.shipment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async previewRates(dto: CreateShippingRatesDto, userId?: string) {
    const ownerId = resolveUserId(userId);
    const availability = this.getAvailabilitySummary();

    if (!availability.canRequestRates) {
      throw new ServiceUnavailableException(availability.blockedReason);
    }

    const order = await this.requireOrderForUser(dto.orderId, ownerId);

    if (!Array.isArray(dto.parcels) || dto.parcels.length === 0) {
      throw new BadRequestException('At least one parcel is required');
    }

    const shipTo = dto.shipTo ?? this.resolveShipToAddress(order);
    const shipFrom = dto.shipFrom ?? this.resolveDefaultShipFrom();

    const providerShipment = await this.easyPostClient.createShipment({
      from: shipFrom,
      to: shipTo,
      parcels: dto.parcels,
      reference: dto.reference ?? `order:${dto.orderId}`,
    });

    const rates = (providerShipment.rates ?? []).map((rate: any) => ({
      rateId: rate.id,
      provider: SHIPPING_PROVIDER,
      carrier: rate.carrier,
      service: rate.service,
      rate: rate.rate,
      currency: rate.currency,
      deliveryDays: rate.delivery_days,
      deliveryDateGuaranteed: rate.delivery_date_guaranteed,
      estDeliveryDate: rate.est_delivery_date,
    }));

    return {
      provider: SHIPPING_PROVIDER,
      providerShipmentId: providerShipment.id,
      orderId: dto.orderId,
      rates,
    };
  }

  async purchaseLabel(dto: PurchaseLabelDto, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const order = await this.requireOrderForUser(dto.orderId, ownerId);

    const existing = await prisma.shipment.findFirst({
      where: {
        orderId: dto.orderId,
        providerShipmentId: dto.providerShipmentId,
        providerRateId: dto.rateId,
        status: {
          in: [
            ShipmentStatus.LABEL_PURCHASED,
            ShipmentStatus.SYNC_QUEUED,
            ShipmentStatus.SYNCED_TO_MARKETPLACE,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      this.logger.log(`Reusing existing shipment ${existing.id} for order ${dto.orderId}`);
      return existing;
    }

    const pendingShipment = await this.createOrResetPendingShipment(
      dto.orderId,
      dto.providerShipmentId,
      dto.rateId,
    );

    let bought: Awaited<ReturnType<EasyPostClient['buyShipment']>>;

    try {
      bought = await this.easyPostClient.buyShipment(
        dto.providerShipmentId,
        dto.rateId,
        dto.labelFormat,
      );
    } catch (error) {
      await prisma.shipment.update({
        where: { id: pendingShipment.id },
        data: {
          status: ShipmentStatus.ERROR,
          metadata: this.mergeMetadata(pendingShipment.metadata, {
            purchase: {
              state: this.isConfigurationError(error) ? 'UNAVAILABLE' : 'FAILED',
              failedAt: new Date().toISOString(),
              recoverable: true,
              message: error instanceof Error ? error.message : 'Unknown carrier purchase error',
            },
            lastError: {
              stage: 'purchase',
              message: error instanceof Error ? error.message : 'Unknown carrier purchase error',
              recordedAt: new Date().toISOString(),
              recoverable: true,
            },
          }),
        },
      });

      throw error;
    }

    const selectedRate = bought.selected_rate;
    const tracker = bought.tracker;
    const postageLabel = bought.postage_label;

    if (!selectedRate || !tracker || !postageLabel) {
      throw new InternalServerErrorException('Carrier did not return a complete purchased shipment payload');
    }

    const targetStatus =
      order.marketplaceAccount?.kind?.toLowerCase() === 'ebay'
        ? ShipmentStatus.SYNC_QUEUED
        : ShipmentStatus.LABEL_PURCHASED;

    let shipment = await prisma.shipment.update({
      where: { id: pendingShipment.id },
      data: {
        provider: SHIPPING_PROVIDER,
        status: targetStatus,
        providerShipmentId: bought.id,
        providerRateId: selectedRate.id,
        providerTrackerId: tracker.id,
        carrier: selectedRate.carrier,
        service: selectedRate.service,
        trackingCode: tracker.tracking_code,
        trackingStatus: tracker.status,
        labelUrl:
          postageLabel.label_url ??
          postageLabel.label_pdf_url ??
          postageLabel.label_zpl_url ??
          null,
        labelFormat: dto.labelFormat ?? this.detectLabelFormat(postageLabel) ?? 'PDF',
        rateAmount: selectedRate.rate ? Number(selectedRate.rate) : null,
        rateCurrency: selectedRate.currency ?? 'USD',
        parcelLength: this.readDecimal(bought.parcel?.length),
        parcelWidth: this.readDecimal(bought.parcel?.width),
        parcelHeight: this.readDecimal(bought.parcel?.height),
        parcelWeightOz: this.readDecimal(bought.parcel?.weight),
        purchasedAt: new Date(),
        metadata: this.mergeMetadata(pendingShipment.metadata, {
          purchase: {
            state: 'SUCCEEDED',
            purchasedAt: new Date().toISOString(),
          },
          marketplaceSync:
            targetStatus === ShipmentStatus.SYNC_QUEUED
              ? {
                  state: 'QUEUED',
                  queuedAt: new Date().toISOString(),
                }
              : {
                  state: 'NOT_REQUIRED',
                },
          providerResponse: {
            shipmentId: bought.id,
            fees: bought.fees ?? [],
            messages: bought.messages ?? [],
          },
          lastError: null,
        }),
      },
    });

    if (shipment.status === ShipmentStatus.SYNC_QUEUED) {
      try {
        await this.shippingSyncQueue.add(
          SHIPPING_SYNC_JOB,
          { shipmentId: shipment.id },
          {
            jobId: `shipment-sync:${shipment.id}`,
            attempts: 6,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to enqueue marketplace sync for shipment ${shipment.id}`,
          error instanceof Error ? error.stack : undefined,
        );

        shipment = await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: ShipmentStatus.LABEL_PURCHASED,
            metadata: this.mergeMetadata(shipment.metadata, {
              marketplaceSync: {
                state: 'QUEUE_FAILED',
                failedAt: new Date().toISOString(),
                recoverable: true,
                message: error instanceof Error ? error.message : 'Unknown queue failure',
              },
              lastError: {
                stage: 'queue',
                message: error instanceof Error ? error.message : 'Unknown queue failure',
                recordedAt: new Date().toISOString(),
                recoverable: true,
              },
            }),
          },
        });
      }
    }

    return shipment;
  }

  async voidLabel(shipmentId: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          include: {
            marketplaceAccount: true,
          },
        },
      },
    });

    if (!shipment || !shipment.order || !ownsRecord(shipment.order.marketplaceAccount?.userId, ownerId)) {
      throw new BadRequestException(`Shipment ${shipmentId} not found`);
    }

    if (!shipment.providerShipmentId) {
      throw new BadRequestException(`Shipment ${shipmentId} is missing providerShipmentId`);
    }

    if (shipment.status === ShipmentStatus.VOIDED) {
      return shipment;
    }

    if (!shipment.purchasedAt) {
      throw new BadRequestException(`Shipment ${shipmentId} has not been purchased`);
    }

    try {
      await this.easyPostClient.refundShipment(shipment.providerShipmentId);
    } catch (error) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          metadata: this.mergeMetadata(shipment.metadata, {
            void: {
              state: this.isConfigurationError(error) ? 'UNAVAILABLE' : 'FAILED',
              failedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : 'Unknown refund failure',
            },
            lastError: {
              stage: 'void',
              message: error instanceof Error ? error.message : 'Unknown refund failure',
              recordedAt: new Date().toISOString(),
              recoverable: true,
            },
          }),
        },
      });

      throw error;
    }

    return prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.VOIDED,
        voidedAt: new Date(),
        metadata: this.mergeMetadata(shipment.metadata, {
          void: {
            state: 'SUCCEEDED',
            voidedAt: new Date().toISOString(),
          },
          lastError: null,
        }),
      },
    });
  }

  private async createOrResetPendingShipment(
    orderId: string,
    providerShipmentId: string,
    rateId: string,
  ) {
    const existing = await prisma.shipment.findFirst({
      where: {
        orderId,
        providerShipmentId,
        providerRateId: rateId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return prisma.shipment.update({
        where: { id: existing.id },
        data: {
          status: ShipmentStatus.PENDING,
          metadata: this.mergeMetadata(existing.metadata, {
            purchase: {
              state: 'IN_PROGRESS',
              requestedAt: new Date().toISOString(),
            },
          }),
        },
      });
    }

    return prisma.shipment.create({
      data: {
        orderId,
        provider: SHIPPING_PROVIDER,
        status: ShipmentStatus.PENDING,
        providerShipmentId,
        providerRateId: rateId,
        metadata: {
          purchase: {
            state: 'IN_PROGRESS',
            requestedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  private async requireOrderForUser(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        marketplaceAccount: true,
      },
    });

    if (!order || !ownsRecord(order.marketplaceAccount?.userId, userId)) {
      throw new BadRequestException(`Order ${orderId} not found`);
    }

    return order;
  }

  private resolveDefaultShipFrom(): AddressDto {
    const street1 = this.configService.get<string>('DEFAULT_SHIP_FROM_STREET1');

    if (!street1) {
      throw new BadRequestException(
        'No shipFrom provided and DEFAULT_SHIP_FROM_* env variables are not configured',
      );
    }

    return {
      name: this.configService.get<string>('DEFAULT_SHIP_FROM_NAME') ?? 'OmniSeller',
      company: this.configService.get<string>('DEFAULT_SHIP_FROM_COMPANY') ?? undefined,
      street1,
      street2: this.configService.get<string>('DEFAULT_SHIP_FROM_STREET2') ?? undefined,
      city: this.configService.get<string>('DEFAULT_SHIP_FROM_CITY') ?? '',
      state: this.configService.get<string>('DEFAULT_SHIP_FROM_STATE') ?? '',
      zip: this.configService.get<string>('DEFAULT_SHIP_FROM_ZIP') ?? '',
      country: this.configService.get<string>('DEFAULT_SHIP_FROM_COUNTRY') ?? 'US',
      phone: this.configService.get<string>('DEFAULT_SHIP_FROM_PHONE') ?? undefined,
    };
  }

  private resolveShipToAddress(order: {
    id: string;
    buyerName?: string | null;
    buyerPhone?: string | null;
    buyerEmail?: string | null;
    buyerAddress?: unknown;
    shippingName?: string | null;
    shippingCompany?: string | null;
    shippingAddress1?: string | null;
    shippingAddress2?: string | null;
    shippingCity?: string | null;
    shippingState?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
  }): AddressDto {
    const buyerAddress = this.readAddressJson(order.buyerAddress);

    const street1 = order.shippingAddress1 ?? buyerAddress.street1;
    const city = order.shippingCity ?? buyerAddress.city;
    const state = order.shippingState ?? buyerAddress.state;
    const zip = order.shippingPostalCode ?? buyerAddress.zip;
    const country = order.shippingCountry ?? buyerAddress.country ?? 'US';

    if (!street1 || !city || !state || !zip) {
      throw new BadRequestException(`Order ${order.id} is missing destination shipping fields`);
    }

    return {
      name: order.shippingName ?? order.buyerName ?? buyerAddress.name ?? 'Customer',
      company: order.shippingCompany ?? buyerAddress.company ?? undefined,
      street1,
      street2: order.shippingAddress2 ?? buyerAddress.street2 ?? undefined,
      city,
      state,
      zip,
      country,
      phone: order.buyerPhone ?? buyerAddress.phone ?? undefined,
      email: order.buyerEmail ?? buyerAddress.email ?? undefined,
    };
  }

  private detectLabelFormat(postageLabel: any): string | null {
    if (postageLabel.label_zpl_url) return 'ZPL';
    if (postageLabel.label_pdf_url || postageLabel.label_url) return 'PDF';
    return null;
  }

  private readDecimal(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private readAddressJson(value: unknown): Partial<AddressDto> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const data = value as Record<string, unknown>;

    return {
      name: this.asString(data.name),
      company: this.asString(data.company),
      street1: this.asString(data.street1),
      street2: this.asString(data.street2),
      city: this.asString(data.city),
      state: this.asString(data.state),
      zip: this.asString(data.zip),
      country: this.asString(data.country),
      phone: this.asString(data.phone),
      email: this.asString(data.email),
    };
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private mergeMetadata(current: unknown, extra: Record<string, unknown>): Prisma.JsonObject {
    const base =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Prisma.JsonObject)
        : {};

    return {
      ...base,
      ...extra,
    } as Prisma.JsonObject;
  }

  private isConfigurationError(error: unknown) {
    if (error instanceof ServiceUnavailableException) {
      return true;
    }

    return isShippingConfigurationError(error instanceof Error ? error.message : null);
  }
}
