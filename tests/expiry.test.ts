import { describe, expect, it } from 'vitest';

import { expiryInfo, formatExpiryDday } from '../lib/expiry';

describe('expiryInfo', () => {
  const today = new Date(2026, 5, 30, 23, 30);

  it('returns none when expired_at is missing', () => {
    expect(expiryInfo(null, today)).toEqual({ dday: null, state: 'none' });
    expect(expiryInfo(undefined, today)).toEqual({ dday: null, state: 'none' });
  });

  it('calculates d-day by calendar date, not current time', () => {
    expect(expiryInfo('2026-06-30', today)).toEqual({ dday: 0, state: 'soon' });
    expect(expiryInfo('2026-07-01T00:00:00Z', today)).toEqual({ dday: 1, state: 'soon' });
  });

  it('classifies expired, soon, and ok states', () => {
    expect(expiryInfo('2026-06-29', today)).toEqual({ dday: -1, state: 'expired' });
    expect(expiryInfo('2026-07-07', today)).toEqual({ dday: 7, state: 'soon' });
    expect(expiryInfo('2026-07-08', today)).toEqual({ dday: 8, state: 'ok' });
  });

  it('formats card labels', () => {
    expect(formatExpiryDday({ dday: null, state: 'none' })).toBeNull();
    expect(formatExpiryDday({ dday: -1, state: 'expired' })).toBe('만료');
    expect(formatExpiryDday({ dday: 3, state: 'soon' })).toBe('D-3');
  });
});
