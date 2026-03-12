import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { prisma } from '@omniseller/db';
import { Queue } from 'bullmq';
import { buildReadinessBlockers, isPublishReady } from '../inventory/inventory-workflow-state';

const PUBLISH_QUEUE = 'publishListing';

@Injectable()
export class ListingsService {
  constructor(@InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue) {}

  async enqueuePublish(inventoryItemId: string, marketplace: string) {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        photos: {
          where: {
            deletedAt: null,
          },
        },
        listingDraft: true,
        listings: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const hasPublishableDraft = Boolean(
      item.listingDraft?.title?.trim() &&
      item.listingDraft?.description?.trim() &&
      item.listingDraft?.category?.trim() &&
      item.listingDraft?.priceCents !== null &&
      item.listingDraft?.priceCents !== undefined,
    );
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: false,
      hasDraft: Boolean(item.listingDraft),
      hasPublishableDraft,
      hasActiveListing: (item.listings ?? []).length > 0,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    if (!isPublishReady(snapshot)) {
      throw new BadRequestException(buildReadinessBlockers(snapshot).join(' '));
    }

    await this.publishQueue.add('publish', { inventoryItemId, marketplace });
  }
}
