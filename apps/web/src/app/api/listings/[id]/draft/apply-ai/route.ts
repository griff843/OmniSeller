import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return proxyApi(`/listings/${params.id}/draft/apply-ai`, {
    method: 'POST',
    body: await request.text(),
  });
}
