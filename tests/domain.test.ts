import { describe, expect, it } from 'vitest';

import { canUseGifticon, claimExpiresAt, claimState, formatWon, gifticonStatusLabel, quickSpendPresets, nextStatusAfterSpend, parseWonAmount, usageLedgerEntry, revertLedgerEntry, validateLoginInput, validateSpendAmount } from '../lib/domain';

describe('gifticon amount domain', () => {
  it('parses positive won amounts and ignores commas', () => {
    expect(parseWonAmount('30,000')).toEqual({ ok: true, amount: 30000 });
  });
  it('rejects empty, non-numeric, and zero amounts', () => {
    expect(parseWonAmount('')).toEqual({ ok: false, message: '금액을 입력해주세요.' });
    expect(parseWonAmount('삼천원')).toEqual({ ok: false, message: '금액은 숫자로만 입력해주세요.' });
    expect(parseWonAmount('0')).toEqual({ ok: false, message: '금액은 1원 이상이어야 합니다.' });
  });
  it('blocks spending more than the remaining balance', () => {
    expect(validateSpendAmount('3001', 3000)).toEqual({ ok: false, message: '잔액보다 많이 사용할 수 없습니다.' });
  });
  it('keeps available status when balance remains after spend', () => {
    expect(nextStatusAfterSpend(10000, 3000)).toEqual({ nextRemaining: 7000, status: 'AVAILABLE' });
  });
  it('marks used when spend reaches zero', () => {
    expect(nextStatusAfterSpend(3000, 3000)).toEqual({ nextRemaining: 0, status: 'USED' });
  });
  it('formats Korean won values', () => {
    expect(formatWon(1234567)).toBe('1,234,567원');
  });

  it('formats draft, available, and used status labels', () => {
    expect(gifticonStatusLabel('DRAFT')).toBe('작성중');
    expect(gifticonStatusLabel('AVAILABLE')).toBe('사용가능');
    expect(gifticonStatusLabel('USED')).toBe('다 씀');
  });

  it('allows usage actions only for available gifticons', () => {
    expect(canUseGifticon('AVAILABLE')).toBe(true);
    expect(canUseGifticon('DRAFT')).toBe(false);
    expect(canUseGifticon('USED')).toBe(false);
  });

  it('builds quick spend presets within the remaining balance and includes full amount', () => {
    expect(quickSpendPresets(4200)).toEqual([1000, 3000, 4200]);
    expect(quickSpendPresets(7000)).toEqual([1000, 3000, 5000, 7000]);
    expect(quickSpendPresets(1000)).toEqual([1000]);
  });

  it('validates login input before requesting PocketBase auth', () => {
    expect(validateLoginInput('', 'password')).toBe('이메일을 입력해주세요.');
    expect(validateLoginInput('shared@example.com', '')).toBe('비밀번호를 입력해주세요.');
    expect(validateLoginInput('shared@example.com', 'password')).toBeNull();
  });
});

describe('gifticon usage ledger domain', () => {
  it('records before and after amounts for partial spending', () => {
    expect(usageLedgerEntry({ actionType: 'SPEND', beforeAmount: 12000, amount: 3000 })).toEqual({ action_type: 'SPEND', amount: 3000, before_amount: 12000, after_amount: 9000 });
  });

  it('records mark-used as spending the remaining amount', () => {
    expect(usageLedgerEntry({ actionType: 'MARK_USED', beforeAmount: 7000 })).toEqual({ action_type: 'MARK_USED', amount: 7000, before_amount: 7000, after_amount: 0 });
  });

  it('records exchange-coupon mark-used without balances', () => {
    expect(usageLedgerEntry({ actionType: 'MARK_USED', beforeAmount: null })).toEqual({ action_type: 'MARK_USED', amount: 0, before_amount: null, after_amount: null });
  });

  it('builds a revert entry that restores the original amount', () => {
    expect(revertLedgerEntry({ originalAmount: 3000, currentAmount: 9000 })).toEqual({ action_type: 'REVERT', amount: 3000, before_amount: 9000, after_amount: 12000 });
  });
});

describe('gifticon claim domain', () => {
  const now = new Date('2026-06-30T12:00:00.000Z');

  it('sets claim expiry to 30 minutes after the claim time', () => {
    expect(claimExpiresAt(now)).toBe('2026-06-30T12:30:00.000Z');
  });

  it('treats expired claims as unclaimed', () => {
    expect(claimState({ claimedBy: 'user-a', claimExpiresAt: '2026-06-30T11:59:59.000Z', currentUserId: 'user-a', now })).toEqual({ active: false, byMe: false, byOther: false });
  });

  it('detects active claims by me and by other users', () => {
    expect(claimState({ claimedBy: 'user-a', claimExpiresAt: '2026-06-30T12:30:00.000Z', currentUserId: 'user-a', now })).toEqual({ active: true, byMe: true, byOther: false });
    expect(claimState({ claimedBy: 'user-b', claimExpiresAt: '2026-06-30T12:30:00.000Z', currentUserId: 'user-a', now })).toEqual({ active: true, byMe: false, byOther: true });
  });
});
