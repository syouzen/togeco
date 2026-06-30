import PocketBase from 'pocketbase';

const pbUrl = process.env.EXPO_PUBLIC_PB_URL;
if (!pbUrl) console.warn('EXPO_PUBLIC_PB_URL이 설정되지 않았습니다. .env를 확인하세요.');

export const pb = new PocketBase(pbUrl ?? '');

export function isAuthenticated() {
  return pb.authStore.isValid;
}

export async function ensureAuth() {
  if (pb.authStore.isValid) return;
  throw new Error('로그인이 필요합니다.');
}

export async function login(email: string, password: string) {
  await pb.collection('users').authWithPassword(email, password);
}

export function logout() {
  pb.authStore.clear();
}
