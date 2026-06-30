import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';

import { claimExpiresAt, editGifticonAmounts, nextStatusAfterSpend, revertLedgerEntry, usageLedgerEntry } from './domain';
import { expiryInfo } from './expiry';
import { ensureAuth, pb } from './pb';
import type { Gifticon, GifticonCreateInput, GifticonUpdateInput, Usage } from './types';

const COLLECTION = 'gifticons';
const USAGES_COLLECTION = 'usages';
const USAGE_RETRY_QUEUE_KEY = 'togeco_pending_usage_records';
type PendingUsageRecord = { gifticonId: string; payload: Record<string, unknown> };
export type GifticonSortMode = 'latest' | 'expiring';
export type GifticonStatusTab = 'DRAFT' | 'AVAILABLE' | 'USED' | 'ALL';

function moveExpiredToBottom(items: Gifticon[]): Gifticon[] {
  return [...items].sort((a, b) => {
    const aExpired = expiryInfo(a.expired_at).state === 'expired';
    const bExpired = expiryInfo(b.expired_at).state === 'expired';
    if (aExpired === bExpired) return 0;
    return aExpired ? 1 : -1;
  });
}

export async function listGifticons(sortMode: GifticonSortMode = 'latest', tab: GifticonStatusTab = 'AVAILABLE'): Promise<Gifticon[]> {
  await ensureAuth();
  const items = await pb.collection(COLLECTION).getFullList<Gifticon>({
    sort: sortMode === 'expiring' ? 'expired_at' : '-created',
    expand: 'claimed_by',
    ...(tab === 'ALL' ? {} : { filter: `status = "${tab}"` }),
  });
  if (sortMode !== 'expiring') return moveExpiredToBottom(items);
  return [...items].sort((a, b) => {
    const aState = expiryInfo(a.expired_at).state;
    const bState = expiryInfo(b.expired_at).state;
    const aExpired = aState === 'expired';
    const bExpired = bState === 'expired';
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    const aExpiry = a.expired_at?.trim();
    const bExpiry = b.expired_at?.trim();
    if (!aExpiry && !bExpiry) return 0;
    if (!aExpiry) return 1;
    if (!bExpiry) return -1;
    return aExpiry.localeCompare(bExpiry);
  });
}

export async function getGifticon(id: string): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).getOne<Gifticon>(id, { expand: 'owner,claimed_by' });
}

export async function claimGifticon(id: string): Promise<Gifticon> {
  await ensureAuth();
  const user = pb.authStore.record?.id;
  if (!user) throw new Error('로그인이 필요합니다.');
  const now = new Date();
  return pb.collection(COLLECTION).update<Gifticon>(id, { claimed_by: user, claimed_at: now.toISOString(), claim_expires_at: claimExpiresAt(now) });
}

export async function unclaimGifticon(id: string): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).update<Gifticon>(id, { claimed_by: null, claimed_at: null, claim_expires_at: null });
}

export async function publishDraftGifticon(id: string): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).update<Gifticon>(id, { status: 'AVAILABLE' });
}

export async function listGifticonUsages(id: string): Promise<Usage[]> {
  await ensureAuth();
  return pb.collection(USAGES_COLLECTION).getFullList<Usage>({
    filter: `gifticon = "${id.replaceAll('"', '\\"')}"`,
    sort: '-created',
    expand: 'user,reverted_by,reversal_of',
  });
}

export async function listRecentUsages(limit = 5): Promise<Usage[]> {
  await ensureAuth();
  return pb.collection(USAGES_COLLECTION).getList<Usage>(1, limit, {
    sort: '-created',
    expand: 'user,gifticon',
  }).then((result) => result.items);
}

export function getGifticonImageUrl(record: Gifticon): string {
  return pb.files.getURL(record, record.image);
}

export async function findGifticonByBarcode(barcode: string): Promise<Gifticon | null> {
  await ensureAuth();
  const normalized = barcode.trim();
  if (!normalized) return null;
  try {
    return await pb.collection(COLLECTION).getFirstListItem<Gifticon>(`barcode = "${normalized.replaceAll('"', '\\"')}"`);
  } catch (error) {
    if (typeof error === 'object' && error && 'status' in error && error.status === 404) return null;
    throw error;
  }
}

