import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { AiListingSuggestionStatus, prisma } from '@omniseller/db';
import { ListingAiService } from './listing-ai.service';

jest.mock('@omniseller/db', () => ({
  AiListingSuggestionStatus: {
    GENERATED: 'GENERATED',
    APPLIED: 'APPLIED',
    FAILED: 'FAILED',
  },
  Prisma: {},
  prisma: {
    inventoryItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    aiListingSuggestion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    listingDraft: {
      upsert: jest.fn(),
    },
  },
}));

describe('ListingAiService', () => {
  const provider = {
    isConfigured: jest.fn(),
    generateSuggestion: jest.fn(),
  };

  const service = new ListingAiService(provider as any);
  const mockedPrisma: any = prisma;

  beforeEach(() => {
    jest.clearAllMocks();
    provider.isConfigured.mockReturnValue(true);
  });

  function mockWorkflowRefresh(overrides: Record<string, unknown> = {}) {
    mockedPrisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      title: 'Vintage Camera',
      condition: 'Used',
      saleStatus: 'AVAILABLE',
      photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/photo.jpg' }],
      listingDraft: null,
      listings: [],
      aiListingSuggestions: [],
      ...overrides,
    });
    mockedPrisma.inventoryItem.update.mockResolvedValue({});
  }

  it('persists a generated AI listing suggestion', async () => {
    mockedPrisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      sku: 'SKU-1',
      title: 'Vintage Camera',
      description: 'Working 35mm camera body',
      category: 'Cameras',
      condition: 'Used',
      brand: 'Canon',
      model: 'AE-1',
      upc: null,
      costBasisCents: 2500,
      saleStatus: 'AVAILABLE',
      photos: [{ url: 'https://cdn.test/photo.jpg', isPrimary: true, originalFileName: 'front.jpg', uploadStatus: 'READY' }],
      listingDraft: null,
      listings: [],
      aiListingSuggestions: [],
    });
    provider.generateSuggestion.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o-mini',
      output: {
        title: 'Canon AE-1 35mm Film Camera Body',
        description: 'Clean Canon AE-1 body with visible cosmetic wear and working controls.',
        category: 'Film Cameras',
        priceCents: 14900,
        itemSpecifics: { Brand: 'Canon', Model: 'AE-1' },
      },
      rawResponse: { id: 'resp_1' },
    });
    mockedPrisma.aiListingSuggestion.create.mockResolvedValue({
      id: 'suggestion_1',
      inventoryItemId: 'item_1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptVersion: 'ai-listing-v1',
      status: AiListingSuggestionStatus.GENERATED,
      title: 'Canon AE-1 35mm Film Camera Body',
      description: 'Clean Canon AE-1 body with visible cosmetic wear and working controls.',
      suggestedCategory: 'Film Cameras',
      suggestedPriceCents: 14900,
      itemSpecifics: { Brand: 'Canon', Model: 'AE-1' },
      errorMessage: null,
      generatedAt: new Date('2026-03-11T16:00:00.000Z'),
      appliedAt: null,
      createdAt: new Date('2026-03-11T16:00:00.000Z'),
      updatedAt: new Date('2026-03-11T16:00:00.000Z'),
    });
    mockWorkflowRefresh({ aiListingSuggestions: [{}] });

    const result = (await service.generateSuggestion('item_1', 'dev-user')) as { id: string };

    expect(provider.generateSuggestion).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.aiListingSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inventoryItemId: 'item_1',
          status: AiListingSuggestionStatus.GENERATED,
        }),
      }),
    );
    expect(result.id).toBe('suggestion_1');
  });

  it('reports AI as unavailable without persisting a failed suggestion when no provider key is configured', async () => {
    mockedPrisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      sku: 'SKU-1',
      title: 'Vintage Camera',
      description: null,
      category: null,
      condition: 'Used',
      brand: 'Canon',
      model: 'AE-1',
      upc: null,
      costBasisCents: 2500,
      saleStatus: 'AVAILABLE',
      photos: [{ url: 'https://cdn.test/photo.jpg', isPrimary: true, originalFileName: 'front.jpg', uploadStatus: 'READY' }],
      listingDraft: null,
      listings: [],
      aiListingSuggestions: [],
    });
    provider.isConfigured.mockReturnValue(false);

    await expect(service.generateSuggestion('item_1', 'dev-user')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockedPrisma.aiListingSuggestion.create).not.toHaveBeenCalled();
  });

  it('persists a failed suggestion record when the provider response is malformed', async () => {
    mockedPrisma.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'item_1',
      userId: 'dev-user',
      sku: 'SKU-1',
      title: 'Vintage Camera',
      description: null,
      category: null,
      condition: 'Used',
      brand: 'Canon',
      model: 'AE-1',
      upc: null,
      costBasisCents: 2500,
      saleStatus: 'AVAILABLE',
      photos: [{ url: 'https://cdn.test/photo.jpg', isPrimary: true, originalFileName: 'front.jpg', uploadStatus: 'READY' }],
      listingDraft: null,
      listings: [],
      aiListingSuggestions: [],
    });
    provider.generateSuggestion.mockRejectedValue(new Error('Malformed AI response'));
    mockedPrisma.aiListingSuggestion.create.mockResolvedValue({});
    mockWorkflowRefresh();

    await expect(service.generateSuggestion('item_1', 'dev-user')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    expect(mockedPrisma.aiListingSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiListingSuggestionStatus.FAILED,
          errorMessage: 'Malformed AI response',
        }),
      }),
    );
  });

  it('applies selected AI fields into the listing draft', async () => {
    mockedPrisma.aiListingSuggestion.findFirst.mockResolvedValue({
      id: 'suggestion_1',
      inventoryItemId: 'item_1',
      title: 'Canon AE-1 35mm Film Camera Body',
      description: 'Clean Canon AE-1 body with visible cosmetic wear and working controls.',
      suggestedCategory: 'Film Cameras',
      suggestedPriceCents: 14900,
      itemSpecifics: { Brand: 'Canon', Model: 'AE-1' },
      status: AiListingSuggestionStatus.GENERATED,
    });
    mockedPrisma.listingDraft.upsert.mockResolvedValue({
      id: 'draft_1',
      inventoryItemId: 'item_1',
      marketplace: 'ebay',
      title: 'Canon AE-1 35mm Film Camera Body',
      description: null,
      category: null,
      priceCents: 14900,
      itemSpecifics: {},
      sourceSuggestionId: 'suggestion_1',
      createdAt: new Date('2026-03-11T16:00:00.000Z'),
      updatedAt: new Date('2026-03-11T16:00:00.000Z'),
    });
    mockedPrisma.aiListingSuggestion.update.mockResolvedValue({});
    mockWorkflowRefresh({ listingDraft: { title: 'Canon AE-1 35mm Film Camera Body', description: null, category: null, priceCents: 14900 } });

    const result = (await service.applySuggestion('item_1', {
      suggestionId: 'suggestion_1',
      fields: ['title', 'priceCents'],
    }, 'dev-user')) as { title: string; priceCents: number };

    expect(mockedPrisma.listingDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          title: 'Canon AE-1 35mm Film Camera Body',
          priceCents: 14900,
        }),
      }),
    );
    expect(result.title).toBe('Canon AE-1 35mm Film Camera Body');
    expect(result.priceCents).toBe(14900);
  });

  it('normalizes manual draft specifics before saving', async () => {
    mockedPrisma.listingDraft.upsert.mockResolvedValue({
      id: 'draft_1',
      inventoryItemId: 'item_1',
      marketplace: 'ebay',
      title: 'Draft title',
      description: 'Draft description',
      category: 'Cameras',
      priceCents: 12900,
      itemSpecifics: { Brand: 'Canon' },
      metadata: { ebay: { categoryId: '31388' } },
      sourceSuggestionId: null,
      createdAt: new Date('2026-03-11T16:00:00.000Z'),
      updatedAt: new Date('2026-03-11T16:00:00.000Z'),
    });
    mockWorkflowRefresh({
      listingDraft: {
        title: 'Draft title',
        description: 'Draft description',
        category: 'Cameras',
        priceCents: 12900,
      },
    });

    const result = (await service.updateDraft('item_1', {
      title: 'Draft title',
      itemSpecifics: { ' Brand ': ' Canon ', '': 'ignored' },
      metadata: { ebay: { categoryId: '31388' } },
    }, 'dev-user')) as { itemSpecifics: Record<string, string> };

    expect(mockedPrisma.listingDraft.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          itemSpecifics: { Brand: 'Canon' },
          metadata: { ebay: { categoryId: '31388' } },
        }),
      }),
    );
    expect(result.itemSpecifics).toEqual({ Brand: 'Canon' });
  });
});
