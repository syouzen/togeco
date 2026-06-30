import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { BarcodeZoom } from '@/components/BarcodeZoom';
import { useRealtimeGifticons } from '@/hooks/useRealtimeGifticons';
import { formatGifticonAmount, formatWon } from '@/lib/domain';
import { expiryInfo, formatExpiryDday } from '@/lib/expiry';
import { deleteGifticon, getGifticon, getGifticonImageUrl, listGifticonUsages, markGifticonUsed, spendGifticon } from '@/lib/gifticons';
import { isAuthenticated } from '@/lib/pb';
import type { UserSummary } from '@/lib/types';

function displayUser(user?: UserSummary) {
  return user?.name?.trim() || user?.email?.trim() || '알 수 없음';
}

function formatUsageTime(value: string) {
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [spendOpen, setSpendOpen] = useState(false);
  const [barcodeZoomOpen, setBarcodeZoomOpen] = useState(false);
  const query = useQuery({ queryKey: ['gifticons', id], queryFn: () => getGifticon(id), enabled: Boolean(id) && isAuthenticated() });
  const usageQuery = useQuery({ queryKey: ['usages', id], queryFn: () => listGifticonUsages(id), enabled: Boolean(id) && isAuthenticated() });
  const { refetch } = query;
  useRealtimeGifticons(id);
  useFocusEffect(useCallback(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    refetch();
  }, [refetch]));
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); await queryClient.invalidateQueries({ queryKey: ['gifticons', id] }); await queryClient.invalidateQueries({ queryKey: ['usages', id] }); };
  const hasAmount = query.data?.remaining_amount != null && query.data?.total_amount != null;
  const spendMutation = useMutation({ mutationFn: (amount: number) => spendGifticon(id, query.data?.remaining_amount ?? 0, amount), onSuccess: async () => { setSpendOpen(false); await invalidate(); }, onError: () => Alert.alert('차감 실패', '잔액 차감에 실패했습니다. 다시 시도해주세요.') });
  const usedMutation = useMutation({ mutationFn: () => markGifticonUsed(id, hasAmount ? query.data?.remaining_amount ?? 0 : null), onSuccess: invalidate, onError: () => Alert.alert('처리 실패', '다 씀 처리에 실패했습니다.') });
  const deleteMutation = useMutation({ mutationFn: () => deleteGifticon(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); }, onError: () => Alert.alert('삭제 실패', '삭제에 실패했습니다.') });
  const confirmDelete = () => Alert.alert('삭제할까요?', '삭제한 기프티콘은 되돌릴 수 없습니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteMutation.mutate() }]);
  if (query.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>;
  if (!query.data) return <View style={styles.center}><Text style={styles.title}>기프티콘을 찾지 못했습니다.</Text></View>;
  const item = query.data;
  const used = item.status === 'USED';
  const expiry = expiryInfo(item.expired_at);
  const expiryLabel = formatExpiryDday(expiry);
  const imageUri = getGifticonImageUrl(item);
  const canSpend = hasAmount && !used;
  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Image source={{ uri: imageUri }} style={styles.image} />
        <View style={styles.panel}>
          <View style={styles.titleRow}><Text style={styles.title}>{item.name?.trim() || '이름 없는 기프티콘'}</Text>{expiryLabel ? <View style={[styles.badge, styles.expiryBadge, expiry.state === 'soon' && styles.soonBadge, expiry.state === 'expired' && styles.expiredBadge]}><Text style={[styles.badgeText, styles.expiryText, expiry.state === 'soon' && styles.soonText, expiry.state === 'expired' && styles.expiredText]}>{expiryLabel}</Text></View> : null}<View style={[styles.badge, used ? styles.usedBadge : styles.availableBadge]}><Text style={[styles.badgeText, used ? styles.usedText : styles.availableText]}>{used ? '다 씀' : '사용가능'}</Text></View></View>
          <Text style={styles.amount}>{formatGifticonAmount(item.remaining_amount, item.total_amount)}</Text>
          <Text style={styles.meta}>올린 사람 {displayUser(item.expand?.owner)}</Text>
          {item.expired_at ? <Text style={[styles.meta, expiry.state === 'expired' && styles.expiredMeta]}>유효기간 {item.expired_at.slice(0, 10)}</Text> : null}
          {item.barcode ? <Text style={styles.meta}>바코드 {item.barcode}</Text> : null}
          {item.memo ? <Text style={styles.memo}>{item.memo}</Text> : null}
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.action, styles.zoom]} onPress={() => setBarcodeZoomOpen(true)}><Text style={styles.zoomText}>바코드 크게</Text></Pressable>
          <Pressable style={[styles.action, styles.primary, !canSpend && styles.disabled]} disabled={!canSpend || spendMutation.isPending} onPress={() => setSpendOpen(true)}><Text style={styles.primaryText}>부분 차감</Text></Pressable>
          <Pressable style={[styles.action, styles.secondary]} disabled={usedMutation.isPending} onPress={() => usedMutation.mutate()}><Text style={styles.secondaryText}>다 씀</Text></Pressable>
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
  action: { borderRadius: 18, alignItems: 'center', paddingVertical: 16 },
  zoom: { backgroundColor: '#111827' },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#eef2ff' },
  danger: { backgroundColor: '#fee2e2' },
  disabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  zoomText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryText: { color: '#3730a3', fontWeight: '900', fontSize: 16 },
  dangerText: { color: '#b91c1c', fontWeight: '900', fontSize: 16 },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  usageUser: { color: '#111827', fontWeight: '900' },
  usageTime: { color: '#6b7280', marginTop: 3 },
  usageAmount: { color: '#111827', fontWeight: '900' },
  emptyUsage: { color: '#6b7280', fontWeight: '700' },
});
