import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { formatWon } from '@/lib/domain';
import { deleteGifticon, getGifticon, getGifticonImageUrl, markGifticonUsed, spendGifticon } from '@/lib/gifticons';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [spendOpen, setSpendOpen] = useState(false);
  const query = useQuery({ queryKey: ['gifticons', id], queryFn: () => getGifticon(id), enabled: Boolean(id) });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); await queryClient.invalidateQueries({ queryKey: ['gifticons', id] }); };
  const spendMutation = useMutation({ mutationFn: (amount: number) => spendGifticon(id, query.data?.remaining_amount ?? 0, amount), onSuccess: async () => { setSpendOpen(false); await invalidate(); }, onError: () => Alert.alert('차감 실패', '잔액 차감에 실패했습니다. 다시 시도해주세요.') });
  const usedMutation = useMutation({ mutationFn: () => markGifticonUsed(id), onSuccess: invalidate, onError: () => Alert.alert('처리 실패', '다 씀 처리에 실패했습니다.') });
  const deleteMutation = useMutation({ mutationFn: () => deleteGifticon(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); }, onError: () => Alert.alert('삭제 실패', '삭제에 실패했습니다.') });
  const confirmDelete = () => Alert.alert('삭제할까요?', '삭제한 기프티콘은 되돌릴 수 없습니다.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteMutation.mutate() }]);
  if (query.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>;
  if (!query.data) return <View style={styles.center}><Text style={styles.title}>기프티콘을 찾지 못했습니다.</Text></View>;
  const item = query.data;
  const used = item.status === 'USED';
  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Image source={{ uri: getGifticonImageUrl(item) }} style={styles.image} />
        <View style={styles.panel}>
          <View style={styles.titleRow}><Text style={styles.title}>{item.name?.trim() || '이름 없는 기프티콘'}</Text><View style={[styles.badge, used ? styles.usedBadge : styles.availableBadge]}><Text style={[styles.badgeText, used ? styles.usedText : styles.availableText]}>{used ? '다 씀' : '사용가능'}</Text></View></View>
          <Text style={styles.amount}>{formatWon(item.remaining_amount)} / {formatWon(item.total_amount)}</Text>
          {item.memo ? <Text style={styles.memo}>{item.memo}</Text> : null}
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.action, styles.primary, used && styles.disabled]} disabled={used || spendMutation.isPending} onPress={() => setSpendOpen(true)}><Text style={styles.primaryText}>부분 차감</Text></Pressable>
          <Pressable style={[styles.action, styles.secondary]} disabled={usedMutation.isPending} onPress={() => usedMutation.mutate()}><Text style={styles.secondaryText}>다 씀</Text></Pressable>
          <Pressable style={[styles.action, styles.danger]} disabled={deleteMutation.isPending} onPress={confirmDelete}><Text style={styles.dangerText}>삭제</Text></Pressable>
        </View>
      </ScrollView>
      <AmountModal visible={spendOpen} remainingAmount={item.remaining_amount} isSaving={spendMutation.isPending} onClose={() => setSpendOpen(false)} onSubmit={(amount) => spendMutation.mutate(amount)} />
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
  memo: { color: '#6b7280', lineHeight: 21 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  availableBadge: { backgroundColor: '#dcfce7' },
  usedBadge: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 12, fontWeight: '900' },
  availableText: { color: '#15803d' },
  usedText: { color: '#b91c1c' },
  actions: { gap: 12 },
  action: { borderRadius: 18, alignItems: 'center', paddingVertical: 16 },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#eef2ff' },
  danger: { backgroundColor: '#fee2e2' },
  disabled: { opacity: 0.45 },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryText: { color: '#3730a3', fontWeight: '900', fontSize: 16 },
  dangerText: { color: '#b91c1c', fontWeight: '900', fontSize: 16 },
});
