import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';

const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID!;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET!;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI!;
const EBAY_ENV = process.env.EBAY_ENV || 'PRODUCTION';

@Injectable()
export class EbayService {
  getAuthorizeUrl() {
    const scope = encodeURIComponent(
      [
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
        'https://api.ebay.com/oauth/api_scope/sell.account',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.item',
        'https://api.ebay.com/oauth/api_scope/sell.offer',
        'https://api.ebay.com/oauth/api_scope/sell.marketing',
        'https://api.ebay.com/oauth/api_scope/sell.finances',
        'https://api.ebay.com/oauth/api_scope/sell.analytics',
      ].join(' ')
    );
    const base =
      EBAY_ENV === 'PRODUCTION'
        ? 'https://auth.ebay.com/oauth2/authorize'
        : 'https://auth.sandbox.ebay.com/oauth2/authorize';
    const url = `${base}?client_id=${encodeURIComponent(
      EBAY_CLIENT_ID
    )}&response_type=code&redirect_uri=${encodeURIComponent(EBAY_REDIRECT_URI)}&scope=${scope}`;
    return url;
  }

  async exchangeCode(code: string) {
    const tokenUrl =
      EBAY_ENV === 'PRODUCTION'
        ? 'https://api.ebay.com/identity/v1/oauth2/token'
        : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('redirect_uri', EBAY_REDIRECT_URI);

    const auth = Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64');
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!r.ok) throw new Error(`eBay token exchange failed: ${r.status} ${await r.text()}`);
    const j = (await r.json()) as any;
    // TODO: persist tokens in MarketplaceAccount table
    console.log('eBay tokens received', Object.keys(j));
    return j;
  }
}
