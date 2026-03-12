import { Injectable } from '@nestjs/common';
import { prisma } from '@omniseller/db';

@Injectable()
export class OrdersService {
  list(): Promise<unknown> {
    return prisma.order.findMany({
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
              },
            },
            listing: {
              select: {
                id: true,
                marketplaceItemId: true,
              },
            },
          },
        },
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  get(id: string): Promise<unknown> {
    return prisma.order.findUnique({
      where: { id },
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
      },
    });
  }
}
