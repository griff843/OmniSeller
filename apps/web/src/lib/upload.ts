export async function getSignedUploadUrl(fileName: string, contentType: string) {
  const res = await fetch('/api/storage/signed-url', {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string; token: string }>;
}

export async function putToSignedUrl(url: string, file: File, contentType: string) {
  const res = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
}
