import { UnauthorizedException } from '@nestjs/common';

export const DEV_USER_ID = 'dev-user';
export const USER_ID_HEADER = 'x-omniseller-user-id';

export function resolveUserId(userId?: string | string[] | null): string {
  const value = Array.isArray(userId) ? userId[0] : userId;
  const normalized = value?.trim();

  if (!normalized) {
    throw new UnauthorizedException('Missing user context');
  }

  return normalized;
}

export function ownsRecord(recordUserId: string | null | undefined, userId: string): boolean {
  return Boolean(recordUserId) && recordUserId === userId;
}
