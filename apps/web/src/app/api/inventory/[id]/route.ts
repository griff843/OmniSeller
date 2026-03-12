import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/inventory/${params.id}`, { cache: 'no-store' });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/inventory/${params.id}`, {
    method: 'PATCH',
    body: await request.text(),
  });
}
