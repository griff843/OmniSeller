import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

function sanitizeStorageKey(input: string) {
  return input
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
}

function localUploadRoot() {
  return path.join(process.cwd(), 'public', 'local-uploads');
}

export async function PUT(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Local upload fallback is disabled in production.', { status: 403 });
  }

  const url = new URL(request.url);
  const key = sanitizeStorageKey(url.searchParams.get('key') ?? '');

  if (!key) {
    return new Response('Missing storage key', { status: 400 });
  }

  const uploadPath = path.join(localUploadRoot(), ...key.split('/'));
  const uploadDirectory = path.dirname(uploadPath);
  const body = Buffer.from(await request.arrayBuffer());

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(uploadPath, body);

  return new Response(null, { status: 200 });
}
