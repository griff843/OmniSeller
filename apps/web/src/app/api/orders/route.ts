import { proxyApi } from '@/lib/api-base';

export async function GET() {
  return proxyApi('/orders', {
    cache: 'no-store',
  });
}
