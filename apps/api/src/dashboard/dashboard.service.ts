import { Injectable } from '@nestjs/common';
import { prisma } from '@omniseller/db';
import { resolveUserId } from '../common/user-context';

type CountBucket = { key: string; count: number };

type ProfitInput = {
  totalCents: number;
  feeCents: number;
  shippingCents: number;
  items?: Array<{
    quantity: number;
    salePriceCents: number;
    inventoryItem?: {
      costBasisCents: number;
    } | null;
  }>;
};

export function calculateProfitSummary(orders: ProfitInput[]) {
  const totals = orders.reduce(
    (summary, order) => {
      const orderRevenue = order.items?.length
        ? order.items.reduce((sum, item) => sum + item.salePriceCents * item.quantity, 0)
        : order.totalCents;
      const costBasis = (order.items ?? []).reduce(
        (sum, item) => sum + (item.inventoryItem?.costBasisCents ?? 0) * item.quantity,
        0,
      );

      summary.revenueCents += orderRevenue;
      summary.feeCents += order.feeCents;
      summary.shippingCostCents += order.shippingCents;
      summary.costBasisCents += costBasis;
      return summary;
    },
    {
      revenueCents: 0,
      feeCents: 0,
      shippingCostCents: 0,
      costBasisCents: 0,
    },
  );

  const grossProfitCents =
    totals.revenueCents - totals.feeCents - totals.shippingCostCents - totals.costBasisCents;

  return {
    ...totals,
    grossProfitCents,
    roiPercent:
      totals.costBasisCents > 0
        ? Number(((grossProfitCents / totals.costBasisCents) * 100).toFixed(1))
        : null,
  };
}

@Injectable()
export class DashboardService {
  async getSummary(userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);

    const [items, listings, orders] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { userId: ownerId },
        select: {
          id: true,
          sku: true,
          title: true,
          inventoryStatus: true,
          listingReadiness: true,
          saleStatus: true,
          publishStatus: true,
          publishError: true,
          costBasisCents: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      } as any),
      prisma.listing.findMany({
        where: {
          account: {
            userId: ownerId,
          },
        },
        select: {
          id: true,
          status: true,
          priceCents: true,
        },
      } as any),
      prisma.order.findMany({
        where: {
          marketplaceAccount: {
            userId: ownerId,
          },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          marketplaceAccount: {
            select: {
              id: true,
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
            },
            orderBy: { createdAt: 'asc' },
          },
          shipments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      } as any),
    ]);

    const readinessCounts = this.countBy(items, 'listingReadiness');
    const saleLifecycleCounts = this.countBy(items, 'saleStatus');
    const publishCounts = this.countBy(items, 'publishStatus');
    const inventoryValueCents = items.reduce((sum: number, item: any) => sum + (item.costBasisCents ?? 0), 0);
    const activeListings = listings.filter((listing: any) => listing.status === 'active');
    const profit = calculateProfitSummary(orders as ProfitInput[]);
    const ordersRequiringShipping = orders.filter((order: any) => {
      const latestShipment = order.shipments?.[0];
      return !latestShipment || ['PENDING', 'ERROR'].includes(latestShipment.status);
    });

    return {
      generatedAt: new Date().toISOString(),
      inventory: {
        total: items.length,
        valueCents: inventoryValueCents,
        readiness: readinessCounts,
        saleLifecycle: saleLifecycleCounts,
        workflow: {
          listed: saleLifecycleCounts.find((bucket) => bucket.key === 'LISTED')?.count ?? 0,
          sold: saleLifecycleCounts.find((bucket) => bucket.key === 'SOLD')?.count ?? 0,
          shipped: saleLifecycleCounts.find((bucket) => bucket.key === 'SHIPPED')?.count ?? 0,
          blocked:
            (publishCounts.find((bucket) => bucket.key === 'BLOCKED')?.count ?? 0) +
            (publishCounts.find((bucket) => bucket.key === 'FAILED')?.count ?? 0) +
            (publishCounts.find((bucket) => bucket.key === 'UNAVAILABLE')?.count ?? 0),
        },
      },
      listings: {
        total: listings.length,
        active: activeListings.length,
        activeValueCents: activeListings.reduce((sum: number, listing: any) => sum + listing.priceCents, 0),
      },
      orders: {
        total: orders.length,
        requiringShipping: ordersRequiringShipping.length,
        recentSales: orders.slice(0, 5).map((order: any) => this.serializeOrderPreview(order)),
        shippingQueue: ordersRequiringShipping.slice(0, 5).map((order: any) => this.serializeOrderPreview(order)),
      },
      profit,
      workQueues: {
        needsPhotos: this.queueByReadiness(items, 'NEEDS_PHOTOS'),
        readyForAi: this.queueByReadiness(items, 'READY_FOR_AI'),
        readyToPublish: this.queueByReadiness(items, 'READY_TO_PUBLISH'),
        publishBlocked: items
          .filter((item: any) => ['FAILED', 'UNAVAILABLE', 'BLOCKED'].includes(item.publishStatus))
          .slice(0, 5)
          .map((item: any) => this.serializeInventoryPreview(item)),
        shippingError: orders
          .filter((order: any) => order.shipments?.[0]?.status === 'ERROR')
          .slice(0, 5)
          .map((order: any) => this.serializeOrderPreview(order)),
      },
    };
  }

  private countBy(items: any[], field: string): CountBucket[] {
    const counts = new Map<string, number>();

    for (const item of items) {
      const key = item[field] ?? 'UNKNOWN';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private queueByReadiness(items: any[], readiness: string) {
    return items
      .filter((item) => item.listingReadiness === readiness)
      .slice(0, 5)
      .map((item) => this.serializeInventoryPreview(item));
  }

  private serializeInventoryPreview(item: any) {
    return {
      id: item.id,
      sku: item.sku,
      title: item.title ?? null,
      listingReadiness: item.listingReadiness,
      saleStatus: item.saleStatus,
      publishStatus: item.publishStatus,
      publishError: item.publishError ?? null,
      updatedAt: item.updatedAt,
    };
  }

  private serializeOrderPreview(order: any) {
    const latestShipment = order.shipments?.[0] ?? null;

    return {
      id: order.id,
      marketplace: order.marketplace,
      marketplaceOrderId: order.marketplaceOrderId,
      buyerName: order.buyerName ?? order.shippingName ?? null,
      totalCents: order.totalCents,
      feeCents: order.feeCents,
      shippingCents: order.shippingCents,
      createdAt: order.createdAt,
      marketplaceAccount: order.marketplaceAccount
        ? {
            id: order.marketplaceAccount.id,
            kind: order.marketplaceAccount.kind,
            nickname: order.marketplaceAccount.nickname ?? null,
          }
        : null,
      itemCount: (order.items ?? []).reduce((sum: number, item: any) => sum + item.quantity, 0),
      firstSku: order.items?.[0]?.inventoryItem?.sku ?? null,
      latestShipmentStatus: latestShipment?.status ?? null,
    };
  }
}
