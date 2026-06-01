import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketplaceAccount, prisma } from '@omniseller/db';
import fetch from 'node-fetch';

type RefreshedEbayToken = {
  accessToken: string;
  expiresAt: Date;
};

@Injectable()
export class EbayTokenService {
  constructor(private readonly configService: ConfigService) {}

  async getValidAccessToken(account: MarketplaceAccount): Promise<string> {
    const expiresAt = account.expiresAt ? new Date(account.expiresAt) : null;

    if (account.accessToken && expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
      return account.accessToken;
    }

    if (!account.refreshToken) {
      throw new BadRequestException(`Marketplace account ${account.id} is missing refreshToken`);
    }

    const refreshed = await this.refreshToken(account.refreshToken);

    await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      },
    });

    return refreshed.accessToken;
  }

  private async refreshToken(refreshToken: string): Promise<RefreshedEbayToken> {
    const clientId = this.configService.get<string>('EBAY_CLIENT_ID');
    const clientSecret = this.configService.get<string>('EBAY_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Missing eBay OAuth client credentials');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(this.getTokenUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope:
          'https://api.ebay.com/oauth/api_scope ' +
          'https://api.ebay.com/oauth/api_scope/sell.account ' +
          'https://api.ebay.com/oauth/api_scope/sell.fulfillment ' +
          'https://api.ebay.com/oauth/api_scope/sell.inventory ' +
          'https://api.ebay.com/oauth/api_scope/sell.item ' +
          'https://api.ebay.com/oauth/api_scope/sell.offer ' +
          'https://api.ebay.com/oauth/api_scope/sell.marketing ' +
          'https://api.ebay.com/oauth/api_scope/sell.finances ' +
          'https://api.ebay.com/oauth/api_scope/sell.analytics',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new InternalServerErrorException(`Failed to refresh eBay token: ${response.status} ${body}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private getTokenUrl() {
    if (this.configService.get<string>('EBAY_TOKEN_URL')) {
      return this.configService.get<string>('EBAY_TOKEN_URL') as string;
    }

    return this.configService.get<string>('EBAY_ENV') === 'SANDBOX'
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
  }
}
