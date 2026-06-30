import * as Notifications from 'expo-notifications';

import { ensureAuth, pb } from './pb';
import type { Gifticon, Reminder } from './types';

const COLLECTION = 'reminders';
const DEFAULT_REMINDER_HOUR = 9;

function currentUserId() {
  const user = pb.authStore.record?.id;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user;
}

export async function ensureNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function dateOnly(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function reminderDateFromDateOnly(value: string) {
  const parts = value.split('-').map(Number);
  const [year, month, day] = parts;
  if (!year || !month || !day) throw new Error('날짜 형식이 올바르지 않습니다.');
  return new Date(year, month - 1, day, DEFAULT_REMINDER_HOUR, 0, 0, 0);
}

export function beforeExpiry(expiredAt: string, days: number) {
  const date = new Date(expiredAt);
  date.setDate(date.getDate() - days);
  date.setHours(DEFAULT_REMINDER_HOUR, 0, 0, 0);
  return date;
}

export function isPastReminderDate(value: Date) {
  return value.getTime() <= Date.now();
}

function reminderBody(name?: string) {
  return `${name?.trim() || '기프티콘'} 잊지 말고 쓰세요!`;
}

async function scheduleLocalReminder(id: string, name: string, remindAt: Date) {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title: '기프티콘 알림', body: reminderBody(name) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt },
  });
}

export async function myReminder(gifticonId: string): Promise<Reminder | null> {
  await ensureAuth();
  const user = currentUserId();
  return pb.collection(COLLECTION)
    .getFirstListItem<Reminder>(`gifticon="${gifticonId}" && user="${user}"`)
    .catch(() => null);
}

export async function setReminder(gifticonId: string, name: string, remindAt: Date): Promise<Reminder> {
  await ensureAuth();
  if (isPastReminderDate(remindAt)) throw new Error('미래 날짜만 설정할 수 있습니다.');
  if (!(await ensureNotifPermission())) throw new Error('알림 권한이 필요해요.');

  const user = currentUserId();
  const existing = await myReminder(gifticonId);
  const payload = { user, gifticon: gifticonId, remind_at: remindAt.toISOString() };
  const reminder = existing
    ? await pb.collection(COLLECTION).update<Reminder>(existing.id, payload)
    : await pb.collection(COLLECTION).create<Reminder>(payload);

  await scheduleLocalReminder(reminder.id, name, remindAt);
  return reminder;
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await ensureAuth();
  await pb.collection(COLLECTION).delete(id).catch(() => {});
}

export async function syncReminders(): Promise<void> {
  try {
    await ensureAuth();
    if (!pb.authStore.isValid) return;
    if (!(await ensureNotifPermission())) return;
    const user = currentUserId();
    const reminders = await pb.collection(COLLECTION).getFullList<Reminder>({ filter: `user="${user}"` });

    for (const reminder of reminders) {
      const remindAt = new Date(reminder.remind_at);
      if (remindAt.getTime() <= Date.now()) continue;
      const gifticon = await pb.collection('gifticons').getOne<Gifticon>(reminder.gifticon).catch(() => null);
      await scheduleLocalReminder(reminder.id, gifticon?.name || '기프티콘', remindAt);
    }
  } catch {
    // Reminder sync is a restore convenience and must not block app startup.
  }
}
