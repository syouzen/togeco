import type { UserSummary } from './types';

export function displayUser(user?: UserSummary) {
  return user?.name?.trim() || user?.email?.trim() || '알 수 없음';
}
