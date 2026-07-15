import { NextResponse } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/api/auth', '/_next', '/favicon.ico', '/local-uploads'];

export default async function middleware(request: import('next/server').NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isPublic) {
    return NextResponse.next();
  }

  const validation = await fetch(new URL('/api/auth/validate', request.url), {
    headers: { cookie: request.headers.get('cookie') ?? '' },
    cache: 'no-store',
  }).catch(() => null);

  if (!validation?.ok) {
    const loginUrl = new URL('/login', request.nextUrl);
    loginUrl.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
