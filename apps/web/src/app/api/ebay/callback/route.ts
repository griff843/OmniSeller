import { cookies } from 'next/headers';
import { API_BASE_URL, internalApiHeaders } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const state = url.searchParams.get('state');
  const expectedState = (await cookies()).get('omniseller-ebay-oauth-state')?.value;

  if (!state || !expectedState || state !== expectedState) {
    return Response.json({ message: 'Invalid or expired eBay OAuth state' }, { status: 400 });
  }

  const query = url.searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/ebay/callback?${query}`, {
    headers: internalApiHeaders(user.id),
  });

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const redirect = Response.redirect(new URL('/settings?connected=ebay', req.url), 302);
  redirect.headers.append(
    'Set-Cookie',
    'omniseller-ebay-oauth-state=; Path=/api/ebay/callback; HttpOnly; SameSite=Lax; Max-Age=0',
  );
  return redirect;
}
