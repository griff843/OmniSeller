import { proxyApi } from '@/lib/api-base';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/listings/${params.id}/draft`, {
    method: 'PATCH',
    body: await request.text(),
  });
}
