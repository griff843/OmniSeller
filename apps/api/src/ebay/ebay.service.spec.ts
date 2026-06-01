import { EbayService } from './ebay.service';

describe('EbayService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EBAY_CLIENT_ID') return 'client-id';
      if (key === 'EBAY_REDIRECT_URI') return 'https://app.example.com/api/ebay/callback';
      if (key === 'EBAY_ENV') return 'PRODUCTION';
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the marketplace insights scope for sold comps', () => {
    const service = new EbayService(configService as any);
    const url = new URL(service.getAuthorizeUrl());
    const scopes = url.searchParams.get('scope')?.split(' ') ?? [];

    expect(scopes).toContain('https://api.ebay.com/oauth/api_scope/buy.marketplace.insights');
  });
});
