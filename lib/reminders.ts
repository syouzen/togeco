import { ensureAuth, pb } from './pb';
import type { Reminder } from './types';

const COLLECTION = 'reminders';

function currentUserId() {
  const user = pb.authStore.record?.id;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user;
}

export function dateOnly(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function beforeExpiry(expiredAt: string, days: number) {
  const date = new Date(expiredAt);
  date.setDate(date.getDate() - days);
  return dateOnly(date);
}

export function isPastReminderDate(value: string) {
  const today = dateOnly(new Date());
  return value < today;
}

export async function myReminder(gifticonId: string): Promise<Reminder | null> {
  await ensureAuth();
  const user = currentUserId();
  return pb.collection(COLLECTION)
    .getFirstListItem<Reminder>(`gifticon="${gifticonId}" && user="${user}" && sent=false`)
    .catch(() => null);
}

export async function setReminder(gifticonId: string, remindAt: string): Promise<Reminder> {
  await ensureAuth();
  const user = currentUserId();
  const existing = await myReminder(gifticonId);
  const payload = { user, gifticon: gifticonId, remind_at: remindAt, sent: false };
  if (existing) return pb.collection(COLLECTION).update<Reminder>(existing.id, payload);
  return pb.collection(COLLECTION).create<Reminder>(payload);
}

export async function cancelReminder(id: string): Promise<boolean> {
  await ensureAuth();
  return pb.collection(COLLECTION).delete(id);
}
