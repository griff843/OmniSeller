import { proxyApi } from '@/lib/api-base';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/listings/${params.id}/draft`, {
    method: 'PATCH',
    body: await request.text(),
  });
}
