import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { ensureAuth, pb } from './pb';
import type { Gifticon, Reminder } from './types';

const COLLECTION = 'reminders';
const DEFAULT_REMINDER_HOUR = 9;
const REMINDER_OFFSETS_STORAGE_KEY = 'togeco_default_expiry_reminder_offsets';
export const DEFAULT_EXPIRY_REMINDER_OFFSETS = [30, 7, 3, 1] as const;
export type ExpiryReminderOffset = typeof DEFAULT_EXPIRY_REMINDER_OFFSETS[number];

function currentUserId() {
  const user = pb.authStore.record?.id;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user;
}

function escapeFilterValue(value: string) {
  return value.replaceAll('"', '\\"');
}

export async function ensureNotifPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
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

function reminderFilter(gifticonId: string, user: string, offsetDays?: number) {
  const base = `gifticon="${escapeFilterValue(gifticonId)}" && user="${escapeFilterValue(user)}"`;
  return offsetDays == null ? base : `${base} && offset_days=${offsetDays}`;
}

export async function myReminders(gifticonId: string): Promise<Reminder[]> {
  await ensureAuth();
  const user = currentUserId();
  return pb.collection(COLLECTION).getFullList<Reminder>({
    filter: reminderFilter(gifticonId, user),
    sort: '-offset_days,remind_at',
  });
}

async function findReminder(gifticonId: string, user: string, offsetDays: number): Promise<Reminder | null> {
  return pb.collection(COLLECTION)
    .getFirstListItem<Reminder>(reminderFilter(gifticonId, user, offsetDays))
    .catch(() => null);
}

export async function setReminder(gifticonId: string, name: string, remindAt: Date, offsetDays: number): Promise<Reminder> {
  await ensureAuth();
  if (isPastReminderDate(remindAt)) throw new Error('미래 날짜만 설정할 수 있습니다.');
  if (!(await ensureNotifPermission())) throw new Error('알림 권한이 필요해요.');

  const user = currentUserId();
  const existing = await findReminder(gifticonId, user, offsetDays);
  const payload = { user, gifticon: gifticonId, remind_at: remindAt.toISOString(), offset_days: offsetDays };
  const reminder = existing
    ? await pb.collection(COLLECTION).update<Reminder>(existing.id, payload)
    : await pb.collection(COLLECTION).create<Reminder>(payload);

  await scheduleLocalReminder(reminder.id, name, remindAt);
  return reminder;
}

export async function getDefaultExpiryReminderOffsets(): Promise<ExpiryReminderOffset[]> {
  const raw = await AsyncStorage.getItem(REMINDER_OFFSETS_STORAGE_KEY).catch(() => null);
  if (!raw) return [...DEFAULT_EXPIRY_REMINDER_OFFSETS];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_EXPIRY_REMINDER_OFFSETS];
    const allowed = new Set<number>(DEFAULT_EXPIRY_REMINDER_OFFSETS);
    return parsed.filter((value): value is ExpiryReminderOffset => allowed.has(value));
  } catch {
    return [...DEFAULT_EXPIRY_REMINDER_OFFSETS];
  }
}

export async function setDefaultExpiryReminderOffsets(offsets: readonly ExpiryReminderOffset[]): Promise<void> {
  await AsyncStorage.setItem(REMINDER_OFFSETS_STORAGE_KEY, JSON.stringify(offsets));
}

export async function setDefaultExpiryReminders(gifticonId: string, name: string, expiredAt?: string | null): Promise<Reminder[]> {
  await ensureAuth();
  if (!expiredAt) return [];
  if (!(await ensureNotifPermission())) throw new Error('알림 권한이 필요해요.');

  const user = currentUserId();
  const saved: Reminder[] = [];
  const offsets = await getDefaultExpiryReminderOffsets();

  for (const offsetDays of offsets) {
    const remindAt = beforeExpiry(expiredAt, offsetDays);
    if (isPastReminderDate(remindAt)) continue;

    const existing = await findReminder(gifticonId, user, offsetDays);
    const payload = { user, gifticon: gifticonId, remind_at: remindAt.toISOString(), offset_days: offsetDays };
    const reminder = existing
      ? await pb.collection(COLLECTION).update<Reminder>(existing.id, payload)
      : await pb.collection(COLLECTION).create<Reminder>(payload);

    await scheduleLocalReminder(reminder.id, name, remindAt);
    saved.push(reminder);
  }

  return saved;
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
    const reminders = await pb.collection(COLLECTION).getFullList<Reminder>({ filter: `user="${escapeFilterValue(user)}"` });

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
