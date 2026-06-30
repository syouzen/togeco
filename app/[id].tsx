import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { BarcodeZoom } from '@/components/BarcodeZoom';
import { useRealtimeGifticons } from '@/hooks/useRealtimeGifticons';
import { formatGifticonAmount, formatWon } from '@/lib/domain';
import { expiryInfo, formatExpiryDday } from '@/lib/expiry';
import { claimGifticon, deleteGifticon, getGifticon, getGifticonImageUrl, listGifticonUsages, markGifticonUsed, spendGifticon, unclaimGifticon } from '@/lib/gifticons';
import { isAuthenticated, pb } from '@/lib/pb';
import { beforeExpiry, cancelReminder, DEFAULT_EXPIRY_REMINDER_OFFSETS, isPastReminderDate, myReminders, setReminder } from '@/lib/reminders';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { displayUser } from '@/lib/users';

function formatUsageTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatReminderDate(value?: string) {
  return value ? value.slice(0, 10) : '';
}

function formatReminderLabel(offsetDays: number) {
  return `만료 ${offsetDays}일 전`;
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [spendOpen, setSpendOpen] = useState(false);
  const [barcodeZoomOpen, setBarcodeZoomOpen] = useState(false);
  const query = useQuery({ queryKey: ['gifticons', id], queryFn: () => getGifticon(id), enabled: Boolean(id) && isAuthenticated() });
  const usageQuery = useQuery({ queryKey: ['usages', id], queryFn: () => listGifticonUsages(id), enabled: Boolean(id) && isAuthenticated() });
  const reminderQuery = useQuery({ queryKey: ['reminders', id], queryFn: () => myReminders(id), enabled: Boolean(id) && isAuthenticated() });
  const { refetch } = query;
  useRealtimeGifticons(id);
  useFocusEffect(useCallback(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    refetch();
    reminderQuery.refetch();
  }, [refetch, reminderQuery]));
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['gifticons'] });
    await queryClient.invalidateQueries({ queryKey: ['gifticons', id] });
    await queryClient.invalidateQueries({ queryKey: ['usages', id] });
    await queryClient.invalidateQueries({ queryKey: ['reminders', id] });
  };
  const hasAmount = query.data?.remaining_amount != null && query.data?.total_amount != null;
  const spendMutation = useMutation({ mutationFn: (amount: number) => spendGifticon(id, query.data?.remaining_amount ?? 0, amount), onSuccess: async () => { setSpendOpen(false); await invalidate(); }, onError: () => Alert.alert('차감 실패', '잔액 차감에 실패했습니다. 다시 시도해주세요.') });
  const usedMutation = useMutation({ mutationFn: () => markGifticonUsed(id, hasAmount ? query.data?.remaining_amount ?? 0 : null), onSuccess: invalidate, onError: () => Alert.alert('처리 실패', '다 씀 처리에 실패했습니다.') });
  const claimMutation = useMutation({ mutationFn: () => claimGifticon(id), onSuccess: invalidate, onError: () => Alert.alert('찜 실패', '찜 상태를 저장하지 못했습니다.') });
  const unclaimMutation = useMutation({ mutationFn: () => unclaimGifticon(id), onSuccess: invalidate, onError: () => Alert.alert('찜 해제 실패', '찜을 해제하지 못했습니다.') });
  const reminderMutation = useMutation({ mutationFn: ({ remindAt, offsetDays }: { remindAt: Date; offsetDays: number }) => setReminder(id, itemName, remindAt, offsetDays), onSuccess: async () => { await invalidate(); }, onError: (error) => Alert.alert('알림 설정 실패', error instanceof Error ? error.message : '리마인더를 저장하지 못했습니다.') });
  const cancelReminderMutation = useMutation({ mutationFn: (reminderId: string) => cancelReminder(reminderId), onSuccess: invalidate, onError: () => Alert.alert('알림 끄기 실패', '리마인더를 삭제하지 못했습니다.') });
  const deleteMutation = useMutation({ mutationFn: () => deleteGifticon(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); }, onError: () => Alert.alert('삭제 실패', '삭제에 실패했습니다.') });
  const confirmDelete = () => Alert.alert('삭제할까요?', '삭제한 기프티콘은 되돌릴 수 없습니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteMutation.mutate() }]);
  if (query.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!query.data) return <View style={styles.center}><Text style={styles.title}>기프티콘을 찾지 못했습니다.</Text></View>;
  const item = query.data;
  const used = item.status === 'USED';
  const expiry = expiryInfo(item.expired_at);
  const expiryLabel = formatExpiryDday(expiry);
  const imageUri = getGifticonImageUrl(item);
  const currentUserId = pb.authStore.record?.id;
  const claimedUser = item.expand?.claimed_by;
  const claimedByMe = Boolean(item.claimed_by && item.claimed_by === currentUserId);
  const claimedByOther = Boolean(item.claimed_by && item.claimed_by !== currentUserId);
  const claimText = claimedByMe ? '내가 사용 예정' : claimedByOther ? `${displayUser(claimedUser)}이 사용 예정` : '아직 찜 없음';
  const reminders = reminderQuery.data ?? [];
  const itemName = item.name?.trim() || '기프티콘';
  const canSpend = hasAmount && !used;
  const confirmClaimedByOther = (action: () => void) => {
    if (!claimedByOther) { action(); return; }
    Alert.alert('다른 사람이 찜했어요', `${displayUser(claimedUser)}이 찜했어요. 그래도 사용할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '사용', style: 'destructive', onPress: action },
    ]);
  };
  const applyReminder = (offsetDays: number) => {
    if (!item.expired_at) {
      Alert.alert('유효기간 필요', '유효기간이 있어야 만료 전 알림을 설정할 수 있습니다.');
      return;
    }
    const remindAt = beforeExpiry(item.expired_at, offsetDays);
    if (isPastReminderDate(remindAt)) {
      Alert.alert('지난 날짜예요', '이미 지난 알림은 설정할 수 없습니다.');
      return;
    }
    reminderMutation.mutate({ remindAt, offsetDays });
  };
  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Image source={{ uri: imageUri }} style={styles.image} />
        <View style={styles.panel}>
          <View style={styles.titleRow}><Text style={styles.title}>{item.name?.trim() || '이름 없는 기프티콘'}</Text>{expiryLabel ? <View style={[styles.badge, styles.expiryBadge, expiry.state === 'soon' && styles.soonBadge, expiry.state === 'expired' && styles.expiredBadge]}><Text style={[styles.badgeText, styles.expiryText, expiry.state === 'soon' && styles.soonText, expiry.state === 'expired' && styles.expiredText]}>{expiryLabel}</Text></View> : null}<View style={[styles.badge, used ? styles.usedBadge : styles.availableBadge]}><Text style={[styles.badgeText, used ? styles.usedText : styles.availableText]}>{used ? '다 씀' : '사용가능'}</Text></View></View>
          <Text style={styles.amount}>{formatGifticonAmount(item.remaining_amount, item.total_amount)}</Text>
          <Text style={styles.meta}>올린 사람 {displayUser(item.expand?.owner)}</Text>
          <Text style={[styles.claimText, claimedByMe && styles.claimMine, claimedByOther && styles.claimOther]}>{claimText}</Text>
          {item.expired_at ? <Text style={[styles.meta, expiry.state === 'expired' && styles.expiredMeta]}>유효기간 {item.expired_at.slice(0, 10)}</Text> : null}
          {item.barcode ? <Text style={styles.meta}>바코드 {item.barcode}</Text> : null}
          {item.memo ? <Text style={styles.memo}>{item.memo}</Text> : null}
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>개인 알림</Text>
          {DEFAULT_EXPIRY_REMINDER_OFFSETS.map((offsetDays) => {
            const reminder = reminders.find((itemReminder) => itemReminder.offset_days === offsetDays);
            const disabled = reminderMutation.isPending || cancelReminderMutation.isPending;
            return (
              <View key={offsetDays} style={styles.reminderRow}>
                <View style={styles.checkIcon}><Text style={styles.checkIconText}>{reminder ? '✓' : ''}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderText}>{formatReminderLabel(offsetDays)}</Text>
                  <Text style={styles.reminderHelp}>{reminder ? `${formatReminderDate(reminder.remind_at)} 알림 예정` : '꺼짐'}</Text>
                </View>
                {reminder ? (
                  <Pressable style={[styles.smallDanger, disabled && styles.disabled]} disabled={disabled} onPress={() => cancelReminderMutation.mutate(reminder.id)}><Text style={styles.dangerText}>끄기</Text></Pressable>
                ) : (
                  <Pressable style={[styles.smallAction, disabled && styles.disabled]} disabled={disabled} onPress={() => applyReminder(offsetDays)}><Text style={styles.secondaryText}>켜기</Text></Pressable>
                )}
              </View>
            );
          })}
          <Text style={styles.reminderHelp}>알림은 유효기간 기준 30/7/3/1일 전만 지원합니다. 이미 지난 날짜는 자동으로 제외됩니다.</Text>
        </View>
        <View style={styles.actions}>
          {claimedByMe ? <Pressable style={[styles.action, styles.secondary]} disabled={unclaimMutation.isPending} onPress={() => unclaimMutation.mutate()}><Text style={styles.secondaryText}>찜 해제</Text></Pressable> : !item.claimed_by ? <Pressable style={[styles.action, styles.claim]} disabled={claimMutation.isPending} onPress={() => claimMutation.mutate()}><Text style={styles.claimButtonText}>찜하기</Text></Pressable> : null}
          <Pressable style={[styles.action, styles.zoom]} onPress={() => setBarcodeZoomOpen(true)}><Text style={styles.zoomText}>바코드 크게</Text></Pressable>
          <Pressable style={[styles.action, styles.primary, !canSpend && styles.disabled]} disabled={!canSpend || spendMutation.isPending} onPress={() => confirmClaimedByOther(() => setSpendOpen(true))}><Text style={styles.primaryText}>부분 차감</Text></Pressable>
          <Pressable style={[styles.action, styles.secondary]} disabled={usedMutation.isPending} onPress={() => confirmClaimedByOther(() => usedMutation.mutate())}><Text style={styles.secondaryText}>다 씀</Text></Pressable>
          <Pressable style={[styles.action, styles.danger]} disabled={deleteMutation.isPending} onPress={confirmDelete}><Text style={styles.dangerText}>삭제</Text></Pressable>
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>사용 내역</Text>
          {usageQuery.data?.length ? usageQuery.data.map((usage) => (
            <View key={usage.id} style={styles.usageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.usageUser}>{displayUser(usage.expand?.user)}</Text>
                <Text style={styles.usageTime}>{formatUsageTime(usage.created)}</Text>
              </View>
              <Text style={styles.usageAmount}>{usage.amount === 0 ? '사용함' : formatWon(usage.amount)}</Text>
            </View>
          )) : <Text style={styles.emptyUsage}>{usageQuery.isLoading ? '사용 내역 확인 중...' : '사용 내역이 없습니다.'}</Text>}
        </View>
      </ScrollView>
      {hasAmount ? <AmountModal visible={spendOpen} remainingAmount={item.remaining_amount ?? 0} isSaving={spendMutation.isPending} onClose={() => setSpendOpen(false)} onSubmit={(amount) => spendMutation.mutate(amount)} /> : null}
      <BarcodeZoom uri={imageUri} visible={barcodeZoomOpen} onClose={() => setBarcodeZoomOpen(false)} />
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  image: { width: '100%', height: 460, borderRadius: 26, backgroundColor: colors.disabled },
  panel: { borderRadius: 24, backgroundColor: colors.surface, padding: 18, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 24, fontWeight: '900', color: colors.text },
  amount: { fontSize: 20, fontWeight: '900', color: colors.textMuted },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  meta: { color: colors.primarySoftText, fontWeight: '800' },
  claimText: { color: colors.textSubtle, fontWeight: '900' },
  claimMine: { color: colors.success },
  claimOther: { color: colors.warningText },
  reminderText: { color: colors.text, fontWeight: '900' },
  reminderHelp: { color: colors.textSubtle, lineHeight: 20 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.surfaceMuted, paddingTop: 10 },
  checkIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft },
  checkIconText: { color: colors.success, fontWeight: '900' },
  smallAction: { borderRadius: 999, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8 },
  smallDanger: { borderRadius: 999, backgroundColor: colors.dangerSoft, paddingHorizontal: 12, paddingVertical: 8 },
  memo: { color: colors.textSubtle, lineHeight: 21 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  availableBadge: { backgroundColor: colors.successSoft },
  usedBadge: { backgroundColor: colors.dangerSoft },
  expiryBadge: { backgroundColor: colors.primarySoft },
  soonBadge: { backgroundColor: colors.warningSoft },
  expiredBadge: { backgroundColor: colors.disabled },
  badgeText: { fontSize: 12, fontWeight: '900' },
  availableText: { color: colors.success },
  usedText: { color: colors.dangerText },
  expiryText: { color: colors.primarySoftText },
  soonText: { color: colors.warningText },
  expiredText: { color: colors.textMuted },
  expiredMeta: { color: colors.textSubtle },
  actions: { gap: 12 },
  action: { borderRadius: 18, alignItems: 'center', paddingVertical: 16 },
  zoom: { backgroundColor: colors.text },
  claim: { backgroundColor: colors.successSoft },
  primary: { backgroundColor: colors.text },
  secondary: { backgroundColor: colors.primarySoft },
  danger: { backgroundColor: colors.dangerSoft },
  disabled: { opacity: 0.45 },
  primaryText: { color: colors.surface, fontWeight: '900', fontSize: 16 },
  zoomText: { color: colors.surface, fontWeight: '900', fontSize: 16 },
  claimButtonText: { color: colors.success, fontWeight: '900', fontSize: 16 },
  secondaryText: { color: colors.primarySoftText, fontWeight: '900', fontSize: 16 },
  dangerText: { color: colors.dangerText, fontWeight: '900', fontSize: 16 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.surfaceMuted, paddingTop: 12 },
  usageUser: { color: colors.text, fontWeight: '900' },
  usageTime: { color: colors.textSubtle, marginTop: 3 },
  usageAmount: { color: colors.text, fontWeight: '900' },
  emptyUsage: { color: colors.textSubtle, fontWeight: '700' },
});
