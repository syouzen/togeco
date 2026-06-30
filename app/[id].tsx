import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { BarcodeZoom } from '@/components/BarcodeZoom';
import { useRealtimeGifticons } from '@/hooks/useRealtimeGifticons';
import { formatGifticonAmount, formatWon } from '@/lib/domain';
import { expiryInfo, formatExpiryDday } from '@/lib/expiry';
import { claimGifticon, deleteGifticon, getGifticon, getGifticonImageUrl, listGifticonUsages, markGifticonUsed, spendGifticon, unclaimGifticon } from '@/lib/gifticons';
import { isAuthenticated, pb } from '@/lib/pb';
import { hasPushPermission } from '@/lib/push';
import { beforeExpiry, cancelReminder, dateOnly, isPastReminderDate, myReminder, setReminder } from '@/lib/reminders';
import { displayUser } from '@/lib/users';

function formatUsageTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatReminderDate(value?: string) {
  return value ? value.slice(0, 10) : '';
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [spendOpen, setSpendOpen] = useState(false);
  const [barcodeZoomOpen, setBarcodeZoomOpen] = useState(false);
  const [customReminderOpen, setCustomReminderOpen] = useState(false);
  const [customReminderDate, setCustomReminderDate] = useState(dateOnly(new Date()));
  const query = useQuery({ queryKey: ['gifticons', id], queryFn: () => getGifticon(id), enabled: Boolean(id) && isAuthenticated() });
  const usageQuery = useQuery({ queryKey: ['usages', id], queryFn: () => listGifticonUsages(id), enabled: Boolean(id) && isAuthenticated() });
  const reminderQuery = useQuery({ queryKey: ['reminders', id], queryFn: () => myReminder(id), enabled: Boolean(id) && isAuthenticated() });
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
  const reminderMutation = useMutation({ mutationFn: (remindAt: string) => setReminder(id, remindAt), onSuccess: async () => { setCustomReminderOpen(false); await invalidate(); Alert.alert('알림 설정 완료', '설정한 날짜 오전 9시 이후에 내 기기로 알림을 보냅니다.'); }, onError: () => Alert.alert('알림 설정 실패', '리마인더를 저장하지 못했습니다.') });
  const cancelReminderMutation = useMutation({ mutationFn: (reminderId: string) => cancelReminder(reminderId), onSuccess: invalidate, onError: () => Alert.alert('알림 끄기 실패', '리마인더를 삭제하지 못했습니다.') });
  const deleteMutation = useMutation({ mutationFn: () => deleteGifticon(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); }, onError: () => Alert.alert('삭제 실패', '삭제에 실패했습니다.') });
  const confirmDelete = () => Alert.alert('삭제할까요?', '삭제한 기프티콘은 되돌릴 수 없습니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteMutation.mutate() }]);
  if (query.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>;
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
  const reminder = reminderQuery.data;
  const canSpend = hasAmount && !used;
  const confirmClaimedByOther = (action: () => void) => {
    if (!claimedByOther) { action(); return; }
    Alert.alert('다른 사람이 찜했어요', `${displayUser(claimedUser)}이 찜했어요. 그래도 사용할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '사용', style: 'destructive', onPress: action },
    ]);
  };
  const applyReminder = (remindAt: string) => {
    if (isPastReminderDate(remindAt)) {
      Alert.alert('지난 날짜예요', '오늘 이후 날짜로 알림을 설정해주세요.');
      return;
    }
    reminderMutation.mutate(remindAt);
  };
  const openCustomReminder = () => {
    setCustomReminderDate(reminder?.remind_at ? formatReminderDate(reminder.remind_at) : dateOnly(new Date()));
    setCustomReminderOpen(true);
  };
  const openReminderOptions = async () => {
    if (!(await hasPushPermission())) {
      Alert.alert('알림 권한 필요', '기기 알림 권한과 push token 등록이 있어야 리마인더를 받을 수 있습니다. 로그인 후 권한을 허용해주세요.');
    }
    const buttons = [
      ...(item.expired_at ? [
        { text: '만료 7일 전', onPress: () => applyReminder(beforeExpiry(item.expired_at!, 7)) },
        { text: '만료 1일 전', onPress: () => applyReminder(beforeExpiry(item.expired_at!, 1)) },
      ] : []),
      { text: '날짜 직접 입력', onPress: openCustomReminder },
      { text: '취소', style: 'cancel' as const },
    ];
    Alert.alert('알림 설정', '알림은 나에게만 1회 전송됩니다.', buttons);
  };
  const submitCustomReminder = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customReminderDate)) {
      Alert.alert('날짜 형식 확인', 'YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    applyReminder(customReminderDate);
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
          <Text style={styles.reminderText}>{reminder ? `${formatReminderDate(reminder.remind_at)} 알림 예정` : '알림이 설정되지 않았습니다.'}</Text>
          <Text style={styles.reminderHelp}>내 기기로만 1회 전송됩니다. 알림 권한과 push token 등록이 필요합니다.</Text>
          <View style={styles.inlineActions}>
            <Pressable style={[styles.inlineAction, styles.claim]} disabled={reminderMutation.isPending} onPress={openReminderOptions}><Text style={styles.claimButtonText}>{reminder ? '알림 변경' : '알림 설정'}</Text></Pressable>
            {reminder ? <Pressable style={[styles.inlineAction, styles.danger]} disabled={cancelReminderMutation.isPending} onPress={() => cancelReminderMutation.mutate(reminder.id)}><Text style={styles.dangerText}>알림 끄기</Text></Pressable> : null}
          </View>
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
      <Modal transparent animationType="fade" visible={customReminderOpen} onRequestClose={() => setCustomReminderOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>알림 날짜 직접 입력</Text>
            <Text style={styles.reminderHelp}>YYYY-MM-DD 형식으로 오늘 이후 날짜를 입력해주세요.</Text>
            <TextInput value={customReminderDate} onChangeText={setCustomReminderDate} placeholder="2026-07-20" style={styles.input} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <View style={styles.inlineActions}>
              <Pressable style={[styles.inlineAction, styles.secondary]} onPress={() => setCustomReminderOpen(false)}><Text style={styles.secondaryText}>취소</Text></Pressable>
              <Pressable style={[styles.inlineAction, styles.primary]} disabled={reminderMutation.isPending} onPress={submitCustomReminder}><Text style={styles.primaryText}>저장</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, gap: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 24 },
  image: { width: '100%', height: 460, borderRadius: 26, backgroundColor: '#e5e7eb' },
  panel: { borderRadius: 24, backgroundColor: '#fff', padding: 18, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: 24, fontWeight: '900', color: '#111827' },
  amount: { fontSize: 20, fontWeight: '900', color: '#374151' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#111827' },
  meta: { color: '#4f46e5', fontWeight: '800' },
  claimText: { color: '#6b7280', fontWeight: '900' },
  claimMine: { color: '#15803d' },
  claimOther: { color: '#b45309' },
  reminderText: { color: '#111827', fontWeight: '900' },
  reminderHelp: { color: '#6b7280', lineHeight: 20 },
  memo: { color: '#6b7280', lineHeight: 21 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
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
  expiredMeta: { color: '#6b7280' },
  actions: { gap: 12 },
  inlineActions: { flexDirection: 'row', gap: 10 },
  action: { borderRadius: 18, alignItems: 'center', paddingVertical: 16 },
  inlineAction: { flex: 1, borderRadius: 16, alignItems: 'center', paddingVertical: 14 },
  zoom: { backgroundColor: '#111827' },
  claim: { backgroundColor: '#dcfce7' },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#eef2ff' },
  danger: { backgroundColor: '#fee2e2' },
  disabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  zoomText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  claimButtonText: { color: '#15803d', fontWeight: '900', fontSize: 16 },
  secondaryText: { color: '#3730a3', fontWeight: '900', fontSize: 16 },
  dangerText: { color: '#b91c1c', fontWeight: '900', fontSize: 16 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  usageUser: { color: '#111827', fontWeight: '900' },
  usageTime: { color: '#6b7280', marginTop: 3 },
  usageAmount: { color: '#111827', fontWeight: '900' },
  emptyUsage: { color: '#6b7280', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', borderRadius: 24, backgroundColor: '#fff', padding: 18, gap: 12 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: '#111827', fontWeight: '800' },
});
