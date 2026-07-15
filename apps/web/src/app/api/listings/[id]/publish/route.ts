import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/listings/${params.id}/publish?marketplace=ebay`, {
    method: 'POST',
  });
}
