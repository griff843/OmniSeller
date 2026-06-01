import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EbayPriceIntelligenceService } from './ebay-price-intelligence.service';

jest.mock('@omniseller/db', () => ({
  prisma: {
    marketplaceAccount: {
      findFirst: jest.fn(),
    },
  },
}));

describe('EbayPriceIntelligenceService', () => {
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const provider = {
    getAvailability: jest.fn(),
    fetchSoldComps: jest.fn(),
  };
  const service = new EbayPriceIntelligenceService(provider as any);
  const account = {
    id: 'acct_1',
    userId: 'user_1',
    kind: 'ebay',
    siteId: 'EBAY-US',
    refreshToken: 'refresh',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketplaceAccount.findFirst.mockResolvedValue(account);
    provider.getAvailability.mockReturnValue({ available: true });
    provider.fetchSoldComps.mockResolvedValue({ provider: 'ebay', comps: [] });
  });

  it('returns provider availability without requiring a connected account', async () => {
    provider.getAvailability.mockReturnValue({
      available: false,
      reason: 'Set EBAY_PRICE_INTELLIGENCE_ENABLED=true to enable eBay sold comps lookup.',
    });
    prisma.marketplaceAccount.findFirst.mockResolvedValue(null);

    await expect(service.getStatus('user_1')).resolves.toEqual({
      provider: 'ebay',
      available: false,
      reason: 'Set EBAY_PRICE_INTELLIGENCE_ENABLED=true to enable eBay sold comps lookup.',
      accountId: null,
    });
    expect(provider.getAvailability).toHaveBeenCalledWith(null);
  });

  it('passes normalized sold comps requests to the provider for connected accounts', async () => {
    await service.getSoldComps(
      {
        q: 'camera',
        categoryId: '31388',
        marketplaceId: 'EBAY_US',
        limit: 5,
      },
      'user_1',
    );

    expect(provider.fetchSoldComps).toHaveBeenCalledWith(account, {
      q: 'camera',
      categoryId: '31388',
      marketplaceId: 'EBAY_US',
      limit: 5,
    });
  });

  it('blocks sold comps when eBay is missing or the provider is unavailable', async () => {
    prisma.marketplaceAccount.findFirst.mockResolvedValueOnce(null);

    await expect(service.getSoldComps({ q: 'camera' }, 'user_1')).rejects.toBeInstanceOf(NotFoundException);

    provider.getAvailability.mockReturnValueOnce({
      available: false,
      reason: 'Set EBAY_PRICE_INTELLIGENCE_ENABLED=true to enable eBay sold comps lookup.',
    });

    await expect(service.getSoldComps({ q: 'camera' }, 'user_1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
