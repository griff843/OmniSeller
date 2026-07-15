import { proxyApi } from '@/lib/api-base';

export async function POST(_: Request, props: { params: Promise<{ id: string; photoId: string }> }) {
  const params = await props.params;
  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}/primary`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
