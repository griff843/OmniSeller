import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { prisma } from '@omniseller/db';
import {
  buildReadinessBlockers,
  determineListingReadiness,
  determineSaleStatus,
  isPublishReady,
} from '../inventory/inventory-workflow-state';

const PUBLISH_QUEUE = 'publishListing';

@Processor(PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

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

    const draft = item.listingDraft;
    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const hasPublishableDraft = Boolean(
      draft?.title?.trim() &&
      draft?.description?.trim() &&
      draft?.category?.trim() &&
      draft?.priceCents !== null &&
      draft?.priceCents !== undefined,
    );
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: false,
      hasDraft: Boolean(draft),
      hasPublishableDraft,
      hasActiveListing: (item.listings ?? []).length > 0,
      saleStatus: item.saleStatus ?? 'AVAILABLE',
    } as const;

    if (!isPublishReady(snapshot)) {
      throw new Error(buildReadinessBlockers(snapshot).join(' '));
    }

    const existingListing = await prisma.listing.findFirst({
      where: {
        inventoryItemId,
        marketplace,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingListing) {
      await prisma.listing.update({
        where: { id: existingListing.id },
        data: {
          title: draft?.title ?? existingListing.title,
          description: draft?.description ?? existingListing.description,
          category: draft?.category ?? existingListing.category,
          itemSpecifics: draft?.itemSpecifics ?? existingListing.itemSpecifics,
          priceCents: draft?.priceCents ?? existingListing.priceCents,
          status: 'inactive',
        },
      });
      await this.syncInventoryWorkflowState(inventoryItemId);
      return;
    }

    await prisma.listing.create({
      data: {
        inventoryItemId,
        marketplace,
        marketplaceAccountId: 'dev-ebay',
        title: draft?.title ?? item.title ?? null,
        description: draft?.description ?? item.description ?? null,
        category: draft?.category ?? item.category ?? null,
        itemSpecifics: draft?.itemSpecifics ?? null,
        priceCents: draft?.priceCents ?? 1000,
        status: 'inactive',
      },
    });

    await this.syncInventoryWorkflowState(inventoryItemId);
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
    const hasPublishableDraft = Boolean(
      item.listingDraft?.title?.trim() &&
      item.listingDraft?.description?.trim() &&
      item.listingDraft?.category?.trim() &&
      item.listingDraft?.priceCents !== null &&
      item.listingDraft?.priceCents !== undefined,
    );
    const hasActiveListing = (item.listings ?? []).length > 0;
    const snapshot = {
      title: item.title,
      condition: item.condition,
      readyPhotoCount,
      hasSuggestion: (item.aiListingSuggestions ?? []).length > 0,
      hasDraft: Boolean(item.listingDraft),
      hasPublishableDraft,
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
}
