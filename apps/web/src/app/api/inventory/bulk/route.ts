import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request) {
  return proxyApi('/inventory/bulk', {
    method: 'POST',
    body: await request.text(),
  });
}
