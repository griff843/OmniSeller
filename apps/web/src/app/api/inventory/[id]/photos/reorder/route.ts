import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const body = await request.json();

  return proxyApi(`/inventory/${params.id}/photos/reorder`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
