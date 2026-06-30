import { describe, expect, it } from 'vitest';

import { formatWon, nextStatusAfterSpend, parseWonAmount, validateLoginInput, validateSpendAmount } from '../lib/domain';

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

  it('validates login input before requesting PocketBase auth', () => {
    expect(validateLoginInput('', 'password')).toBe('이메일을 입력해주세요.');
    expect(validateLoginInput('shared@example.com', '')).toBe('비밀번호를 입력해주세요.');
    expect(validateLoginInput('shared@example.com', 'password')).toBeNull();
  });
});
