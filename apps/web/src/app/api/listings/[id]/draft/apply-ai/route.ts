import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return proxyApi(`/listings/${params.id}/draft/apply-ai`, {
    method: 'POST',
    body: await request.text(),
  });
}
