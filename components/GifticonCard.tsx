import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatGifticonAmount } from '@/lib/domain';
import { expiryInfo, formatExpiryDday } from '@/lib/expiry';
import { getGifticonImageUrl } from '@/lib/gifticons';
import { pb } from '@/lib/pb';
import { useTheme, type ThemeColors } from '@/lib/theme';
import type { Gifticon } from '@/lib/types';
import { displayUser } from '@/lib/users';

type Props = { item: Gifticon; onPress: () => void };

export function GifticonCard({ item, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const used = item.status === 'USED';
  const expiry = expiryInfo(item.expired_at);
  const expiryLabel = formatExpiryDday(expiry);
  const expired = expiry.state === 'expired';
  const currentUserId = pb.authStore.record?.id;
  const claimedByMe = Boolean(item.claimed_by && item.claimed_by === currentUserId);
  const claimedByOther = Boolean(item.claimed_by && item.claimed_by !== currentUserId);
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
        {item.claimed_by ? <Text style={[styles.claimText, claimedByMe && styles.claimMine, claimedByOther && styles.claimOther]}>{claimedByMe ? '내 찜' : `${displayUser(item.expand?.claimed_by)} 사용 예정`}</Text> : null}
        {item.expired_at ? <Text style={[styles.meta, expired && styles.expiredMeta]}>유효기간 {item.expired_at.slice(0, 10)}</Text> : null}
        {item.memo ? <Text style={styles.memo} numberOfLines={1}>{item.memo}</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, borderRadius: 22, backgroundColor: colors.surface, padding: 14, shadowColor: colors.shadow, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2, borderWidth: 1, borderColor: colors.border },
  expiredCard: { opacity: 0.58, backgroundColor: colors.surfaceMuted },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  thumbnail: { width: 82, height: 82, borderRadius: 16, backgroundColor: colors.disabled },
  body: { flex: 1, justifyContent: 'center', gap: 7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text },
  amount: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  meta: { color: colors.primarySoftText, fontWeight: '700' },
  claimText: { color: colors.textSubtle, fontWeight: '900' },
  claimMine: { color: colors.success },
  claimOther: { color: colors.warningText },
  expiredMeta: { color: colors.textSubtle },
  memo: { color: colors.textSubtle },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  availableBadge: { backgroundColor: colors.successSoft },
  usedBadge: { backgroundColor: colors.dangerSoft },
  expiryBadge: { backgroundColor: colors.primarySoft },
  soonBadge: { backgroundColor: colors.warningSoft },
  expiredBadge: { backgroundColor: colors.surfaceMuted },
  badgeText: { fontSize: 12, fontWeight: '900' },
  availableText: { color: colors.successText },
  usedText: { color: colors.dangerText },
  expiryText: { color: colors.primarySoftText },
  soonText: { color: colors.warningText },
  expiredText: { color: colors.textMuted },
});
