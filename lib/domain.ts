export type AmountValidationResult =
  | { ok: true; amount: number }
  | { ok: false; message: string };

export type ExpiryValidationResult =
  | { ok: true; expiry: string | null }
  | { ok: false; message: string };

export type RawScanFields = {
  name?: string | null;
  amount?: number | null;
  expiry?: string | null;
  isExchange?: boolean | null;
};

export type NormalizedScanFields = {
  name: string;
  amountText: string;
  expiry: string;
  isExchange: boolean;
};

export function parseWonAmount(value: string): AmountValidationResult {
  const normalized = value.replaceAll(',', '').trim();
  if (normalized.length === 0) return { ok: false, message: '금액을 입력해주세요.' };
  if (!/^\d+$/.test(normalized)) return { ok: false, message: '금액은 숫자로만 입력해주세요.' };
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, message: '금액은 1원 이상이어야 합니다.' };
  return { ok: true, amount };
}

export function validateGifticonAmount(value: string, isExchange: boolean): AmountValidationResult | { ok: true; amount: null } {
  if (isExchange) return { ok: true, amount: null };
  const parsed = parseWonAmount(value);
  if (!parsed.ok) return parsed;
  return parsed;
}

export function validateSpendAmount(value: string, remainingAmount: number): AmountValidationResult {
  const parsed = parseWonAmount(value);
  if (!parsed.ok) return parsed;
  if (parsed.amount > remainingAmount) return { ok: false, message: '잔액보다 많이 사용할 수 없습니다.' };
  return parsed;
}

export function nextStatusAfterSpend(remainingAmount: number, spendAmount: number) {
  const nextRemaining = Math.max(remainingAmount - spendAmount, 0);
  return { nextRemaining, status: nextRemaining <= 0 ? 'USED' as const : 'AVAILABLE' as const };
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatGifticonAmount(remainingAmount?: number | null, totalAmount?: number | null): string {
  if (remainingAmount == null || totalAmount == null) return '교환권';
  return `${formatWon(remainingAmount)} / ${formatWon(totalAmount)}`;
}

export function validateLoginInput(email: string, password: string): string | null {
  if (email.trim().length === 0) return '이메일을 입력해주세요.';
  if (password.length === 0) return '비밀번호를 입력해주세요.';
  return null;
}

export function isSaneScannedAmount(amount: number | null | undefined): amount is number {
  if (amount == null) return false;
  return Number.isSafeInteger(amount) && amount >= 1000 && amount <= 5_000_000 && amount % 100 === 0;
}

export function validateExpiryInput(value: string): ExpiryValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, expiry: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return { ok: false, message: '유효기간은 YYYY-MM-DD 형식으로 입력해주세요.' };
  const parts = trimmed.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, message: '유효기간 날짜를 확인해주세요.' };
  }
  return { ok: true, expiry: trimmed };
}

export function normalizeScanFields(fields: RawScanFields): NormalizedScanFields {
  const isExchange = fields.isExchange === true || fields.amount == null;
  const expiryResult = fields.expiry ? validateExpiryInput(fields.expiry) : { ok: true as const, expiry: null };
  const expiry = expiryResult.ok && expiryResult.expiry ? expiryResult.expiry : '';
  return {
    name: fields.name?.trim() ?? '',
    amountText: isExchange || !isSaneScannedAmount(fields.amount) ? '' : String(fields.amount),
    expiry,
    isExchange,
  };
}
