import { auth } from './auth';
import { prisma } from '@omniseller/db';

export async function requireUser() {
  const session = await auth();
  const sessionUser = session?.user;
  const userId = (sessionUser as typeof sessionUser & { id?: string } | undefined)?.id;

  if (!sessionUser || !userId) throw new Error('Not authenticated');
  const persisted = await prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  if (!persisted || persisted.disabledAt) throw new Error('Not authenticated');

  return {
    ...sessionUser,
    id: userId,
  };
}
