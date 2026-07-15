import { API_BASE_URL, internalApiHeaders, proxyApi } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';
import { deleteStoredObject } from '@/lib/storage';

export async function DELETE(_: Request, props: { params: Promise<{ id: string; photoId: string }> }) {
  const params = await props.params;
  const user = await requireUser();
  const itemResponse = await fetch(`${API_BASE_URL}/inventory/${params.id}`, { headers: internalApiHeaders(user.id), cache: 'no-store' });
  if (!itemResponse.ok) return new Response(await itemResponse.text(), { status: itemResponse.status });
  const item = await itemResponse.json() as { photos?: Array<{ id: string; storageBucket: string; storageKey: string }> };
  const photo = item.photos?.find((candidate) => candidate.id === params.photoId);
  if (photo) await deleteStoredObject(photo.storageBucket, photo.storageKey);
  return proxyApi(`/inventory/${params.id}/photos/${params.photoId}`, {
    method: 'DELETE',
  });
}
