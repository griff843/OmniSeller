import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/orders/${params.id}`, {
    cache: 'no-store',
  });
}
