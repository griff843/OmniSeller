import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

function sanitizeStorageKey(input: string) {
  return input
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
}

const MAX_LOCAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return new Response('Unsupported image type. Use JPEG, PNG, or WebP.', { status: 415 });
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LOCAL_UPLOAD_BYTES) {
    return new Response('Image exceeds the 15 MB upload limit.', { status: 413 });
  }

  const uploadPath = path.join(localUploadRoot(), ...key.split('/'));
  const uploadDirectory = path.dirname(uploadPath);
  const body = Buffer.from(await request.arrayBuffer());

  if (body.length === 0 || body.length > MAX_LOCAL_UPLOAD_BYTES) {
    return new Response(body.length === 0 ? 'Image is empty.' : 'Image exceeds the 15 MB upload limit.', {
      status: body.length === 0 ? 400 : 413,
    });
  }

  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(uploadPath, body);

  return new Response(null, { status: 200 });
}
