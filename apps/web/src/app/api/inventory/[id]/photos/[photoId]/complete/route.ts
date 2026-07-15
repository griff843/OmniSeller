import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, { params }: { params: { id: string; photoId: string } }) {
  const body = await request.json();
  const safeBody = { ...(body as Record<string, unknown>) };
  delete safeBody.url;

  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}/complete`, {
    method: 'POST',
    body: JSON.stringify(safeBody),
  });
}
