import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { EbayPublishProvider } from './ebay-publish.provider';

jest.mock('node-fetch', () => jest.fn());

describe('EbayPublishProvider', () => {
  const settings: Record<string, string> = {
    EBAY_API_BASE: 'https://api.sandbox.ebay.com',
    EBAY_ENV: 'SANDBOX',
    EBAY_MARKETPLACE_ID: 'EBAY_US',
    EBAY_MERCHANT_LOCATION_KEY: 'main-warehouse',
    EBAY_PAYMENT_POLICY_ID: 'payment-policy',
    EBAY_RETURN_POLICY_ID: 'return-policy',
    EBAY_FULFILLMENT_POLICY_ID: 'fulfillment-policy',
  };
  const config = { get: jest.fn((name: string) => settings[name]) } as unknown as ConfigService;
  const provider = new EbayPublishProvider(config);
  const mockedFetch = fetch as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports unavailable when policy configuration is incomplete', () => {
    const incompleteProvider = new EbayPublishProvider({ get: jest.fn(() => undefined) } as unknown as ConfigService);

    expect(
      incompleteProvider.getAvailability('ebay', { id: 'account_1', kind: 'ebay', accessToken: 'secret-token' }),
    ).toEqual(
      expect.objectContaining({
        available: false,
        reason: expect.stringContaining('EBAY_MERCHANT_LOCATION_KEY'),
      }),
    );
  });

  it('maps the draft, creates an offer, and publishes without logging the access token', async () => {
    mockedFetch
      .mockResolvedValueOnce(response(204, ''))
      .mockResolvedValueOnce(response(200, JSON.stringify({ offers: [] })))
      .mockResolvedValueOnce(response(201, JSON.stringify({ offerId: 'offer-123' })))
      .mockResolvedValueOnce(response(200, JSON.stringify({ listingId: 'listing-456' })));

    const result = await provider.publishDraft({
      marketplace: 'ebay',
      marketplaceAccount: { id: 'account_1', kind: 'ebay', accessToken: 'secret-token' },
      inventoryItem: {
        sku: 'CAMERA-1',
        condition: 'Used - Very Good',
        photos: [{ uploadStatus: 'READY', url: 'https://images.example/camera.jpg', isPrimary: true, sort: 0 }],
      },
      draft: {
        title: 'Vintage camera',
        description: 'Tested working camera.',
        category: '31388',
        priceCents: 12999,
        itemSpecifics: { Brand: 'Canon' },
      },
    });

    expect(result).toEqual({
      marketplaceItemId: 'listing-456',
      offerId: 'offer-123',
      listingUrl: 'https://www.sandbox.ebay.com/itm/listing-456',
      status: 'active',
    });
    expect(mockedFetch).toHaveBeenCalledTimes(4);
    expect(JSON.parse(mockedFetch.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        condition: 'USED_VERY_GOOD',
        product: expect.objectContaining({ aspects: { Brand: ['Canon'] } }),
      }),
    );
    expect(JSON.parse(mockedFetch.mock.calls[2][1].body)).toEqual(
      expect.objectContaining({
        categoryId: '31388',
        pricingSummary: { price: { currency: 'USD', value: '129.99' } },
      }),
    );
  });

  it('reuses an existing unpublished offer to prevent duplicate offer creation on retry', async () => {
    mockedFetch
      .mockResolvedValueOnce(response(204, ''))
      .mockResolvedValueOnce(response(200, JSON.stringify({ offers: [{ offerId: 'offer-existing' }] })))
      .mockResolvedValueOnce(response(200, JSON.stringify({ listingId: 'listing-existing' })));

    await provider.publishDraft({
      marketplace: 'ebay',
      marketplaceAccount: { id: 'account_1', kind: 'ebay', accessToken: 'secret-token' },
      inventoryItem: {
        sku: 'CAMERA-1',
        condition: 'Used',
        photos: [{ uploadStatus: 'READY', url: 'https://images.example/camera.jpg', isPrimary: true, sort: 0 }],
      },
      draft: { title: 'Camera', description: 'Camera description', category: '31388', priceCents: 10000 },
    });

    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(mockedFetch.mock.calls[2][0]).toContain('/offer/offer-existing/publish');
  });

  it('normalizes provider errors without exposing authorization credentials', async () => {
    mockedFetch.mockResolvedValueOnce(
      response(400, JSON.stringify({ errors: [{ longMessage: 'The category is invalid.' }] })),
    );

    await expect(
      provider.publishDraft({
        marketplace: 'ebay',
        marketplaceAccount: { id: 'account_1', kind: 'ebay', accessToken: 'secret-token' },
        inventoryItem: {
          sku: 'CAMERA-1',
          condition: 'Used',
          photos: [{ uploadStatus: 'READY', url: 'https://images.example/camera.jpg', isPrimary: true, sort: 0 }],
        },
        draft: { title: 'Camera', description: 'Description', category: '31388', priceCents: 10000 },
      }),
    ).rejects.toThrow('Unable to create or update the eBay inventory item: eBay returned 400 — The category is invalid.');
  });
});

function response(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body),
  };
}
