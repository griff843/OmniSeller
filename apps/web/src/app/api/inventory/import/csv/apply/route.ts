import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request) {
  return proxyApi('/inventory/import/csv/apply', {
    method: 'POST',
    body: await request.text(),
  });
}
