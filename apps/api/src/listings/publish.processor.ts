import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { prisma } from '@omniseller/db';
import {
  buildReadinessBlockers,
  determineListingReadiness,
  determineSaleStatus,
  isPublishReady,
} from '../inventory/inventory-workflow-state';
import { getPublishStateMessage } from './publish-state';
import { MARKETPLACE_PUBLISH_PROVIDER, MarketplacePublishProvider } from './publishing/marketplace-publish.contract';
import { getDraftMissingFields, hasPublishableListingDraft } from './listing-draft-readiness';

const PUBLISH_QUEUE = 'publishListing';

@Processor(PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    @Inject(MARKETPLACE_PUBLISH_PROVIDER)
    private readonly publishProvider: MarketplacePublishProvider,
  ) {
    super();
  }

  async process(job: Job<{ inventoryItemId: string; marketplace: string }>) {
    const { inventoryItemId, marketplace } = job.data;
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
    } as any);

    if (!item) {
      throw new Error('Item missing');
    }

    await this.updatePublishState(inventoryItemId, {
      publishStatus: 'PROCESSING',
      publishMarketplace: marketplace,
      publishStartedAt: new Date(),
      publishError: null,
    });

    const draft = item.listingDraft;
    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const draftMissingFields = getDraftMissingFields(draft);
    const hasPublishableDraft = hasPublishableListingDraft(draft);
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: false,
      hasDraft: Boolean(draft),
      hasPublishableDraft,
      draftMissingFields,
      hasActiveListing: (item.listings ?? []).length > 0,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    if (!isPublishReady(snapshot)) {
      const reason = buildReadinessBlockers(snapshot).join(' ');
      await this.updatePublishState(inventoryItemId, {
        publishStatus: 'BLOCKED',
        publishMarketplace: marketplace,
        publishFailedAt: new Date(),
        publishError: reason,
      });
      this.logger.warn(`publish blocked for ${inventoryItemId}: ${reason}`);
      return;
    }

    const marketplaceAccount = await prisma.marketplaceAccount.findFirst({
      where: {
        userId: item.userId,
        kind: marketplace,
      },
      orderBy: { createdAt: 'desc' },
    } as any);
    const availability: any = this.publishProvider.getAvailability(marketplace, marketplaceAccount);

    if (!availability.available) {
      const unavailableReason = availability.reason;
      await this.updatePublishState(inventoryItemId, {
        publishStatus: 'UNAVAILABLE',
        publishMarketplace: marketplace,
        publishFailedAt: new Date(),
        publishError: unavailableReason,
      });
      this.logger.warn(`publish unavailable for ${inventoryItemId}: ${unavailableReason}`);
      return;
    }

    try {
      const publishResult = await this.publishProvider.publishDraft({
        inventoryItem: item,
        draft,
        marketplace,
        marketplaceAccount: availability.marketplaceAccount,
      });

      const existingListing = await prisma.listing.findFirst({
        where: {
          inventoryItemId,
          marketplace,
        },
        orderBy: { createdAt: 'desc' },
      });

      let listingId = existingListing?.id ?? null;

      if (existingListing) {
        const updatedListing = await prisma.listing.update({
          where: { id: existingListing.id },
          data: {
            marketplaceAccountId: availability.marketplaceAccount.id,
            marketplaceItemId: publishResult.marketplaceItemId,
            offerId: publishResult.offerId ?? existingListing.offerId,
            listingUrl: publishResult.listingUrl ?? existingListing.listingUrl,
            title: draft?.title ?? existingListing.title,
            description: draft?.description ?? existingListing.description,
            category: draft?.category ?? existingListing.category,
            itemSpecifics: draft?.itemSpecifics ?? existingListing.itemSpecifics,
            priceCents: draft?.priceCents ?? existingListing.priceCents,
            status: publishResult.status ?? 'active',
          },
        });
        listingId = updatedListing.id;
      } else {
        const createdListing = await prisma.listing.create({
          data: {
            inventoryItemId,
            marketplace,
            marketplaceAccountId: availability.marketplaceAccount.id,
            marketplaceItemId: publishResult.marketplaceItemId,
            offerId: publishResult.offerId ?? null,
            listingUrl: publishResult.listingUrl ?? null,
            title: draft?.title ?? item.title ?? null,
            description: draft?.description ?? item.description ?? null,
            category: draft?.category ?? item.category ?? null,
            itemSpecifics: draft?.itemSpecifics ?? null,
            priceCents: draft?.priceCents ?? 1000,
            status: publishResult.status ?? 'active',
          },
        });
        listingId = createdListing.id;
      }

      await this.updatePublishState(inventoryItemId, {
        publishStatus: 'PUBLISHED',
        publishMarketplace: marketplace,
        publishedAt: new Date(),
        publishFailedAt: null,
        publishError: null,
      });

      await this.syncInventoryWorkflowState(inventoryItemId);
      this.logger.log(`publish completed for ${inventoryItemId} as listing ${listingId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish failure';
      await this.updatePublishState(inventoryItemId, {
        publishStatus: 'FAILED',
        publishMarketplace: marketplace,
        publishFailedAt: new Date(),
        publishError: message,
      });
      this.logger.error(`publish failed ${inventoryItemId}: ${message}`);
    }
  }

  onApplicationBootstrap() {
    this.worker?.on('failed', (job, err) => {
      this.logger.error(`publish failed ${job?.id}: ${err.message}`);
    });
  }

  private async syncInventoryWorkflowState(inventoryItemId: string) {
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
        aiListingSuggestions: {
          where: {
            status: { not: 'FAILED' },
          },
          take: 1,
        },
      },
    } as any);

    if (!item) {
      return;
    }

    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const draftMissingFields = getDraftMissingFields(item.listingDraft);
    const hasPublishableDraft = hasPublishableListingDraft(item.listingDraft);
    const hasActiveListing = (item.listings ?? []).length > 0;
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: (item.aiListingSuggestions ?? []).length > 0,
      hasDraft: Boolean(item.listingDraft),
      hasPublishableDraft,
      draftMissingFields,
      hasActiveListing,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        listingReadiness: determineListingReadiness(snapshot),
        saleStatus: determineSaleStatus(item.saleStatus ?? 'AVAILABLE', hasActiveListing),
      },
    } as any);
  }

  private async updatePublishState(
    inventoryItemId: string,
    data: {
      publishStatus: 'BLOCKED' | 'PROCESSING' | 'UNAVAILABLE' | 'FAILED' | 'PUBLISHED';
      publishMarketplace: string;
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
      message: getPublishStateMessage({
        status: updated?.publishStatus ?? data.publishStatus,
        marketplace: updated?.publishMarketplace ?? data.publishMarketplace,
        error: updated?.publishError ?? data.publishError,
      }),
    };
  }
}
