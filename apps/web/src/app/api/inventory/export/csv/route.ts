import { proxyApi } from '@/lib/api-base';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.toString();

  return proxyApi(`/inventory/export/csv${search ? `?${search}` : ''}`, {
    cache: 'no-store',
  });
}
