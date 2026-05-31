import { auth } from './auth';

export async function requireUser() {
  const session = await auth();
  const sessionUser = session?.user;
  const userId = (sessionUser as typeof sessionUser & { id?: string } | undefined)?.id;

  if (!sessionUser || !userId) throw new Error('Not authenticated');

  return {
    ...sessionUser,
    id: userId,
  };
}
