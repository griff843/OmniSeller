import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, { params }: { params: { shipmentId: string } }) {
  return proxyApi(`/shipping/${params.shipmentId}/void`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