export async function createGifticon(input: GifticonCreateInput): Promise<Gifticon> {
  await ensureAuth();
  const owner = pb.authStore.record?.id;
  if (!owner) throw new Error('올린 사람 정보를 확인하지 못했습니다. 다시 로그인해주세요.');
  const barcode = input.barcode?.trim() ?? '';
  if (barcode) {
    const duplicate = await findGifticonByBarcode(barcode);
    if (duplicate) throw new Error('이미 등록된 바코드입니다.');
  }
  const manipulated = await ImageManipulator.manipulateAsync(
    input.imageUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const form = new FormData();
  form.append('name', input.name?.trim() ?? '');
  if (input.status === 'DRAFT') form.append('status', 'DRAFT');
  else form.append('status', 'AVAILABLE');
  form.append('owner', owner);
  form.append('memo', input.memo?.trim() ?? '');
  if (input.expiredAt) form.append('expired_at', input.expiredAt);
  if (barcode) form.append('barcode', barcode);
  if (!input.isExchange && input.totalAmount != null) {
    form.append('total_amount', String(input.totalAmount));
    form.append('remaining_amount', String(input.totalAmount));
  }
  form.append('image', { uri: manipulated.uri, name: 'gifticon.jpg', type: 'image/jpeg' } as any);
  return pb.collection(COLLECTION).create<Gifticon>(form);
}

export async function updateGifticon(input: GifticonUpdateInput): Promise<Gifticon> {
  await ensureAuth();
  const barcode = input.barcode?.trim() ?? '';
  if (barcode) {
    const duplicate = await findGifticonByBarcode(barcode);
    if (duplicate && duplicate.id !== input.id) throw new Error('이미 등록된 바코드입니다.');
  }
  const amountFields = editGifticonAmounts({
    isExchange: Boolean(input.isExchange),
    nextTotalAmount: input.totalAmount,
    currentTotalAmount: input.currentTotalAmount,
    currentRemainingAmount: input.currentRemainingAmount,
  });
  const payload = {
    name: input.name?.trim() ?? '',
    memo: input.memo?.trim() ?? '',
    expired_at: input.expiredAt || null,
    barcode: barcode || null,
    ...amountFields,
  };
  let updated = await pb.collection(COLLECTION).update<Gifticon>(input.id, payload);
  if (input.imageUri) {
    const manipulated = await ImageManipulator.manipulateAsync(
      input.imageUri,
      [{ resize: { width: 1080 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    const form = new FormData();
    form.append('image', { uri: manipulated.uri, name: 'gifticon.jpg', type: 'image/jpeg' } as any);
    updated = await pb.collection(COLLECTION).update<Gifticon>(input.id, form);
  }
  return updated;
}

export async function spendGifticon(id: string, remainingAmount: number, amount: number): Promise<Gifticon> {
  await ensureAuth();
  const next = nextStatusAfterSpend(remainingAmount, amount);
  const updated = await pb.collection(COLLECTION).update<Gifticon>(id, {
    'remaining_amount-': amount,
    ...(next.status === 'USED' ? { status: 'USED' } : {}),
  });
  await recordUsage(id, usageLedgerEntry({ actionType: 'SPEND', beforeAmount: remainingAmount, amount }));
  return updated;
}

export async function markGifticonUsed(id: string, remainingAmount: number | null = null): Promise<Gifticon> {
  await ensureAuth();
  const hasAmount = remainingAmount != null;
  const updated = await pb.collection(COLLECTION).update<Gifticon>(id, hasAmount ? { status: 'USED', remaining_amount: 0 } : { status: 'USED' });
  await recordUsage(id, usageLedgerEntry({ actionType: 'MARK_USED', beforeAmount: remainingAmount }));
  return updated;
}

async function pendingUsageRecords(): Promise<PendingUsageRecord[]> {
  const raw = await AsyncStorage.getItem(USAGE_RETRY_QUEUE_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function savePendingUsageRecords(records: PendingUsageRecord[]) {
  await AsyncStorage.setItem(USAGE_RETRY_QUEUE_KEY, JSON.stringify(records)).catch(() => undefined);
}

async function enqueueUsageRecord(record: PendingUsageRecord) {
  const records = await pendingUsageRecords();
  records.push(record);
  await savePendingUsageRecords(records.slice(-20));
}

export async function retryPendingUsageRecords(): Promise<number> {
  await ensureAuth();
  const records = await pendingUsageRecords();
  if (records.length === 0) return 0;
  const remaining: PendingUsageRecord[] = [];
  let recovered = 0;
  for (const record of records) {
    try {
      await pb.collection(USAGES_COLLECTION).create(record.payload);
      recovered += 1;
    } catch {
      remaining.push(record);
    }
  }
  await savePendingUsageRecords(remaining);
  return recovered;
}

async function recordUsage(gifticonId: string, ledger: ReturnType<typeof usageLedgerEntry> | ReturnType<typeof revertLedgerEntry>, extra: Partial<Usage> = {}): Promise<void> {
  const user = pb.authStore.record?.id;
  if (!user) return;
  const payload = { gifticon: gifticonId, user, ...ledger, ...extra };
  try {
    await pb.collection(USAGES_COLLECTION).create(payload);
  } catch {
    await enqueueUsageRecord({ gifticonId, payload });
  }
}

export async function revertUsage(gifticonId: string, usage: Usage, currentRemainingAmount: number | null): Promise<Gifticon> {
  await ensureAuth();
  const user = pb.authStore.record?.id;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (usage.reverted_at || usage.action_type === 'REVERT') throw new Error('이미 되돌렸거나 되돌릴 수 없는 사용 내역입니다.');
  const existingRevert = await pb.collection(USAGES_COLLECTION).getFirstListItem<Usage>(`reversal_of = "${usage.id.replaceAll('"', '\\"')}"`).catch(() => null);
  if (existingRevert) throw new Error('이미 되돌린 사용 내역입니다.');

  const gifticon = await getGifticon(gifticonId);
  const hasAmount = gifticon.remaining_amount != null;
  const ledger = revertLedgerEntry({ originalAmount: usage.amount, currentAmount: hasAmount ? currentRemainingAmount ?? 0 : null });
  const updatePayload = hasAmount
    ? { 'remaining_amount+': usage.amount, status: 'AVAILABLE' as const }
    : { status: 'AVAILABLE' as const };
  const updated = await pb.collection(COLLECTION).update<Gifticon>(gifticonId, updatePayload);
  const now = new Date().toISOString();
  await pb.collection(USAGES_COLLECTION).update(usage.id, { reverted_at: now, reverted_by: user }).catch(() => {});
  await recordUsage(gifticonId, ledger, { reversal_of: usage.id });
  return updated;
}

export async function deleteGifticon(id: string): Promise<boolean> {
  await ensureAuth();
  return pb.collection(COLLECTION).delete(id);
}
