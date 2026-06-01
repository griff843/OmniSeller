import { Injectable } from '@nestjs/common';
import { prisma } from '@omniseller/db';
import { resolveUserId } from '../common/user-context';

type CountBucket = { key: string; count: number };

type ProfitInput = {
  totalCents: number;
  feeCents: number;
  shippingCents: number;
  taxCents?: number;
  items?: Array<{
    quantity: number;
    salePriceCents: number;
    inventoryItem?: {
      costBasisCents: number;
    } | null;
  }>;
  shipments?: Array<{
    status?: string | null;
    rateAmount?: unknown;
  }>;
};

const DASHBOARD_PREVIEW_LIMIT = 5;
const DASHBOARD_WORK_QUEUE_LIMIT = 200;
const DASHBOARD_ORDER_WINDOW_DAYS = 30;
const DASHBOARD_RECENT_INTAKE_DAYS = 7;
const DASHBOARD_STALE_DRAFT_DAYS = 14;

export function calculateProfitSummary(orders: ProfitInput[]) {
  const totals = orders.reduce(
    (summary, order) => {
      const itemRevenueCents = order.items?.length
        ? order.items.reduce((sum, item) => sum + item.salePriceCents * item.quantity, 0)
        : Math.max(order.totalCents - (order.shippingCents ?? 0) - (order.taxCents ?? 0), 0);
      const revenueCents = itemRevenueCents + (order.shippingCents ?? 0);
      const shippingCostCents = calculateShipmentCostCents(order.shipments ?? []);
      const costBasis = (order.items ?? []).reduce(
        (sum, item) => sum + (item.inventoryItem?.costBasisCents ?? 0) * item.quantity,
        0,
      );

      summary.revenueCents += revenueCents;
      summary.feeCents += order.feeCents;
      summary.shippingCostCents += shippingCostCents;
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

export function calculateShipmentCostCents(shipments: Array<{ status?: string | null; rateAmount?: unknown }>) {
  return shipments.reduce((sum, shipment) => {
    if (shipment.status === 'VOIDED') {
      return sum;
    }

    return sum + moneyToCents(shipment.rateAmount);
  }, 0);
}

function moneyToCents(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  const amount = typeof value === 'object' && 'toString' in value ? Number(value.toString()) : Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

@Injectable()
export class DashboardService {
  async getSummary(userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const orderWindowStart = new Date(Date.now() - DASHBOARD_ORDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recentIntakeStart = new Date(Date.now() - DASHBOARD_RECENT_INTAKE_DAYS * 24 * 60 * 60 * 1000);
    const staleDraftBefore = new Date(Date.now() - DASHBOARD_STALE_DRAFT_DAYS * 24 * 60 * 60 * 1000);

    const [
      items,
      inventoryTotal,
      inventoryValue,
      readinessCountsRaw,
      saleCountsRaw,
      publishCountsRaw,
      recentIntakeCount,
      missingCostBasisCount,
      unassignedBinCount,
      staleDraftCount,
      listings,
      listingTotal,
      activeListingTotal,
      activeListingValue,
      orders,
      orderTotal,
    ] = await Promise.all([
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
        take: DASHBOARD_WORK_QUEUE_LIMIT,
      } as any),
      prisma.inventoryItem.count({
        where: { userId: ownerId },
      } as any),
      prisma.inventoryItem.aggregate({
        where: { userId: ownerId },
        _sum: { costBasisCents: true },
      } as any),
      (prisma.inventoryItem as any).groupBy({
        by: ['listingReadiness'],
        where: { userId: ownerId },
        _count: { _all: true },
      }),
      (prisma.inventoryItem as any).groupBy({
        by: ['saleStatus'],
        where: { userId: ownerId },
        _count: { _all: true },
      }),
      (prisma.inventoryItem as any).groupBy({
        by: ['publishStatus'],
        where: { userId: ownerId },
        _count: { _all: true },
      }),
      prisma.inventoryItem.count({
        where: {
          userId: ownerId,
          createdAt: { gte: recentIntakeStart },
        },
      } as any),
      prisma.inventoryItem.count({
        where: {
          userId: ownerId,
          costBasisCents: { lte: 0 },
        },
      } as any),
      prisma.inventoryItem.count({
        where: {
          userId: ownerId,
          binId: null,
          inventoryStatus: { not: 'ARCHIVED' },
          saleStatus: { notIn: ['SOLD', 'SHIPPED'] },
        },
      } as any),
      prisma.inventoryItem.count({
        where: {
          userId: ownerId,
          inventoryStatus: 'DRAFT',
          updatedAt: { lt: staleDraftBefore },
        },
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
        orderBy: { updatedAt: 'desc' },
        take: DASHBOARD_WORK_QUEUE_LIMIT,
      } as any),
      prisma.listing.count({
        where: {
          account: {
            userId: ownerId,
          },
        },
      } as any),
      prisma.listing.count({
        where: {
          account: {
            userId: ownerId,
          },
          status: 'active',
        },
      } as any),
      prisma.listing.aggregate({
        where: {
          account: {
            userId: ownerId,
          },
          status: 'active',
        },
        _sum: { priceCents: true },
      } as any),
      prisma.order.findMany({
        where: {
          marketplaceAccount: {
            userId: ownerId,
          },
          createdAt: {
            gte: orderWindowStart,
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
      prisma.order.count({
        where: {
          marketplaceAccount: {
            userId: ownerId,
          },
          createdAt: {
            gte: orderWindowStart,
          },
        },
      } as any),
    ]);

    const readinessCounts = this.serializeGroupCounts(readinessCountsRaw, 'listingReadiness');
    const saleLifecycleCounts = this.serializeGroupCounts(saleCountsRaw, 'saleStatus');
    const publishCounts = this.serializeGroupCounts(publishCountsRaw, 'publishStatus');
    const inventoryValueCents = inventoryValue._sum?.costBasisCents ?? 0;
    const activeListings = listings.filter((listing: any) => listing.status === 'active');
    const profit = calculateProfitSummary(orders as ProfitInput[]);
    const ordersRequiringShipping = orders.filter((order: any) => {
      const latestShipment = order.shipments?.[0];
      return !latestShipment || ['PENDING', 'ERROR'].includes(latestShipment.status);
    });

    return {
      generatedAt: new Date().toISOString(),
      period: {
        orderWindowDays: DASHBOARD_ORDER_WINDOW_DAYS,
        orderWindowStart: orderWindowStart.toISOString(),
      },
      inventory: {
        total: inventoryTotal,
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
        intake: {
          recentDays: DASHBOARD_RECENT_INTAKE_DAYS,
          recentCreated: recentIntakeCount,
          missingCostBasis: missingCostBasisCount,
          unassignedBin: unassignedBinCount,
          staleDraftDays: DASHBOARD_STALE_DRAFT_DAYS,
          staleDraft: staleDraftCount,
        },
      },
      listings: {
        total: listingTotal,
        active: activeListingTotal,
        activeValueCents: activeListingValue._sum?.priceCents ?? activeListings.reduce((sum: number, listing: any) => sum + listing.priceCents, 0),
      },
      orders: {
        total: orderTotal,
        requiringShipping: ordersRequiringShipping.length,
        recentSales: orders.slice(0, DASHBOARD_PREVIEW_LIMIT).map((order: any) => this.serializeOrderPreview(order)),
        shippingQueue: ordersRequiringShipping.slice(0, DASHBOARD_PREVIEW_LIMIT).map((order: any) => this.serializeOrderPreview(order)),
      },
      profit,
      workQueues: {
        needsPhotos: this.queueByReadiness(items, 'NEEDS_PHOTOS'),
        readyForAi: this.queueByReadiness(items, 'READY_FOR_AI'),
        readyToPublish: this.queueByReadiness(items, 'READY_TO_PUBLISH'),
        publishBlocked: items
          .filter((item: any) => ['FAILED', 'UNAVAILABLE', 'BLOCKED'].includes(item.publishStatus))
          .slice(0, DASHBOARD_PREVIEW_LIMIT)
          .map((item: any) => this.serializeInventoryPreview(item)),
        shippingError: orders
          .filter((order: any) => order.shipments?.[0]?.status === 'ERROR')
          .slice(0, DASHBOARD_PREVIEW_LIMIT)
          .map((order: any) => this.serializeOrderPreview(order)),
      },
    };
  }

  private serializeGroupCounts(groups: any[], field: string): CountBucket[] {
    return groups
      .map((group) => ({ key: group[field] ?? 'UNKNOWN', count: group._count?._all ?? 0 }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  private queueByReadiness(items: any[], readiness: string) {
    return items
      .filter((item) => item.listingReadiness === readiness)
      .slice(0, DASHBOARD_PREVIEW_LIMIT)
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
