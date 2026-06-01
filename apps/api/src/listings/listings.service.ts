import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { prisma } from '@omniseller/db';
import { Queue } from 'bullmq';
import { buildReadinessBlockers, isPublishReady } from '../inventory/inventory-workflow-state';
import { getPublishStateMessage, isPublishInFlight } from './publish-state';
import { MARKETPLACE_PUBLISH_PROVIDER, MarketplacePublishProvider } from './publishing/marketplace-publish.contract';
import { ownsRecord, resolveUserId } from '../common/user-context';
import { getDraftMissingFields, hasPublishableListingDraft } from './listing-draft-readiness';

const PUBLISH_QUEUE = 'publishListing';

@Injectable()
export class ListingsService {
  constructor(
    @InjectQueue(PUBLISH_QUEUE) private readonly publishQueue: Queue,
    @Inject(MARKETPLACE_PUBLISH_PROVIDER)
    private readonly publishProvider: MarketplacePublishProvider,
  ) {}

  async enqueuePublish(inventoryItemId: string, marketplace: string, userId?: string) {
    const ownerId = resolveUserId(userId);
    const item: any = await prisma.inventoryItem.findUnique({
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

    if (!item || !ownsRecord(item.userId, ownerId)) {
      throw new NotFoundException('Item not found');
    }

    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const draftMissingFields = getDraftMissingFields(item.listingDraft);
    const hasPublishableDraft = hasPublishableListingDraft(item.listingDraft);
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: false,
      hasDraft: Boolean(item.listingDraft),
      hasPublishableDraft,
      draftMissingFields,
      hasActiveListing: (item.listings ?? []).length > 0,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    if (!isPublishReady(snapshot)) {
      const reason = buildReadinessBlockers(snapshot).join(' ');
      const publishState = await this.updatePublishState(inventoryItemId, {
        publishStatus: 'BLOCKED',
        publishMarketplace: marketplace,
        publishRequestedAt: new Date(),
        publishFailedAt: new Date(),
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishError: reason,
      });

      throw new BadRequestException(publishState.message);
    }

    if (isPublishInFlight(item.publishStatus)) {
      throw new ConflictException(
        getPublishStateMessage({
          status: item.publishStatus,
          marketplace: item.publishMarketplace ?? marketplace,
          error: item.publishError,
        }),
      );
    }

    const marketplaceAccount = await prisma.marketplaceAccount.findFirst({
      where: {
        userId: item.userId,
        kind: marketplace,
      },
      orderBy: { updatedAt: 'desc' },
    } as any);
    const availability: any = this.publishProvider.getAvailability(marketplace, marketplaceAccount);

    if (!availability.available) {
      const unavailableReason = availability.reason;
      const publishState = await this.updatePublishState(inventoryItemId, {
        publishStatus: 'UNAVAILABLE',
        publishMarketplace: marketplace,
        publishRequestedAt: new Date(),
        publishFailedAt: new Date(),
        publishQueuedAt: null,
        publishStartedAt: null,
        publishedAt: null,
        publishError: unavailableReason,
      });

      throw new ServiceUnavailableException(publishState.message);
    }

    await this.publishQueue.add('publish', { inventoryItemId, marketplace });

    const publishState = await this.updatePublishState(inventoryItemId, {
      publishStatus: 'QUEUED',
      publishMarketplace: marketplace,
      publishRequestedAt: new Date(),
      publishQueuedAt: new Date(),
      publishStartedAt: null,
      publishedAt: null,
      publishFailedAt: null,
      publishError: null,
    });

    return {
      status: publishState.status,
      message: publishState.message,
      publishState,
    };
  }

  async bulkEnqueuePublish(itemIds: string[], marketplace = 'ebay', userId?: string) {
    const uniqueItemIds = this.validateBulkItemIds(itemIds);
    const results: Array<{
      itemId: string;
      status: 'queued' | 'failed';
      message?: string;
    }> = [];
    let queued = 0;
    let failed = 0;

    for (const itemId of uniqueItemIds) {
      try {
        const result = (await this.enqueuePublish(itemId, marketplace, userId)) as { message?: string };
        queued += 1;
        results.push({
          itemId,
          status: 'queued',
          message: result.message,
        });
      } catch (error) {
        failed += 1;
        results.push({
          itemId,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Failed to queue publish',
        });
      }
    }

    return {
      action: 'BULK_PUBLISH',
      marketplace,
      requested: uniqueItemIds.length,
      counts: {
        queued,
        failed,
      },
      results,
    };
  }

  private validateBulkItemIds(itemIds: unknown): string[] {
    if (!Array.isArray(itemIds)) {
      throw new BadRequestException('itemIds must be an array');
    }

    const normalized = itemIds.map((itemId) => (typeof itemId === 'string' ? itemId.trim() : ''));

    if (normalized.length === 0) {
      throw new BadRequestException('Bulk workflow requires at least one inventory item id');
    }

    if (normalized.length > 25) {
      throw new BadRequestException('Bulk workflow is limited to 25 inventory items');
    }

    if (normalized.some((itemId) => itemId.length === 0)) {
      throw new BadRequestException('Inventory item ids cannot be blank');
    }

    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('Bulk workflow itemIds must be unique');
    }

    return normalized;
  }

  private async updatePublishState(
    inventoryItemId: string,
    data: {
      publishStatus: 'BLOCKED' | 'QUEUED' | 'UNAVAILABLE' | 'FAILED' | 'PROCESSING' | 'PUBLISHED';
      publishMarketplace: string;
      publishRequestedAt?: Date | null;
      publishQueuedAt?: Date | null;
      publishStartedAt?: Date | null;
      publishedAt?: Date | null;
      publishFailedAt?: Date | null;
      publishError?: string | null;
    },
  ) {
    const updated: any = await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data,
    } as any);

    return {
      status: updated?.publishStatus ?? data.publishStatus,
      marketplace: updated?.publishMarketplace ?? data.publishMarketplace,
      requestedAt: updated?.publishRequestedAt ?? data.publishRequestedAt ?? null,
      queuedAt: updated?.publishQueuedAt ?? data.publishQueuedAt ?? null,
      startedAt: updated?.publishStartedAt ?? data.publishStartedAt ?? null,
      publishedAt: updated?.publishedAt ?? data.publishedAt ?? null,
      failedAt: updated?.publishFailedAt ?? data.publishFailedAt ?? null,
      error: updated?.publishError ?? data.publishError ?? null,
      message: getPublishStateMessage({
        status: updated?.publishStatus ?? data.publishStatus,
        marketplace: updated?.publishMarketplace ?? data.publishMarketplace,
        error: updated?.publishError ?? data.publishError,
        requestedAt: updated?.publishRequestedAt ?? data.publishRequestedAt,
        queuedAt: updated?.publishQueuedAt ?? data.publishQueuedAt,
        startedAt: updated?.publishStartedAt ?? data.publishStartedAt,
        publishedAt: updated?.publishedAt ?? data.publishedAt,
        failedAt: updated?.publishFailedAt ?? data.publishFailedAt,
      }),
    };
  }
}
