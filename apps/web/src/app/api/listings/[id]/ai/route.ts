import { proxyApi } from '@/lib/api-base';

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/listings/${params.id}/ai`, {
    cache: 'no-store',
  });
}

export async function POST(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/listings/${params.id}/ai/generate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
