import { proxyApi } from '@/lib/api-base';

export async function GET() {
  return proxyApi('/inventory/bins', {
    cache: 'no-store',
  });
}
