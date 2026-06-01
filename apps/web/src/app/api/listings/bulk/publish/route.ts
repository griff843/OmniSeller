import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request) {
  return proxyApi('/listings/bulk/publish', {
    method: 'POST',
    body: await request.text(),
  });
}
