import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, { params }: { params: { id: string; photoId: string } }) {
  const body = await request.json();

  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
