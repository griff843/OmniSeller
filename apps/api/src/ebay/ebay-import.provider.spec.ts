import fetch from 'node-fetch';
import { EbayImportProvider } from './ebay-import.provider';

jest.mock('node-fetch', () => jest.fn());

describe('EbayImportProvider', () => {
  const mockedFetch = fetch as unknown as jest.Mock;
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EBAY_API_BASE') return 'https://api.ebay.test';
      if (key === 'EBAY_IMPORT_MAX_PAGES') return '1';
      return undefined;
    }),
  };
  const tokenService = {
    getValidAccessToken: jest.fn().mockResolvedValue('access-token'),
  };
  const provider = new EbayImportProvider(configService as any, tokenService as any);
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

  it('maps active eBay offers and inventory item details into imported listings', async () => {
    mockedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          total: 1,
          offers: [
            {
              offerId: 'offer_1',
              sku: 'SKU-1',
              availableQuantity: 2,
              categoryId: '1234',
              listingDescription: 'Offer description',
              pricingSummary: { price: { value: '42.50' } },
              listing: {
                listingId: '987654321',
                listingStatus: 'ACTIVE',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          product: {
            title: 'Vintage jacket',
            aspects: { Brand: ['Levi'] },
          },
        }),
      });

    const snapshot = await provider.fetchSnapshot(account as any, { resources: ['LISTINGS'] });

    expect(snapshot.listings).toEqual([
      expect.objectContaining({
        marketplaceItemId: '987654321',
        offerId: 'offer_1',
        listingUrl: 'https://www.ebay.com/itm/987654321',
        title: 'Vintage jacket',
        category: '1234',
        priceCents: 4250,
        quantity: 2,
        status: 'active',
      }),
    ]);
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://api.ebay.test/sell/inventory/v1/offer?limit=100&offset=0',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      }),
    );
  });

  it('maps recent eBay orders into imported orders', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        total: 1,
        orders: [
          {
            orderId: 'ORDER-1',
            creationDate: '2026-05-30T12:00:00.000Z',
            buyer: {
              username: 'buyer1',
              buyerRegistrationAddress: {
                fullName: 'Buyer One',
                email: 'buyer@example.com',
                primaryPhone: { phoneNumber: '555-0101' },
              },
            },
            fulfillmentStartInstructions: [
              {
                shippingStep: {
                  shipTo: {
                    fullName: 'Buyer One',
                    contactAddress: {
                      addressLine1: '123 Main',
                      city: 'Austin',
                      stateOrProvince: 'TX',
                      postalCode: '78701',
                      countryCode: 'US',
                    },
                  },
                },
              },
            ],
            pricingSummary: {
              total: { value: '67.00' },
              deliveryCost: { value: '10.00' },
              tax: { value: '7.00' },
            },
            lineItems: [
              {
                lineItemId: 'LINE-1',
                legacyItemId: '987654321',
                title: 'Vintage jacket',
                quantity: 1,
                total: { value: '50.00' },
              },
            ],
          },
        ],
      }),
    });

    const snapshot = await provider.fetchSnapshot(account as any, { resources: ['ORDERS'] });

    expect(snapshot.orders).toEqual([
      expect.objectContaining({
        marketplaceOrderId: 'ORDER-1',
        buyerName: 'Buyer One',
        buyerEmail: 'buyer@example.com',
        shippingAddress1: '123 Main',
        totalCents: 6700,
        shippingCents: 1000,
        taxCents: 700,
        feeCents: 0,
        items: [
          expect.objectContaining({
            marketplaceLineItemId: 'LINE-1',
            marketplaceItemId: '987654321',
            salePriceCents: 5000,
          }),
        ],
      }),
    ]);
    expect(snapshot.cursors?.ORDERS).toContain('windowEnd');
  });
});
