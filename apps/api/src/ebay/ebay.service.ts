import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount, prisma } from '@omniseller/db';
import fetch from 'node-fetch';
import { resolveUserId } from '../common/user-context';

type EbayTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

@Injectable()
export class EbayService {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizeUrl() {
    const clientId = this.configService.get<string>('EBAY_CLIENT_ID');
    const redirectUri = this.configService.get<string>('EBAY_REDIRECT_URI');

    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException('eBay OAuth is not configured. Set EBAY_CLIENT_ID and EBAY_REDIRECT_URI.');
    }

    const scope = encodeURIComponent(
      [
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.item',
        'https://api.ebay.com/oauth/api_scope/sell.offer',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
        'https://api.ebay.com/oauth/api_scope/sell.finances',
        'https://api.ebay.com/oauth/api_scope/sell.analytics',
        'https://api.ebay.com/oauth/api_scope/buy.marketplace.insights',
      ].join(' '),
    );
    const base =
      this.getEbayEnvironment() === 'PRODUCTION'
        ? 'https://auth.ebay.com/oauth2/authorize'
        : 'https://auth.sandbox.ebay.com/oauth2/authorize';

    return `${base}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
  }

  async exchangeCode(code: string, userId?: string) {
    const ownerId = resolveUserId(userId);
    const clientId = this.configService.get<string>('EBAY_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EBAY_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('EBAY_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('eBay OAuth is not configured. Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_REDIRECT_URI.');
    }

    const tokenUrl =
      this.getEbayEnvironment() === 'PRODUCTION'
        ? 'https://api.ebay.com/identity/v1/oauth2/token'
        : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', redirectUri);

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new InternalServerErrorException(`eBay token exchange failed: ${response.status} ${await response.text()}`);
    }

    const token = (await response.json()) as EbayTokenResponse;
    const existing = await this.findLatestEbayAccount(ownerId);
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;

    const account = existing
      ? await prisma.marketplaceAccount.update({
          where: { id: existing.id },
          data: {
            siteId: this.configService.get<string>('EBAY_SITE_ID') ?? existing.siteId ?? 'EBAY-US',
            nickname: existing.nickname ?? 'eBay',
            accessToken: token.access_token,
            refreshToken: token.refresh_token ?? existing.refreshToken,
            expiresAt,
          },
        })
      : await prisma.marketplaceAccount.create({
          data: {
            userId: ownerId,
            kind: 'ebay',
            siteId: this.configService.get<string>('EBAY_SITE_ID') ?? 'EBAY-US',
            nickname: 'eBay',
            accessToken: token.access_token,
            refreshToken: token.refresh_token ?? null,
            expiresAt,
          },
        });

    return this.serializeConnectionHealth(account);
  }

  async getConnectionHealth(userId?: string) {
    const ownerId = resolveUserId(userId);

    if (!this.configService.get<string>('EBAY_CLIENT_ID') || !this.configService.get<string>('EBAY_CLIENT_SECRET')) {
      return {
        connected: false,
        status: 'misconfigured',
        message: 'Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to enable eBay OAuth.',
      };
    }

    const account = await this.findLatestEbayAccount(ownerId);

    if (!account) {
      return {
        connected: false,
        status: 'not_connected',
        message: 'Connect an eBay marketplace account before publishing or importing marketplace activity.',
      };
    }

    return this.serializeConnectionHealth(account);
  }

  private async findLatestEbayAccount(userId: string) {
    return prisma.marketplaceAccount.findFirst({
      where: {
        userId,
        kind: 'ebay',
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private serializeConnectionHealth(account: MarketplaceAccount) {
    const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;
    const hasRefreshToken = Boolean(account.refreshToken);
    const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false;
    const status = !hasRefreshToken ? 'needs_reconnect' : expired ? 'access_expired' : 'connected';

    return {
      connected: status === 'connected',
      status,
      accountId: account.id,
      kind: account.kind,
      siteId: account.siteId,
      nickname: account.nickname,
      accessTokenExpiresAt: expiresAt,
      hasRefreshToken,
      message:
        status === 'connected'
          ? 'eBay is connected and ready for marketplace workflows.'
          : status === 'access_expired'
            ? 'eBay access token is expired; reconnect or refresh before publishing.'
            : 'eBay credentials are incomplete. Reconnect the marketplace account.',
    };
  }

  private getEbayEnvironment() {
    return this.configService.get<string>('EBAY_ENV') || 'PRODUCTION';
  }
}
