import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@omniseller/db';
import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  providers: [],
  trustHost: true,
};

const { handlers, auth } = NextAuth(authConfig);
const { GET, POST } = handlers;

export { GET, POST, auth };
