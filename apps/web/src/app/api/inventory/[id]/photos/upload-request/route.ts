import { createSignedUpload } from '@/lib/storage';
import { API_BASE_URL, internalApiHeaders } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await requireUser();
  const body = await request.json();

  const response = await fetch(`${API_BASE_URL}/inventory/${params.id}/photos/upload-request`, {
    method: 'POST',
    headers: internalApiHeaders(user.id),
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    return new Response(text, { status: response.status });
  }

  const payload = JSON.parse(text) as {
    inventoryItemId: string;
    uploads: Array<{
      id: string;
      storageKey: string;
      storageBucket: string;
    }>;
  };

  const signedUploads = await Promise.all(
    payload.uploads.map(async (upload) => ({
      ...upload,
      ...(await createSignedUpload(upload.storageKey)),
    })),
  );

  return Response.json({
    inventoryItemId: payload.inventoryItemId,
    uploads: signedUploads,
  });
}
