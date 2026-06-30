export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';

export type ExpiryInfo = { dday: number | null; state: ExpiryState };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date | null {
  const datePart = value.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function todayUtcDateOnly(now = new Date()): Date {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function expiryInfo(expired_at?: string | null, now = new Date()): ExpiryInfo {
  if (!expired_at) return { dday: null, state: 'none' };
  const expiryDate = parseDateOnly(expired_at);
  if (!expiryDate) return { dday: null, state: 'none' };
  const dday = Math.round((expiryDate.getTime() - todayUtcDateOnly(now).getTime()) / MS_PER_DAY);
  if (dday < 0) return { dday, state: 'expired' };
  if (dday <= 7) return { dday, state: 'soon' };
  return { dday, state: 'ok' };
}

export function formatExpiryDday(info: ExpiryInfo): string | null {
  if (info.state === 'none') return null;
  if (info.state === 'expired') return '만료';
  return `D-${info.dday}`;
}
