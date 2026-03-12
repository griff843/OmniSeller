import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/listings/${params.id}/ai`, {
    cache: 'no-store',
  });
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/listings/${params.id}/ai/generate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
