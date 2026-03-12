import { proxyApi } from '@/lib/api-base';

export async function DELETE(_: Request, { params }: { params: { id: string; photoId: string } }) {
  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}`, {
    method: 'DELETE',
  });
}
