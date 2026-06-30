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

export type ClaimStateInput = {
  claimedBy?: string | null;
  claimExpiresAt?: string | null;
  currentUserId?: string | null;
  now?: Date;
};

export type GifticonListFilter = {
  query?: string;
  expiry?: 'all' | 'soon';
  claimed?: 'all' | 'mine';
  amountKind?: 'all' | 'amount' | 'exchange';
  currentUserId?: string | null;
  now?: Date;
};

export type ClaimState = {
  active: boolean;
  byMe: boolean;
  byOther: boolean;
};

export type UsageActionType = 'SPEND' | 'MARK_USED' | 'REVERT';

export type UsageLedgerEntry = {
  action_type: UsageActionType;
  amount: number;
  before_amount: number | null;
  after_amount: number | null;
};

export const CLAIM_DURATION_MINUTES = 30;
export const CLAIM_DURATION_MS = CLAIM_DURATION_MINUTES * 60 * 1000;

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

export function usageLedgerEntry(input: { actionType: 'SPEND'; beforeAmount: number; amount: number } | { actionType: 'MARK_USED'; beforeAmount: number | null }): UsageLedgerEntry {
  if (input.actionType === 'SPEND') {
    return { action_type: 'SPEND', amount: input.amount, before_amount: input.beforeAmount, after_amount: Math.max(input.beforeAmount - input.amount, 0) };
  }
  if (input.beforeAmount == null) {
    return { action_type: 'MARK_USED', amount: 0, before_amount: null, after_amount: null };
  }
  return { action_type: 'MARK_USED', amount: input.beforeAmount, before_amount: input.beforeAmount, after_amount: 0 };
}

export function revertLedgerEntry({ originalAmount, currentAmount }: { originalAmount: number; currentAmount: number | null }): UsageLedgerEntry {
  return {
    action_type: 'REVERT',
    amount: originalAmount,
    before_amount: currentAmount,
    after_amount: currentAmount == null ? null : currentAmount + originalAmount,
  };
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function formatGifticonAmount(remainingAmount?: number | null, totalAmount?: number | null): string {
  if (remainingAmount == null || totalAmount == null) return '교환권';
  return `${formatWon(remainingAmount)} / ${formatWon(totalAmount)}`;
}

export function gifticonStatusLabel(status: 'DRAFT' | 'AVAILABLE' | 'USED'): string {
  if (status === 'DRAFT') return '작성중';
  if (status === 'USED') return '모두 사용';
  return '사용가능';
}

export function canUseGifticon(status: 'DRAFT' | 'AVAILABLE' | 'USED'): boolean {
  return status === 'AVAILABLE';
}

export function quickSpendPresets(remainingAmount: number): number[] {
  return Array.from(new Set([1000, 3000, 5000, remainingAmount].filter((amount) => amount > 0 && amount <= remainingAmount)));
}

export function editGifticonAmounts(input: { isExchange: boolean; nextTotalAmount: number | null; currentTotalAmount?: number | null; currentRemainingAmount?: number | null }): { total_amount: number | null; remaining_amount: number | null } {
  if (input.isExchange || input.nextTotalAmount == null) return { total_amount: null, remaining_amount: null };
  const remaining = input.nextTotalAmount === input.currentTotalAmount ? input.currentRemainingAmount ?? input.nextTotalAmount : input.nextTotalAmount;
  return { total_amount: input.nextTotalAmount, remaining_amount: remaining };
}

export function filterGifticons<T extends { name?: string | null; memo?: string | null; barcode?: string | null; expired_at?: string | null; claimed_by?: string | null; claim_expires_at?: string | null; remaining_amount?: number | null; total_amount?: number | null }>(items: T[], filter: GifticonListFilter): T[] {
  const query = filter.query?.trim().toLocaleLowerCase('ko-KR') ?? '';
  const now = filter.now ?? new Date();
  const soonCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return items.filter((item) => {
    if (query) {
      const haystack = [item.name, item.memo, item.barcode].map((value) => value?.toLocaleLowerCase('ko-KR') ?? '').join(' ');
      if (!haystack.includes(query)) return false;
    }
    if (filter.expiry === 'soon') {
      if (!item.expired_at) return false;
      const expiryTime = new Date(`${item.expired_at.slice(0, 10)}T23:59:59.999Z`).getTime();
      if (Number.isNaN(expiryTime) || expiryTime < now.getTime() || expiryTime > soonCutoff.getTime()) return false;
    }
    if (filter.claimed === 'mine') {
      const claim = claimState({ claimedBy: item.claimed_by, claimExpiresAt: item.claim_expires_at, currentUserId: filter.currentUserId, now });
      if (!claim.byMe) return false;
    }
    if (filter.amountKind === 'amount' && (item.remaining_amount == null || item.total_amount == null)) return false;
    if (filter.amountKind === 'exchange' && (item.remaining_amount != null || item.total_amount != null)) return false;
    return true;
  });
}

export function validateLoginInput(email: string, password: string): string | null {
  if (email.trim().length === 0) return '이메일을 입력해주세요.';
  if (password.length === 0) return '비밀번호를 입력해주세요.';
  return null;
}

export function claimExpiresAt(now: Date = new Date()): string {
  return new Date(now.getTime() + CLAIM_DURATION_MS).toISOString();
}

export function claimState({ claimedBy, claimExpiresAt: expiresAt, currentUserId, now = new Date() }: ClaimStateInput): ClaimState {
  if (!claimedBy) return { active: false, byMe: false, byOther: false };
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) return { active: false, byMe: false, byOther: false };
  const byMe = Boolean(currentUserId && claimedBy === currentUserId);
  return { active: true, byMe, byOther: !byMe };
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
