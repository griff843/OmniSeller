import { proxyApi } from '@/lib/api-base';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.toString();

  return proxyApi(`/inventory${search ? `?${search}` : ''}`, {
    cache: 'no-store',
  });
}

export async function POST(request: Request) {
  return proxyApi('/inventory', {
    method: 'POST',
    body: await request.text(),
  });
}
