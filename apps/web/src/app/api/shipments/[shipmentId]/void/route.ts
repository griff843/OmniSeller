import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, props: { params: Promise<{ shipmentId: string }> }) {
  const params = await props.params;
  return proxyApi(`/shipping/${params.shipmentId}/void`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
