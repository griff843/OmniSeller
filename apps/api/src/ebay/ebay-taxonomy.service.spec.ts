import { BadRequestException, NotFoundException } from '@nestjs/common';
import fetch from 'node-fetch';
import { EbayTaxonomyService } from './ebay-taxonomy.service';

jest.mock('node-fetch', () => jest.fn());
jest.mock('@omniseller/db', () => ({
  prisma: {
    marketplaceAccount: {
      findFirst: jest.fn(),
    },
  },
}));

describe('EbayTaxonomyService', () => {
  const mockedFetch = fetch as unknown as jest.Mock;
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EBAY_API_BASE') return 'https://api.ebay.test';
      if (key === 'EBAY_TAXONOMY_ASPECT_VALUE_LIMIT') return '2';
      return undefined;
    }),
  };
  const tokenService = {
    getValidAccessToken: jest.fn().mockResolvedValue('access-token'),
  };
  const service = new EbayTaxonomyService(configService as any, tokenService as any);
  const account = {
    id: 'acct_1',
    userId: 'user_1',
    kind: 'ebay',
    siteId: 'EBAY-US',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketplaceAccount.findFirst.mockResolvedValue(account);
  });

  it('returns category suggestions with breadcrumbs for the connected marketplace', async () => {
    mockedFetch
      .mockResolvedValueOnce(response(200, { categoryTreeId: '0', categoryTreeVersion: '123' }))
      .mockResolvedValueOnce(
        response(200, {
          categorySuggestions: [
            {
              category: { categoryId: '31388', categoryName: 'Film Cameras' },
              categoryTreeNodeAncestors: [
                { categoryId: '15230', categoryName: 'Film Photography', categoryTreeNodeLevel: 2 },
                { categoryId: '625', categoryName: 'Cameras & Photo', categoryTreeNodeLevel: 1 },
              ],
              categoryTreeNodeLevel: 3,
              relevancy: '0.98',
            },
          ],
        }),
      );

    const result = await service.suggestCategories('vintage camera', 'user_1');

    expect(mockedFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.ebay.test/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=EBAY_US',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.ebay.test/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=vintage+camera',
      expect.any(Object),
    );
    expect(result).toEqual({
      marketplaceId: 'EBAY_US',
      categoryTreeId: '0',
      categoryTreeVersion: '123',
      suggestions: [
        {
          categoryId: '31388',
          categoryName: 'Film Cameras',
          categoryTreeNodeLevel: 3,
          relevancy: '0.98',
          breadcrumb: 'Cameras & Photo > Film Photography > Film Cameras',
        },
      ],
    });
  });

  it('returns category aspect metadata with required flags and capped values', async () => {
    mockedFetch
      .mockResolvedValueOnce(response(200, { categoryTreeId: '0', categoryTreeVersion: '123' }))
      .mockResolvedValueOnce(
        response(200, {
          aspects: [
            {
              localizedAspectName: 'Brand',
              aspectConstraint: {
                aspectRequired: true,
                aspectUsage: 'REQUIRED',
                aspectMode: 'FREE_TEXT',
                itemToAspectCardinality: 'SINGLE',
                aspectDataType: 'STRING',
              },
              aspectValues: [
                { localizedValue: 'Canon' },
                { localizedValue: 'Nikon' },
                { localizedValue: 'Leica' },
              ],
            },
          ],
        }),
      );

    const result = await service.getAspects('31388', 'user_1');

    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.ebay.test/commerce/taxonomy/v1/category_tree/0/get_item_aspects_for_category?category_id=31388',
      expect.any(Object),
    );
    expect(result.aspects).toEqual([
      {
        name: 'Brand',
        required: true,
        usage: 'REQUIRED',
        mode: 'FREE_TEXT',
        cardinality: 'SINGLE',
        dataType: 'STRING',
        values: ['Canon', 'Nikon'],
      },
    ]);
  });

  it('rejects empty taxonomy requests and missing eBay connections', async () => {
    await expect(service.suggestCategories('', 'user_1')).rejects.toBeInstanceOf(BadRequestException);

    prisma.marketplaceAccount.findFirst.mockResolvedValue(null);

    await expect(service.getAspects('31388', 'user_1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  };
}
