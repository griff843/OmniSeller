import { proxyApi } from '@/lib/api-base';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();

  return proxyApi(`/ebay/price-intelligence/sold-comps${query ? `?${query}` : ''}`);
}
