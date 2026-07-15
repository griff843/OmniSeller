import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { API_BASE_URL, internalApiHeaders } from '@/lib/api-base';
import { requireUser } from '@/lib/requireUser';

export async function GET() {
  const user = await requireUser();
  const response = await fetch(`${API_BASE_URL}/ebay/authorize`, {
    redirect: 'manual',
    headers: internalApiHeaders(user.id),
  });

  const location = response.headers.get('location');

  if (!location) {
    return new Response(await response.text(), { status: response.status });
  }

  const state = randomUUID();
  const authorizeUrl = new URL(location);
  authorizeUrl.searchParams.set('state', state);
  const redirect = NextResponse.redirect(authorizeUrl, 302);
  redirect.cookies.set('omniseller-ebay-oauth-state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/api/ebay/callback',
  });
  return redirect;
}
