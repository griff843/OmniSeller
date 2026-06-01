import { ServiceUnavailableException } from '@nestjs/common';
import fetch from 'node-fetch';
import { EbayPriceIntelligenceProvider } from './ebay-price-intelligence.provider';

jest.mock('node-fetch', () => jest.fn());

describe('EbayPriceIntelligenceProvider', () => {
  const mockedFetch = fetch as unknown as jest.Mock;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EBAY_PRICE_INTELLIGENCE_ENABLED') return 'true';
      if (key === 'EBAY_API_BASE') return 'https://api.ebay.test';
      if (key === 'EBAY_PRICE_INTELLIGENCE_LIMIT') return '10';
      return undefined;
    }),
  };
  const tokenService = {
    getValidAccessToken: jest.fn().mockResolvedValue('access-token'),
  };
  const account = {
    id: 'acct_1',
    userId: 'user_1',
    kind: 'ebay',
    siteId: 'EBAY-US',
    nickname: 'Store',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps eBay item sales into stable sold comp DTOs', async () => {
    const provider = new EbayPriceIntelligenceProvider(configService as any, tokenService as any);
    mockedFetch.mockResolvedValueOnce(
      response(200, {
        itemSales: [
          {
            itemId: '1234567890',
            title: 'Vintage camera',
            itemWebUrl: 'https://www.ebay.com/itm/1234567890',
            price: { value: '149.99', currency: 'USD' },
            condition: 'Used',
            itemSoldDate: '2026-05-20T10:00:00.000Z',
            image: { imageUrl: 'https://i.ebayimg.test/camera.jpg' },
          },
        ],
      }),
    );

    const result = await provider.fetchSoldComps(account as any, {
      q: ' vintage camera ',
      categoryId: '31388',
      limit: 5,
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.ebay.test/buy/marketplace_insights/v1_beta/item_sales/search?q=vintage+camera&limit=5&category_ids=31388',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        provider: 'ebay',
        marketplaceId: 'EBAY_US',
        query: {
          q: 'vintage camera',
          categoryId: '31388',
          marketplaceId: 'EBAY_US',
          limit: 5,
        },
        comps: [
          {
            marketplaceItemId: '1234567890',
            title: 'Vintage camera',
            itemUrl: 'https://www.ebay.com/itm/1234567890',
            soldPriceCents: 14999,
            currency: 'USD',
            condition: 'Used',
            soldAt: '2026-05-20T10:00:00.000Z',
            imageUrl: 'https://i.ebayimg.test/camera.jpg',
          },
        ],
      }),
    );
  });

  it('reports unavailable when the feature flag is off', async () => {
    const disabledConfig = {
      get: jest.fn((key: string) => {
        if (key === 'EBAY_PRICE_INTELLIGENCE_ENABLED') return 'false';
        return undefined;
      }),
    };
    const provider = new EbayPriceIntelligenceProvider(disabledConfig as any, tokenService as any);

    expect(provider.getAvailability(account as any)).toEqual({
      available: false,
      reason: 'Set EBAY_PRICE_INTELLIGENCE_ENABLED=true to enable eBay sold comps lookup.',
    });
    await expect(provider.fetchSoldComps(account as any, { q: 'camera' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
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
