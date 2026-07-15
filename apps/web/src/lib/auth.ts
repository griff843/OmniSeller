import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Auth0 from 'next-auth/providers/auth0';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@omniseller/db';
import type { NextAuthConfig } from 'next-auth';

const isProduction = process.env.NODE_ENV === 'production';
const auth0Issuer = process.env.AUTH0_ISSUER;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;

const providers: NextAuthConfig['providers'] = [];

if (auth0Issuer && auth0ClientId && auth0ClientSecret) {
  providers.push(
    Auth0({
      issuer: auth0Issuer,
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret,
      authorization: { params: { prompt: 'login' } },
    }),
  );
}

if (!isProduction) {
  providers.push(
    Credentials({
      name: 'Development email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';

        if (!email) return null;

        const name =
          typeof credentials?.name === 'string' && credentials.name.trim().length > 0
            ? credentials.name.trim()
            : email.split('@')[0] ?? 'OmniSeller User';
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing?.disabledAt) return null;

        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name },
        });

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 15 * 60, updateAge: 5 * 60 },
  pages: {
    signIn: '/login',
  },
  providers,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const persisted = await prisma.user.findUnique({ where: { email: user.email.toLowerCase() } });
      if (!persisted || persisted.disabledAt) return false;
      return !isProduction || Boolean(persisted.invitedAt);
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }

      return session;
    },
  },
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === 'production' ? undefined : 'local-development-only-omniseller-secret'),
  trustHost: !isProduction,
  cookies: isProduction
    ? {
        sessionToken: {
          name: '__Secure-authjs.session-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
        },
      }
    : undefined,
};

const nextAuth = NextAuth(authConfig);
const { handlers, auth, signOut } = nextAuth;
const { GET, POST } = handlers;

export async function signInWithCredentials(input: {
  email: string;
  name?: string;
  redirectTo: string;
}) {
  if (isProduction) throw new Error('Development credential sign-in is disabled in production');
  return nextAuth.signIn('credentials', {
    email: input.email,
    name: input.name,
    redirectTo: input.redirectTo,
  });
}

export async function signInWithAuth0(redirectTo: string) {
  return nextAuth.signIn('auth0', { redirectTo });
}

export async function signOutUser() { return signOut({ redirectTo: '/login' }); }

export { GET, POST, auth };
