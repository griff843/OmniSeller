import { proxyApi } from '@/lib/api-base';

export async function GET() {
  return proxyApi('/dashboard/summary', {
    method: 'GET',
  });
}
