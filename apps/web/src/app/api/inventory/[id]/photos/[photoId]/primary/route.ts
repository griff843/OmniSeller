import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, { params }: { params: { id: string; photoId: string } }) {
  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}/primary`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
