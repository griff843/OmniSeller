import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount, Prisma, ShipmentStatus, prisma } from '@omniseller/db';
import fetch from 'node-fetch';

@Injectable()
export class EbayFulfillmentSyncService {
  private readonly logger = new Logger(EbayFulfillmentSyncService.name);

  constructor(private readonly configService: ConfigService) {}

  async syncTrackingForShipment(shipmentId: string): Promise<void> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        order: {
          include: {
            marketplaceAccount: true,
            items: {
              include: {
                listing: true,
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new BadRequestException(`Shipment ${shipmentId} not found`);
    }

    const marketplaceAccount = shipment.order.marketplaceAccount;
    if (!marketplaceAccount) {
      throw new BadRequestException(`Order ${shipment.orderId} has no marketplace account`);
    }

    if (marketplaceAccount.kind.toLowerCase() !== 'ebay') {
      this.logger.log(
        `Skipping shipment ${shipmentId}; marketplace account kind is ${marketplaceAccount.kind}`,
      );
      return;
    }

    if (!shipment.trackingCode) {
      throw new BadRequestException(`Shipment ${shipmentId} is missing trackingCode`);
    }

    const lineItems = shipment.order.items
      .map((item) => ({
        lineItemId: item.marketplaceLineItemId ?? item.listing?.marketplaceItemId ?? null,
        quantity: item.quantity ?? 1,
      }))
      .filter(
        (item): item is { lineItemId: string; quantity: number } =>
          typeof item.lineItemId === 'string' && item.lineItemId.length > 0,
      );

    if (lineItems.length === 0) {
      throw new BadRequestException(
        `Order ${shipment.orderId} is missing marketplace line item identifiers`,
      );
    }

    const accessToken = await this.getValidEbayAccessToken(marketplaceAccount);
    const baseUrl = this.configService.get<string>('EBAY_API_BASE') ?? 'https://api.ebay.com';

    const response = await fetch(
      `${baseUrl}/sell/fulfillment/v1/order/${shipment.order.marketplaceOrderId}/shipping_fulfillment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItems,
          shippedDate: new Date().toISOString(),
          shippingCarrierCode: this.normalizeCarrierCode(shipment.carrier),
          trackingNumber: shipment.trackingCode,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();

      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.LABEL_PURCHASED,
          metadata: this.mergeMetadata(shipment.metadata, {
            marketplaceSync: {
              state: 'FAILED',
              status: response.status,
              body,
              failedAt: new Date().toISOString(),
              recoverable: true,
            },
            lastError: {
              stage: 'marketplace-sync',
              message: `eBay fulfillment sync failed with status ${response.status}`,
              recordedAt: new Date().toISOString(),
              recoverable: true,
              details: body,
            },
          }),
        },
      });

      throw new InternalServerErrorException(
        `Failed to sync shipment ${shipmentId} to eBay: ${response.status}`,
      );
    }

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.SYNCED_TO_MARKETPLACE,
        syncedToMarketplaceAt: new Date(),
        metadata: this.mergeMetadata(shipment.metadata, {
          marketplaceSync: {
            state: 'SYNCED',
            syncedAt: new Date().toISOString(),
          },
          lastError: null,
        }),
      },
    });
  }

  private normalizeCarrierCode(carrier?: string | null): string {
    const normalized = (carrier ?? '').trim().toLowerCase();

    switch (normalized) {
      case 'usps':
      case 'united states postal service':
        return 'USPS';
      case 'ups':
        return 'UPS';
      case 'fedex':
        return 'FEDEX';
      case 'dhl':
        return 'DHL';
      default:
        return carrier?.toUpperCase() ?? 'OTHER';
    }
  }

  private async getValidEbayAccessToken(account: MarketplaceAccount): Promise<string> {
    const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;

    if (account.accessToken && expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
      return account.accessToken;
    }

    if (!account.refreshToken) {
      throw new BadRequestException(`Marketplace account ${account.id} is missing refreshToken`);
    }

    const refreshed = await this.refreshEbayToken(account.refreshToken);

    await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      },
    });

    return refreshed.accessToken;
  }

  private async refreshEbayToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Missing eBay OAuth client credentials');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope:
          'https://api.ebay.com/oauth/api_scope/sell.fulfillment ' +
          'https://api.ebay.com/oauth/api_scope/sell.inventory',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(
        `Failed to refresh eBay token: ${response.status} ${body}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
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
}
