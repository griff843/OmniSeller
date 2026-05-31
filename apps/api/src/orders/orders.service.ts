import { Injectable } from '@nestjs/common';
import { prisma } from '@omniseller/db';
import { ShippingService } from '../shipping/shipping.service';
import { deriveShipmentExecutionState } from '../shipping/shipping-workflow-state';
import { ownsRecord, resolveUserId } from '../common/user-context';

@Injectable()
export class OrdersService {
  constructor(private readonly shippingService: ShippingService) {}

  async list(userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const orders = await prisma.order.findMany({
      where: {
        marketplaceAccount: {
          userId: ownerId,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: this.orderInclude(),
    } as any);

    return orders.map((order: any) => this.serializeOrder(order));
  }

  async get(id: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const order: any = await prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(),
    } as any);

    if (!order || !ownsRecord(order.marketplaceAccount?.userId, ownerId)) {
      return null;
    }

    return this.serializeOrder(order);
  }

  private orderInclude() {
    return {
      marketplaceAccount: {
        select: {
          id: true,
          userId: true,
          kind: true,
          nickname: true,
        },
      },
      items: {
        include: {
          inventoryItem: {
            select: {
              id: true,
              sku: true,
              title: true,
            },
          },
          listing: {
            select: {
              id: true,
              marketplaceItemId: true,
              listingUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  private serializeOrder(order: any) {
    const shippingAvailability = this.shippingService.getAvailabilitySummary();
    const shipments = (order.shipments ?? []).map((shipment: any) => this.serializeShipment(shipment));
    const latestShipment = shipments[0] ?? null;
    const latestShipmentState = deriveShipmentExecutionState(latestShipment);
    const fulfillmentStatus = latestShipment
      ? latestShipmentState.status
      : shippingAvailability.canRequestRates
        ? 'NOT_STARTED'
        : 'UNAVAILABLE';
    const fulfillmentMessage = latestShipment
      ? latestShipmentState.message
      : shippingAvailability.blockedReason ?? 'No shipment has been started for this order yet.';

    return {
      id: order.id,
      marketplace: order.marketplace,
      marketplaceOrderId: order.marketplaceOrderId,
      buyerName: order.buyerName ?? null,
      buyerPhone: order.buyerPhone ?? null,
      buyerEmail: order.buyerEmail ?? null,
      shippingName: order.shippingName ?? null,
      shippingCompany: order.shippingCompany ?? null,
      shippingAddress1: order.shippingAddress1 ?? null,
      shippingAddress2: order.shippingAddress2 ?? null,
      shippingCity: order.shippingCity ?? null,
      shippingState: order.shippingState ?? null,
      shippingPostalCode: order.shippingPostalCode ?? null,
      shippingCountry: order.shippingCountry ?? null,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      taxCents: order.taxCents,
      feeCents: order.feeCents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      marketplaceAccount: order.marketplaceAccount
        ? {
            id: order.marketplaceAccount.id,
            kind: order.marketplaceAccount.kind,
            nickname: order.marketplaceAccount.nickname ?? null,
          }
        : null,
      items: (order.items ?? []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        salePriceCents: item.salePriceCents,
        marketplaceLineItemId: item.marketplaceLineItemId ?? null,
        inventoryItem: item.inventoryItem
          ? {
              id: item.inventoryItem.id,
              sku: item.inventoryItem.sku,
              title: item.inventoryItem.title ?? null,
            }
          : null,
        listing: item.listing
          ? {
              id: item.listing.id,
              marketplaceItemId: item.listing.marketplaceItemId ?? null,
              listingUrl: item.listing.listingUrl ?? null,
            }
          : null,
      })),
      shipments,
      fulfillment: {
        provider: shippingAvailability.provider,
        providerConfigured: shippingAvailability.providerConfigured,
        defaultShipFromConfigured: shippingAvailability.defaultShipFromConfigured,
        canRequestRates: shippingAvailability.canRequestRates,
        canPurchaseLabels: shippingAvailability.canPurchaseLabels,
        status: fulfillmentStatus,
        message: fulfillmentMessage,
        latestShipmentState,
      },
    };
  }

  private serializeShipment(shipment: any) {
    const workflow = deriveShipmentExecutionState(shipment);

    return {
      id: shipment.id,
      orderId: shipment.orderId,
      provider: shipment.provider,
      status: shipment.status,
      providerShipmentId: shipment.providerShipmentId ?? null,
      providerRateId: shipment.providerRateId ?? null,
      providerTrackerId: shipment.providerTrackerId ?? null,
      carrier: shipment.carrier ?? null,
      service: shipment.service ?? null,
      trackingCode: shipment.trackingCode ?? null,
      trackingStatus: shipment.trackingStatus ?? null,
      labelUrl: shipment.labelUrl ?? null,
      labelFormat: shipment.labelFormat ?? null,
      rateAmount: shipment.rateAmount ?? null,
      rateCurrency: shipment.rateCurrency ?? null,
      parcelLength: shipment.parcelLength ?? null,
      parcelWidth: shipment.parcelWidth ?? null,
      parcelHeight: shipment.parcelHeight ?? null,
      parcelWeightOz: shipment.parcelWeightOz ?? null,
      metadata: shipment.metadata ?? null,
      purchasedAt: shipment.purchasedAt ?? null,
      syncedToMarketplaceAt: shipment.syncedToMarketplaceAt ?? null,
      voidedAt: shipment.voidedAt ?? null,
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
      workflow,
    };
  }
}
