import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@omniseller/db';
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
      },
      async authorize(credentials) {
        const allowPasswordlessLogin =
          process.env.NODE_ENV !== 'production' || process.env.OMNISELLER_ALLOW_PASSWORDLESS_LOGIN === 'true';

        if (!allowPasswordlessLogin) {
          return null;
        }

        const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';

        if (!email) {
          return null;
        }

        const name =
          typeof credentials?.name === 'string' && credentials.name.trim().length > 0
            ? credentials.name.trim()
            : email.split('@')[0] ?? 'OmniSeller User';

        const user = await prisma.user.upsert({
          where: { email },
          update: { name },
          create: { email, name },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
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
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'local-development-only-omniseller-secret',
  trustHost: true,
};

const nextAuth = NextAuth(authConfig);
const { handlers, auth } = nextAuth;
const { GET, POST } = handlers;

export async function signInWithCredentials(input: {
  email: string;
  name?: string;
  redirectTo: string;
}) {
  return nextAuth.signIn('credentials', {
    email: input.email,
    name: input.name,
    redirectTo: input.redirectTo,
  });
}

export { GET, POST, auth };
