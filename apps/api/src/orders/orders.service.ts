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
              costBasisCents: true,
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
    const items = order.items ?? [];
    const financials = this.calculateFinancials(order, items);
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
      items: items.map((item: any, index: number) => ({
        id: item.id,
        quantity: item.quantity,
        salePriceCents: item.salePriceCents,
        marketplaceLineItemId: item.marketplaceLineItemId ?? null,
        inventoryItem: item.inventoryItem
          ? {
              id: item.inventoryItem.id,
              sku: item.inventoryItem.sku,
              title: item.inventoryItem.title ?? null,
              costBasisCents: item.inventoryItem.costBasisCents ?? 0,
            }
          : null,
        listing: item.listing
          ? {
              id: item.listing.id,
              marketplaceItemId: item.listing.marketplaceItemId ?? null,
              listingUrl: item.listing.listingUrl ?? null,
            }
          : null,
        financials: financials.items[index],
      })),
      shipments,
      financials: financials.summary,
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

  private calculateFinancials(order: any, items: any[]) {
    const itemFinancials = items.map((item) => {
      const itemRevenueCents = item.salePriceCents * item.quantity;
      const costBasisCents = (item.inventoryItem?.costBasisCents ?? 0) * item.quantity;

      return {
        revenueCents: itemRevenueCents,
        costBasisCents,
      };
    });
    const itemRevenueCents = itemFinancials.length
      ? itemFinancials.reduce((sum, item) => sum + item.revenueCents, 0)
      : Math.max((order.totalCents ?? 0) - (order.shippingCents ?? 0) - (order.taxCents ?? 0), 0);
    const revenueCents = itemRevenueCents + (order.shippingCents ?? 0);
    const shippingCostCents = this.calculateShipmentCostCents(order.shipments ?? []);
    const shippingRevenueAllocations = this.allocateByRevenue(
      itemFinancials,
      order.shippingCents ?? 0,
      itemRevenueCents,
    );
    const feeAllocations = this.allocateByRevenue(itemFinancials, order.feeCents ?? 0, itemRevenueCents);
    const shippingCostAllocations = this.allocateByRevenue(
      itemFinancials,
      shippingCostCents,
      itemRevenueCents,
    );
    const itemsWithProfit = itemFinancials.map((item, index) => {
      const revenueWithShippingCents = item.revenueCents + (shippingRevenueAllocations[index] ?? 0);
      const feeCents = feeAllocations[index] ?? 0;
      const itemShippingCostCents = shippingCostAllocations[index] ?? 0;
      const grossProfitCents =
        revenueWithShippingCents - feeCents - itemShippingCostCents - item.costBasisCents;

      return {
        revenueCents: revenueWithShippingCents,
        feeCents,
        shippingCostCents: itemShippingCostCents,
        costBasisCents: item.costBasisCents,
        grossProfitCents,
        roiPercent:
          item.costBasisCents > 0 ? Number(((grossProfitCents / item.costBasisCents) * 100).toFixed(1)) : null,
      };
    });
    const costBasisCents = itemsWithProfit.reduce((sum, item) => sum + item.costBasisCents, 0);
    const grossProfitCents = revenueCents - (order.feeCents ?? 0) - shippingCostCents - costBasisCents;

    return {
      items: itemsWithProfit,
      summary: {
        revenueCents,
        feeCents: order.feeCents ?? 0,
        shippingCostCents,
        taxCents: order.taxCents ?? 0,
        costBasisCents,
        grossProfitCents,
        roiPercent:
          costBasisCents > 0 ? Number(((grossProfitCents / costBasisCents) * 100).toFixed(1)) : null,
      },
    };
  }

  private calculateShipmentCostCents(shipments: Array<{ status?: string | null; rateAmount?: unknown }>) {
    return shipments.reduce((sum, shipment) => {
      if (shipment.status === 'VOIDED') {
        return sum;
      }

      return sum + this.moneyToCents(shipment.rateAmount);
    }, 0);
  }

  private moneyToCents(value: unknown) {
    if (value === null || value === undefined) {
      return 0;
    }

    const amount = typeof value === 'object' && 'toString' in value ? Number(value.toString()) : Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  private allocateByRevenue(
    items: Array<{ revenueCents: number }>,
    amountCents: number,
    revenueCents: number,
  ) {
    if (items.length === 0) {
      return [];
    }

    if (revenueCents <= 0 || amountCents === 0) {
      return items.map(() => 0);
    }

    let allocated = 0;

    return items.map((item, index) => {
      if (index === items.length - 1) {
        return amountCents - allocated;
      }

      const share = Math.round((amountCents * item.revenueCents) / revenueCents);
      allocated += share;
      return share;
    });
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
