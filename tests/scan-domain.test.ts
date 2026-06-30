import { describe, expect, it } from 'vitest';

import { formatGifticonAmount, normalizeScanFields, validateExpiryInput } from '../lib/domain';

describe('gifticon scan normalization', () => {
  it('prefills amount only when Gemini amount passes sanity rules', () => {
    expect(normalizeScanFields({ name: '스타벅스 3만원권', amount: 30000, expiry: '2026-12-31', isExchange: false })).toEqual({
      name: '스타벅스 3만원권',
      amountText: '30000',
      expiry: '2026-12-31',
      isExchange: false,
    });
  });

  it('drops suspicious amounts so the user must confirm manually', () => {
    expect(normalizeScanFields({ name: '상품권', amount: 100, expiry: null, isExchange: false })).toMatchObject({ amountText: '' });
    expect(normalizeScanFields({ name: '상품권', amount: 12345, expiry: null, isExchange: false })).toMatchObject({ amountText: '' });
    expect(normalizeScanFields({ name: '상품권', amount: 5000100, expiry: null, isExchange: false })).toMatchObject({ amountText: '' });
  });

  it('treats exchange coupons as amount-less gifticons', () => {
    expect(normalizeScanFields({ name: '아메리카노 교환권', amount: null, expiry: '2026-08-01', isExchange: true })).toEqual({
      name: '아메리카노 교환권',
      amountText: '',
      expiry: '2026-08-01',
      isExchange: true,
    });
    expect(formatGifticonAmount(null, null)).toBe('교환권');
  });

  it('accepts real calendar expiry dates and rejects impossible dates', () => {
    expect(validateExpiryInput('2026-02-28')).toEqual({ ok: true, expiry: '2026-02-28' });
    expect(validateExpiryInput('2026-02-31')).toEqual({ ok: false, message: '유효기간 날짜를 확인해주세요.' });
    expect(validateExpiryInput('')).toEqual({ ok: true, expiry: null });
  });
});
