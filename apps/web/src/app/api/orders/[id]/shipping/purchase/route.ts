import { proxyApi } from '@/lib/api-base';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();

  return proxyApi('/shipping/purchase', {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      orderId: params.id,
    }),
  });
}
