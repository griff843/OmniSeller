import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/inventory/${params.id}`, { cache: 'no-store' });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/inventory/${params.id}`, {
    method: 'PATCH',
    body: await request.text(),
  });
}
