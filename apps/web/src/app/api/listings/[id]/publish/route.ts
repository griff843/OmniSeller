import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/listings/${params.id}/publish?marketplace=ebay`, {
    method: 'POST',
  });
}
