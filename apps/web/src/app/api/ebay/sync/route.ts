import { proxyApi } from '@/lib/api-base';

export async function GET() {
  return proxyApi('/ebay/sync/status');
}

export async function POST(req: Request) {
  const body = await req.text();

  return proxyApi('/ebay/sync', {
    method: 'POST',
    body: body || JSON.stringify({ resource: 'ALL' }),
  });
}
