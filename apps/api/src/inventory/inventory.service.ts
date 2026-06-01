import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhotoAssetRole, PhotoUploadStatus, prisma } from '@omniseller/db';
import { CompletePhotoUploadDto } from './dto/complete-photo-upload.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreatePhotoUploadRequestDto } from './dto/create-photo-upload-request.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import {
  buildGeneratedSku,
  buildReadinessBlockers,
  determineListingReadiness,
  determineSaleStatus,
  isPublishReady,
  normalizeSku,
  type InventoryStatusValue,
  type SaleLifecycleStatusValue,
} from './inventory-workflow-state';
import { InventoryScannerService } from './inventory-scanner.service';
import { PhotoProcessingService } from './photo-processing.service';
import { PhotoStoragePathService } from './photo-storage-path.service';
import { getPublishStateMessage, isPublishInFlight } from '../listings/publish-state';
import { DEV_USER_ID, ownsRecord, resolveUserId } from '../common/user-context';
import { getDraftMissingFields, hasPublishableListingDraft } from '../listings/listing-draft-readiness';

@Injectable()
export class InventoryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly photoProcessingService: PhotoProcessingService,
    private readonly photoStoragePathService: PhotoStoragePathService,
    private readonly inventoryScannerService: InventoryScannerService,
  ) {}

  async list(query: ListInventoryQueryDto = {}, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const normalizedQuery = query.q?.trim();
    const normalizedBinCode = query.binCode ? normalizeSku(query.binCode) : undefined;

    const where: any = {
      userId: ownerId,
    };

    if (normalizedQuery) {
      where.OR = [
        { sku: { contains: normalizedQuery, mode: 'insensitive' } },
        { title: { contains: normalizedQuery, mode: 'insensitive' } },
        { brand: { contains: normalizedQuery, mode: 'insensitive' } },
        { model: { contains: normalizedQuery, mode: 'insensitive' } },
        { upc: { contains: normalizedQuery, mode: 'insensitive' } },
        { scanCode: { contains: normalizedQuery, mode: 'insensitive' } },
      ];
    }

    if (normalizedBinCode) {
      where.bin = { is: { code: normalizedBinCode } };
    }

    if (query.inventoryStatus) {
      where.inventoryStatus = query.inventoryStatus;
    }

    if (query.listingReadiness) {
      where.listingReadiness = query.listingReadiness;
    }

    if (query.saleStatus) {
      where.saleStatus = query.saleStatus;
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: this.buildListSort(query.sort),
      include: this.inventoryInclude(),
    } as any);

    return {
      items: items.map((item: any) => this.serializeInventoryItem(item)),
      filters: query,
    };
  }

  async listBins(userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const bins = await prisma.bin.findMany({
      where: {
        userId: ownerId,
        isActive: true,
      },
      orderBy: [{ area: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    } as any);

    return bins.map((bin: any) => ({
      id: bin.id,
      code: bin.code,
      label: bin.label,
      area: bin.area,
      note: bin.note,
      sortOrder: bin.sortOrder,
      isActive: bin.isActive,
      itemCount: bin._count.items,
      createdAt: bin.createdAt,
      updatedAt: bin.updatedAt,
    }));
  }

  async create(data: CreateInventoryItemDto, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    await this.ensureUser(ownerId);

    const id = randomUUID();
    const createdAt = new Date();
    const manualSku = data.sku ? normalizeSku(data.sku) : null;
    const sku = manualSku && manualSku.length > 0 ? manualSku : buildGeneratedSku({ id, createdAt });

    if (sku.length < 4) {
      throw new BadRequestException('SKU must be at least 4 characters after normalization');
    }

    const bin = data.binCode ? await this.findOrCreateBin(data.binCode, ownerId) : null;

    const item = await prisma.inventoryItem.create({
      data: {
        id,
        userId: ownerId,
        sku,
        skuManuallySet: Boolean(manualSku),
        title: data.title?.trim() || null,
        binId: bin?.id ?? null,
        inventoryStatus: (bin ? 'IN_STOCK' : 'DRAFT') as any,
        listingReadiness: (data.title?.trim() ? 'NEEDS_PHOTOS' : 'NEEDS_INTAKE') as any,
      },
      include: this.inventoryInclude(),
    } as any);

    return this.serializeInventoryItem(item);
  }

  async get(id: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id },
      include: this.inventoryInclude(),
    } as any);

    if (!item || !ownsRecord(item.userId, ownerId)) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }

    return this.serializeInventoryItem(item);
  }

  async update(id: string, dto: UpdateInventoryItemDto, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const existing: any = await prisma.inventoryItem.findUnique({
      where: { id },
      include: this.inventoryInclude(),
    } as any);

    if (!existing || !ownsRecord(existing.userId, ownerId)) {
      throw new NotFoundException(`Inventory item ${id} not found`);
    }

    const nextSku = dto.sku !== undefined ? normalizeSku(dto.sku) : existing.sku;

    if (!nextSku || nextSku.length < 4) {
      throw new BadRequestException('SKU must be at least 4 characters after normalization');
    }

    const resolvedBin = dto.binCode === undefined
      ? existing.bin
      : dto.binCode === null || dto.binCode.trim().length === 0
        ? null
        : await this.findOrCreateBin(dto.binCode, ownerId);

    const normalizedScanCode = dto.scanCode !== undefined && dto.scanCode !== null
      ? this.inventoryScannerService.normalizeScanCode(dto.scanCode)
      : dto.scanCode;

    await prisma.inventoryItem.update({
      where: { id },
      data: {
        sku: nextSku,
        skuManuallySet: dto.sku !== undefined ? true : existing.skuManuallySet,
        ...(dto.title !== undefined ? { title: dto.title.trim() || null } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() || null } : {}),
        ...(dto.condition !== undefined ? { condition: dto.condition.trim() || null } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand.trim() || null } : {}),
        ...(dto.model !== undefined ? { model: dto.model.trim() || null } : {}),
        ...(dto.upc !== undefined ? { upc: dto.upc.trim() || null } : {}),
        ...(dto.scanCode !== undefined ? { scanCode: normalizedScanCode || null } : {}),
        ...(dto.binCode !== undefined ? { binId: resolvedBin?.id ?? null } : {}),
        ...(dto.inventoryStatus !== undefined ? { inventoryStatus: dto.inventoryStatus as any } : {}),
        ...(dto.saleStatus !== undefined ? { saleStatus: dto.saleStatus as any } : {}),
      },
    } as any);

    await this.syncWorkflowState(id);
    return this.get(id, ownerId);
  }

  async createPhotoUploadRequests(inventoryItemId: string, dto: CreatePhotoUploadRequestDto, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: {
        photos: {
          where: { deletedAt: null },
          orderBy: [{ sort: 'desc' }],
        },
      },
    } as any);

    if (!item || !ownsRecord(item.userId, ownerId)) {
      throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
    }

    const nextSortBase = item.photos[0]?.sort ?? -1;
    const hasPrimary = item.photos.some((photo: any) => photo.isPrimary);
    const bucket = this.configService.get<string>('STORAGE_BUCKET') ?? 'omniseller-images';

    const createdPhotos = await prisma.$transaction(
      dto.files.map((file, index) => {
        const photoId = randomUUID();
        const storageKey = this.photoStoragePathService.buildOriginalPhotoKey({
          inventoryItemId: item.id,
          sku: item.sku,
          photoId,
          originalFileName: file.fileName,
          contentType: file.contentType,
        });

        return prisma.photo.create({
          data: {
            id: photoId,
            inventoryItemId: item.id,
            url: null,
            storageBucket: bucket,
            storageKey,
            role: PhotoAssetRole.ORIGINAL,
            uploadStatus: PhotoUploadStatus.PENDING,
            sort: nextSortBase + index + 1,
            isPrimary: !hasPrimary && index === 0,
            originalFileName: file.fileName,
            mimeType: file.contentType,
            fileSizeBytes: file.sizeBytes ?? null,
            metadata: this.photoProcessingService.buildPendingUploadMetadata({ source: 'web-upload' }),
          },
        });
      }),
    );

    return {
      inventoryItemId: item.id,
      uploads: createdPhotos.map((photo: any) => this.serializePhoto(photo)),
    };
  }

  async completePhotoUpload(inventoryItemId: string, photoId: string, dto: CompletePhotoUploadDto & { url: string }, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const photo = await this.requirePhoto(inventoryItemId, photoId, ownerId);

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        url: dto.url,
        uploadStatus: PhotoUploadStatus.READY,
        width: dto.width ?? photo.width,
        height: dto.height ?? photo.height,
        uploadedAt: new Date(),
        metadata: this.photoProcessingService.buildReadyMetadata(photo.metadata, dto.metadata),
      },
    } as any);

    await this.syncWorkflowState(inventoryItemId);
    return this.get(inventoryItemId, ownerId);
  }

  async setPrimaryPhoto(inventoryItemId: string, photoId: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    await this.requirePhoto(inventoryItemId, photoId, ownerId);

    await prisma.$transaction([
      prisma.photo.updateMany({
        where: {
          inventoryItemId,
          deletedAt: null,
          isPrimary: true,
        },
        data: { isPrimary: false },
      }),
      prisma.photo.update({
        where: { id: photoId },
        data: { isPrimary: true },
      }),
    ]);

    return this.get(inventoryItemId, ownerId);
  }

  async reorderPhotos(inventoryItemId: string, dto: ReorderPhotosDto, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    await this.requireInventoryItem(inventoryItemId, ownerId);
    const activePhotos = await prisma.photo.findMany({
      where: {
        inventoryItemId,
        deletedAt: null,
      },
      orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }, { createdAt: 'asc' }],
    } as any);

    if (activePhotos.length !== dto.photoIds.length) {
      throw new BadRequestException('Reorder payload must include every active photo exactly once');
    }

    const activeIds = new Set(activePhotos.map((photo: any) => photo.id));

    for (const photoId of dto.photoIds) {
      if (!activeIds.has(photoId)) {
        throw new BadRequestException(`Photo ${photoId} is not active for inventory item ${inventoryItemId}`);
      }
    }

    const currentPrimaryId = activePhotos.find((photo: any) => photo.isPrimary)?.id ?? dto.photoIds[0];

    await prisma.$transaction(
      dto.photoIds.map((photoId, index) =>
        prisma.photo.update({
          where: { id: photoId },
          data: {
            sort: index,
            isPrimary: photoId === currentPrimaryId,
          },
        }),
      ),
    );

    return this.get(inventoryItemId, ownerId);
  }

  async deletePhoto(inventoryItemId: string, photoId: string, userId?: string): Promise<unknown> {
    const ownerId = resolveUserId(userId);
    const photo = await this.requirePhoto(inventoryItemId, photoId, ownerId);

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        deletedAt: new Date(),
        isPrimary: false,
        uploadStatus: PhotoUploadStatus.DELETED,
      },
    } as any);

    if (photo.isPrimary) {
      const nextPhoto = await prisma.photo.findFirst({
        where: {
          inventoryItemId,
          deletedAt: null,
          id: { not: photoId },
        },
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      } as any);

      if (nextPhoto) {
        await prisma.photo.update({
          where: { id: nextPhoto.id },
          data: { isPrimary: true },
        } as any);
      }
    }

    await this.syncWorkflowState(inventoryItemId);
    return this.get(inventoryItemId, ownerId);
  }

  private inventoryInclude(): any {
    return {
      bin: true,
      photos: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { sort: 'asc' }, { createdAt: 'asc' }],
      },
      listingDraft: true,
      aiListingSuggestions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      listings: {
        orderBy: { createdAt: 'desc' },
      },
    };
  }

  private buildListSort(sort?: string): any {
    switch (sort) {
      case 'sku-asc':
        return [{ sku: 'asc' }];
      case 'sku-desc':
        return [{ sku: 'desc' }];
      case 'updated-desc':
        return [{ updatedAt: 'desc' }];
      case 'title-asc':
        return [{ title: 'asc' }, { createdAt: 'desc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  private async requireInventoryItem(inventoryItemId: string, userId: string) {
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    } as any);

    if (!item || !ownsRecord(item.userId, userId)) {
      throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
    }

    return item;
  }

  private async requirePhoto(inventoryItemId: string, photoId: string, userId: string) {
    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        inventoryItemId,
        deletedAt: null,
        item: {
          userId,
        },
      },
    } as any);

    if (!photo) {
      throw new NotFoundException(`Photo ${photoId} not found for inventory item ${inventoryItemId}`);
    }

    return photo;
  }

  private async findOrCreateBin(input: string, userId: string) {
    await this.ensureUser(userId);

    const code = normalizeSku(input);

    if (!code) {
      throw new BadRequestException('Bin code cannot be empty');
    }

    const existing = await prisma.bin.findFirst({
      where: {
        userId,
        code,
      },
    } as any);

    if (existing) {
      return existing;
    }

    return prisma.bin.create({
      data: {
        userId,
        code,
        label: code,
      },
    } as any);
  }

  private async ensureUser(userId = DEV_USER_ID) {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: userId === DEV_USER_ID ? 'dev-user@local.omniseller' : null,
        name: 'Local Dev User',
      },
    } as any);
  }

  private async syncWorkflowState(inventoryItemId: string) {
    const item: any = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: this.inventoryInclude(),
    } as any);

    if (!item) {
      return;
    }

    const readyPhotoCount = (item.photos ?? []).filter(
      (photo: any) => photo.uploadStatus === 'READY' && Boolean(photo.url),
    ).length;
    const latestSuggestion = item.aiListingSuggestions?.[0] ?? null;
    const hasDraft = Boolean(item.listingDraft);
    const draftMissingFields = getDraftMissingFields(item.listingDraft);
    const hasPublishableDraft = hasPublishableListingDraft(item.listingDraft);
    const hasActiveListing = (item.listings ?? []).length > 0;

    await prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: {
        listingReadiness: determineListingReadiness({
          title: item.title,
          condition: item.condition,
          readyPhotoCount,
          hasSuggestion: Boolean(latestSuggestion),
          hasDraft,
          hasPublishableDraft,
          draftMissingFields,
          hasActiveListing,
          saleStatus: (item.saleStatus ?? 'AVAILABLE') as SaleLifecycleStatusValue,
        }),
        saleStatus: determineSaleStatus((item.saleStatus ?? 'AVAILABLE') as SaleLifecycleStatusValue, hasActiveListing),
      },
    } as any);
  }

  private serializeInventoryItem(item: any) {
    const photos = (item.photos ?? []).map((photo: any) => this.serializePhoto(photo));
    const primaryPhoto = photos.find((photo) => photo.isPrimary) ?? photos[0] ?? null;
    const readyPhotoCount = photos.filter((photo) => photo.uploadStatus === 'READY' && Boolean(photo.url)).length;
    const latestSuggestion = item.aiListingSuggestions?.[0] ?? null;
    const hasDraft = Boolean(item.listingDraft);
    const draftMissingFields = getDraftMissingFields(item.listingDraft);
    const hasPublishableDraft = hasPublishableListingDraft(item.listingDraft);
    const snapshot = {
      title: item.title ?? null,
      condition: item.condition ?? null,
      readyPhotoCount,
      hasSuggestion: Boolean(latestSuggestion),
      hasDraft,
      hasPublishableDraft,
      draftMissingFields,
      hasActiveListing: (item.listings ?? []).length > 0,
      saleStatus: (item.saleStatus ?? 'AVAILABLE') as SaleLifecycleStatusValue,
    } as const;

    const blockers = buildReadinessBlockers(snapshot);
    const publishState = {
      status: item.publishStatus ?? 'NOT_REQUESTED',
      marketplace: item.publishMarketplace ?? 'ebay',
      requestedAt: item.publishRequestedAt ?? null,
      queuedAt: item.publishQueuedAt ?? null,
      startedAt: item.publishStartedAt ?? null,
      publishedAt: item.publishedAt ?? null,
      failedAt: item.publishFailedAt ?? null,
      error: item.publishError ?? null,
    };
    const canRequestPublish = isPublishReady(snapshot) && !isPublishInFlight(publishState.status);

    return {
      id: item.id,
      sku: item.sku,
      skuManuallySet: Boolean(item.skuManuallySet),
      title: item.title ?? null,
      description: item.description ?? null,
      category: item.category ?? null,
      condition: item.condition ?? null,
      brand: item.brand ?? null,
      model: item.model ?? null,
      upc: item.upc ?? null,
      scanCode: item.scanCode ?? null,
      inventoryStatus: (item.inventoryStatus ?? 'DRAFT') as InventoryStatusValue,
      listingReadiness: item.listingReadiness ?? 'NEEDS_INTAKE',
      saleStatus: (item.saleStatus ?? 'AVAILABLE') as SaleLifecycleStatusValue,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      photoCount: photos.length,
      readyPhotoCount,
      primaryPhoto,
      photos,
      bin: item.bin
        ? {
            id: item.bin.id,
            code: item.bin.code,
            label: item.bin.label ?? null,
            area: item.bin.area ?? null,
            note: item.bin.note ?? null,
            sortOrder: item.bin.sortOrder ?? 0,
            isActive: item.bin.isActive ?? true,
          }
        : null,
      listingCount: item.listings?.length ?? 0,
      publishState: {
        ...publishState,
        message: getPublishStateMessage(publishState),
        canRetry: ['NOT_REQUESTED', 'BLOCKED', 'UNAVAILABLE', 'FAILED'].includes(publishState.status),
        isInFlight: isPublishInFlight(publishState.status),
      },
      workflow: {
        canGenerateAi: ['READY_FOR_AI', 'READY_FOR_LISTING', 'READY_TO_PUBLISH', 'LISTED'].includes(item.listingReadiness ?? 'NEEDS_INTAKE'),
        canEditDraft: Boolean(item.title?.trim()) && Boolean(item.condition?.trim()),
        canPublish: isPublishReady(snapshot),
        canRequestPublish,
        publishActionBlockedReason: isPublishReady(snapshot)
          ? isPublishInFlight(publishState.status)
            ? getPublishStateMessage(publishState)
            : null
          : blockers[0] ?? null,
        readinessBlockers: blockers,
      },
      scanner: this.inventoryScannerService.describeFutureLookupBoundary(),
    };
  }

  private serializePhoto(photo: any) {
    return {
      id: photo.id,
      inventoryItemId: photo.inventoryItemId,
      url: photo.url,
      storageBucket: photo.storageBucket,
      storageKey: photo.storageKey,
      role: photo.role,
      uploadStatus: photo.uploadStatus,
      sort: photo.sort,
      isPrimary: photo.isPrimary,
      originalFileName: photo.originalFileName,
      mimeType: photo.mimeType,
      fileSizeBytes: photo.fileSizeBytes,
      width: photo.width,
      height: photo.height,
      metadata: photo.metadata,
      uploadedAt: photo.uploadedAt,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }
}

