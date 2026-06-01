import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { EbayTokenService } from '../../ebay/ebay-token.service';
import { EbayPublishProvider } from './ebay-publish.provider';

jest.mock('node-fetch', () => jest.fn());

describe('EbayPublishProvider', () => {
  const fetchMock = fetch as unknown as jest.Mock;
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        EBAY_API_BASE: 'https://api.test.ebay.com',
        EBAY_MARKETPLACE_ID: 'EBAY_US',
        EBAY_MERCHANT_LOCATION_KEY: 'warehouse-1',
        EBAY_PAYMENT_POLICY_ID: 'payment-1',
        EBAY_FULFILLMENT_POLICY_ID: 'fulfillment-1',
        EBAY_RETURN_POLICY_ID: 'return-1',
        EBAY_CURRENCY: 'USD',
      };

      return values[key];
    }),
  } as unknown as ConfigService;
  const tokenService = {
    getValidAccessToken: jest.fn().mockResolvedValue('access-token'),
  } as unknown as jest.Mocked<EbayTokenService>;
  const provider = new EbayPublishProvider(config, tokenService);
  const account = {
    id: 'acct_1',
    kind: 'ebay',
    siteId: 'EBAY-US',
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  it('publishes a new fixed-price listing through the eBay Inventory API flow', async () => {
    fetchMock
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, { offerId: 'offer_1' }))
      .mockResolvedValueOnce(response(200, { listingId: '1234567890' }));

    const result = await provider.publishDraft({
      marketplace: 'ebay',
      marketplaceAccount: account,
      inventoryItem: {
        id: 'item_1',
        sku: 'SKU 123',
        condition: 'Used',
        photos: [
          { uploadStatus: 'READY', url: 'https://cdn.test/2.jpg', sort: 2 },
          { uploadStatus: 'READY', url: 'https://cdn.test/1.jpg', sort: 1 },
        ],
        listings: [],
      },
      draft: {
        title: 'Vintage camera',
        description: 'Clean tested camera',
        category: '31388',
        priceCents: 19900,
        itemSpecifics: {
          Brand: 'Canon',
          Model: ['AE-1'],
        },
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.test.ebay.com/sell/inventory/v1/inventory_item/SKU-123',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        condition: 'USED',
        product: expect.objectContaining({
          title: 'Vintage camera',
          imageUrls: ['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg'],
          aspects: {
            Brand: ['Canon'],
            Model: ['AE-1'],
          },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.test.ebay.com/sell/inventory/v1/offer',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(
      expect.objectContaining({
        sku: 'SKU-123',
        marketplaceId: 'EBAY_US',
        format: 'FIXED_PRICE',
        availableQuantity: 1,
        categoryId: '31388',
        merchantLocationKey: 'warehouse-1',
        listingPolicies: {
          paymentPolicyId: 'payment-1',
          fulfillmentPolicyId: 'fulfillment-1',
          returnPolicyId: 'return-1',
        },
        pricingSummary: {
          price: {
            currency: 'USD',
            value: '199.00',
          },
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.test.ebay.com/sell/inventory/v1/offer/offer_1/publish',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual({
      marketplaceItemId: '1234567890',
      offerId: 'offer_1',
      listingUrl: 'https://www.ebay.com/itm/1234567890',
      status: 'active',
    });
  });

  it('updates an existing offer without republishing an already active marketplace listing', async () => {
    fetchMock
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(200, { offerId: 'offer_1' }));

    const result = await provider.publishDraft({
      marketplace: 'ebay',
      marketplaceAccount: account,
      inventoryItem: {
        id: 'item_1',
        sku: 'SKU-123',
        condition: 'New',
        photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/1.jpg', sort: 1 }],
        listings: [
          {
            marketplace: 'ebay',
            marketplaceItemId: '1234567890',
            offerId: 'offer_1',
            listingUrl: 'https://www.ebay.com/itm/1234567890',
          },
        ],
      },
      draft: {
        title: 'Updated camera',
        description: 'Updated description',
        category: '31388',
        priceCents: 18900,
        itemSpecifics: {},
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.test.ebay.com/sell/inventory/v1/offer/offer_1',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.marketplaceItemId).toBe('1234567890');
    expect(result.offerId).toBe('offer_1');
  });

  it('reports unavailable when required publish policy configuration is missing', () => {
    const missingConfig = {
      get: jest.fn((key: string) => (key === 'EBAY_MARKETPLACE_ID' ? 'EBAY_US' : undefined)),
    } as unknown as ConfigService;
    const unavailableProvider = new EbayPublishProvider(missingConfig, tokenService);

    const result = unavailableProvider.getAvailability('ebay', account as any);

    expect(result).toEqual({
      available: false,
      reason:
        'Configure eBay publish settings before publishing: EBAY_MERCHANT_LOCATION_KEY, EBAY_PAYMENT_POLICY_ID, EBAY_FULFILLMENT_POLICY_ID, EBAY_RETURN_POLICY_ID.',
    });
  });

  it('fails clearly when a nonnumeric draft category has no default category id', async () => {
    fetchMock.mockResolvedValueOnce(response(204));

    await expect(
      provider.publishDraft({
        marketplace: 'ebay',
        marketplaceAccount: account,
        inventoryItem: {
          id: 'item_1',
          sku: 'SKU-123',
          condition: 'Used',
          photos: [{ uploadStatus: 'READY', url: 'https://cdn.test/1.jpg', sort: 1 }],
          listings: [],
        },
        draft: {
          title: 'Vintage camera',
          description: 'Clean tested camera',
          category: 'Cameras',
          priceCents: 19900,
          itemSpecifics: {},
        },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body ?? {})),
    json: jest.fn().mockResolvedValue(body ?? {}),
  };
}
