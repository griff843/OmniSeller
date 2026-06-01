import fetch from 'node-fetch';
import { EbayTokenService } from './ebay-token.service';

jest.mock('node-fetch', () => jest.fn());
jest.mock('@omniseller/db', () => ({
  prisma: {
    marketplaceAccount: {
      update: jest.fn(),
    },
  },
}));

describe('EbayTokenService', () => {
  const mockedFetch = fetch as unknown as jest.Mock;
  const { prisma }: { prisma: any } = jest.requireMock('@omniseller/db');
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'EBAY_CLIENT_ID') return 'client-id';
      if (key === 'EBAY_CLIENT_SECRET') return 'client-secret';
      if (key === 'EBAY_TOKEN_URL') return 'https://api.ebay.test/identity/v1/oauth2/token';
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.marketplaceAccount.update.mockResolvedValue({});
    mockedFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        expires_in: 7200,
      }),
    });
  });

  it('requests the marketplace insights scope when refreshing access tokens', async () => {
    const service = new EbayTokenService(configService as any);

    await service.getValidAccessToken({
      id: 'acct_1',
      accessToken: 'expired-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    } as any);

    const body = mockedFetch.mock.calls[0][1].body as URLSearchParams;

    expect(body.get('scope')?.split(' ')).toContain('https://api.ebay.com/oauth/api_scope/buy.marketplace.insights');
  });
});
