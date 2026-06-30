export type AmountValidationResult =
  | { ok: true; amount: number }
  | { ok: false; message: string };

export function parseWonAmount(value: string): AmountValidationResult {
  const normalized = value.replaceAll(',', '').trim();
  if (normalized.length === 0) return { ok: false, message: '금액을 입력해주세요.' };
  if (!/^\d+$/.test(normalized)) return { ok: false, message: '금액은 숫자로만 입력해주세요.' };
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, message: '금액은 1원 이상이어야 합니다.' };
  return { ok: true, amount };
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
