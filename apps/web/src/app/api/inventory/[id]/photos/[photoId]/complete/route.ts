import { proxyApi } from '@/lib/api-base';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; photoId: string }> }
) {
  const params = await props.params;
  const body = await request.json();
  const safeBody = { ...(body as Record<string, unknown>) };
  delete safeBody.url;

  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}/complete`, {
    method: 'POST',
    body: JSON.stringify(safeBody),
  });
}
