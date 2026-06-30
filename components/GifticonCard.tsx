import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatGifticonAmount } from '@/lib/domain';
import { expiryInfo, formatExpiryDday } from '@/lib/expiry';
import { getGifticonImageUrl } from '@/lib/gifticons';
import type { Gifticon } from '@/lib/types';

type Props = { item: Gifticon; onPress: () => void };

export function GifticonCard({ item, onPress }: Props) {
  const used = item.status === 'USED';
  const expiry = expiryInfo(item.expired_at);
  const expiryLabel = formatExpiryDday(expiry);
  const expired = expiry.state === 'expired';
  return (
    <Pressable style={({ pressed }) => [styles.card, expired && styles.expiredCard, pressed && styles.pressed]} onPress={onPress}>
      <Image source={{ uri: getGifticonImageUrl(item) }} style={styles.thumbnail} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{item.name?.trim() || '이름 없는 기프티콘'}</Text>
          {expiryLabel ? <View style={[styles.badge, styles.expiryBadge, expiry.state === 'soon' && styles.soonBadge, expired && styles.expiredBadge]}><Text style={[styles.badgeText, styles.expiryText, expiry.state === 'soon' && styles.soonText, expired && styles.expiredText]}>{expiryLabel}</Text></View> : null}
          <View style={[styles.badge, used ? styles.usedBadge : styles.availableBadge]}><Text style={[styles.badgeText, used ? styles.usedText : styles.availableText]}>{used ? '다 씀' : '사용가능'}</Text></View>
        </View>
        <Text style={styles.amount}>{formatGifticonAmount(item.remaining_amount, item.total_amount)}</Text>
        {item.expired_at ? <Text style={[styles.meta, expired && styles.expiredMeta]}>유효기간 {item.expired_at.slice(0, 10)}</Text> : null}
        {item.memo ? <Text style={styles.memo} numberOfLines={1}>{item.memo}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, borderRadius: 22, backgroundColor: '#fff', padding: 14, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  expiredCard: { opacity: 0.58, backgroundColor: '#f3f4f6' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  thumbnail: { width: 82, height: 82, borderRadius: 16, backgroundColor: '#e5e7eb' },
  body: { flex: 1, justifyContent: 'center', gap: 7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111827' },
  amount: { fontSize: 15, fontWeight: '700', color: '#374151' },
  meta: { color: '#4f46e5', fontWeight: '700' },
  expiredMeta: { color: '#6b7280' },
  memo: { color: '#6b7280' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  availableBadge: { backgroundColor: '#dcfce7' },
  usedBadge: { backgroundColor: '#fee2e2' },
  expiryBadge: { backgroundColor: '#eef2ff' },
  soonBadge: { backgroundColor: '#fef3c7' },
  expiredBadge: { backgroundColor: '#e5e7eb' },
  badgeText: { fontSize: 12, fontWeight: '900' },
  availableText: { color: '#15803d' },
  usedText: { color: '#b91c1c' },
  expiryText: { color: '#4338ca' },
  soonText: { color: '#b45309' },
  expiredText: { color: '#4b5563' },
});
