import { createSignedUpload } from '@/lib/storage';
import { API_BASE_URL } from '@/lib/api-base';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();

  const response = await fetch(`${API_BASE_URL}/inventory/${params.id}/photos/upload-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
