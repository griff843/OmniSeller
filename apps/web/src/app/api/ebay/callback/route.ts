import { API_BASE_URL } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/ebay/callback?${query}`, {
    headers: {
      'x-omniseller-user-id': user.id,
    },
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  return Response.redirect(new URL('/settings?connected=ebay', req.url), 302);
}
