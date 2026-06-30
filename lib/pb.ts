import PocketBase from 'pocketbase';

const pbUrl = process.env.EXPO_PUBLIC_PB_URL;
if (!pbUrl) console.warn('EXPO_PUBLIC_PB_URL이 설정되지 않았습니다. .env를 확인하세요.');

export const pb = new PocketBase(pbUrl ?? '');

export async function ensureAuth() {
  if (pb.authStore.isValid) return;
  const email = process.env.EXPO_PUBLIC_PB_EMAIL;
  const password = process.env.EXPO_PUBLIC_PB_PASSWORD;
  if (!email || !password) throw new Error('PocketBase 공용 계정 환경변수가 설정되지 않았습니다.');
  await pb.collection('users').authWithPassword(email, password);
}
