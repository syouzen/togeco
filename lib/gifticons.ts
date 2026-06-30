import * as ImageManipulator from 'expo-image-manipulator';

import { nextStatusAfterSpend } from './domain';
import { ensureAuth, pb } from './pb';
import type { Gifticon, GifticonCreateInput } from './types';

const COLLECTION = 'gifticons';
export type GifticonSortMode = 'latest' | 'expiring';
export type GifticonStatusTab = 'AVAILABLE' | 'USED' | 'ALL';

export async function listGifticons(sortMode: GifticonSortMode = 'latest', tab: GifticonStatusTab = 'AVAILABLE'): Promise<Gifticon[]> {
  await ensureAuth();
  const items = await pb.collection(COLLECTION).getFullList<Gifticon>({
    sort: sortMode === 'expiring' ? 'expired_at' : '-created',
    ...(tab === 'ALL' ? {} : { filter: `status = "${tab}"` }),
  });
  if (sortMode !== 'expiring') return items;
  return [...items].sort((a, b) => {
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
  return pb.collection(COLLECTION).getOne<Gifticon>(id);
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
  form.append('status', 'AVAILABLE');
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

export async function spendGifticon(id: string, remainingAmount: number, amount: number): Promise<Gifticon> {
  await ensureAuth();
  const next = nextStatusAfterSpend(remainingAmount, amount);
  return pb.collection(COLLECTION).update<Gifticon>(id, {
    'remaining_amount-': amount,
    ...(next.status === 'USED' ? { status: 'USED' } : {}),
  });
}

export async function markGifticonUsed(id: string, hasAmount = true): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).update<Gifticon>(id, hasAmount ? { status: 'USED', remaining_amount: 0 } : { status: 'USED' });
}

export async function deleteGifticon(id: string): Promise<boolean> {
  await ensureAuth();
  return pb.collection(COLLECTION).delete(id);
}
