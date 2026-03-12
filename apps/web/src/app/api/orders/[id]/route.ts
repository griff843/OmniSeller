import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/orders/${params.id}`, {
    cache: 'no-store',
  });
}
