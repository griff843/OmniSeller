export const DEV_USER_ID = 'dev-user';
export const USER_ID_HEADER = 'x-omniseller-user-id';

export function resolveUserId(userId?: string | string[] | null): string {
  const value = Array.isArray(userId) ? userId[0] : userId;
  const normalized = value?.trim();

  return normalized && normalized.length > 0 ? normalized : DEV_USER_ID;
}

export function ownsRecord(recordUserId: string | null | undefined, userId: string): boolean {
  return !recordUserId || recordUserId === userId;
}
