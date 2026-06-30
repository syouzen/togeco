import * as ImageManipulator from 'expo-image-manipulator';

import { nextStatusAfterSpend } from './domain';
import { ensureAuth, pb } from './pb';
import type { Gifticon, GifticonCreateInput } from './types';

const COLLECTION = 'gifticons';

export async function listGifticons(): Promise<Gifticon[]> {
  await ensureAuth();
  return pb.collection(COLLECTION).getFullList<Gifticon>({ sort: '-created' });
}

export async function getGifticon(id: string): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).getOne<Gifticon>(id);
}

export function getGifticonImageUrl(record: Gifticon): string {
  return pb.files.getURL(record, record.image);
}

export async function createGifticon(input: GifticonCreateInput): Promise<Gifticon> {
  await ensureAuth();
  const manipulated = await ImageManipulator.manipulateAsync(
    input.imageUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  const form = new FormData();
  form.append('name', input.name?.trim() ?? '');
  form.append('total_amount', String(input.totalAmount));
  form.append('remaining_amount', String(input.totalAmount));
  form.append('status', 'AVAILABLE');
  form.append('memo', input.memo?.trim() ?? '');
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

export async function markGifticonUsed(id: string): Promise<Gifticon> {
  await ensureAuth();
  return pb.collection(COLLECTION).update<Gifticon>(id, { status: 'USED', remaining_amount: 0 });
}

export async function deleteGifticon(id: string): Promise<boolean> {
  await ensureAuth();
  return pb.collection(COLLECTION).delete(id);
}
