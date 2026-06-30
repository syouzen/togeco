import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { GifticonCard } from '@/components/GifticonCard';
import { claimState } from '@/lib/domain';
import { useRealtimeGifticons } from '@/hooks/useRealtimeGifticons';
import { type GifticonSortMode, type GifticonStatusTab, claimGifticon, listGifticons, markGifticonUsed, spendGifticon } from '@/lib/gifticons';
import { isAuthenticated, logout, pb } from '@/lib/pb';
import { useTheme, type ThemeColors } from '@/lib/theme';
import type { Gifticon } from '@/lib/types';
import { displayUser } from '@/lib/users';

export default function IndexScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GifticonStatusTab>('AVAILABLE');
  const [sortMode, setSortMode] = useState<GifticonSortMode>('latest');
  const [spendTarget, setSpendTarget] = useState<Gifticon | null>(null);
  const query = useQuery({ queryKey: ['gifticons', { tab, sortMode }], queryFn: () => listGifticons(sortMode, tab), enabled: isAuthenticated() });
  const { refetch } = query;
  useRealtimeGifticons();

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    refetch();
  }, [refetch]));

  const signOut = () => {
    logout();
    router.replace('/login');
  };

  const invalidateGifticons = async () => {
    await queryClient.invalidateQueries({ queryKey: ['gifticons'] });
  };
  const claimMutation = useMutation({ mutationFn: (item: Gifticon) => claimGifticon(item.id), onSuccess: async () => { await invalidateGifticons(); Alert.alert('찜 완료', '30분 동안 사용 예정으로 표시됩니다.'); }, onError: () => Alert.alert('찜 실패', '찜 상태를 저장하지 못했습니다.') });
  const spendMutation = useMutation({ mutationFn: ({ item, amount }: { item: Gifticon; amount: number }) => spendGifticon(item.id, item.remaining_amount ?? 0, amount), onSuccess: async () => { setSpendTarget(null); await invalidateGifticons(); Alert.alert('차감 완료', '사용 내역에 기록했습니다.'); }, onError: () => Alert.alert('차감 실패', '잔액 차감에 실패했습니다.') });
  const usedMutation = useMutation({ mutationFn: (item: Gifticon) => markGifticonUsed(item.id, item.remaining_amount ?? null), onSuccess: async () => { await invalidateGifticons(); Alert.alert('처리 완료', '다 씀으로 표시했습니다.'); }, onError: () => Alert.alert('처리 실패', '다 씀 처리에 실패했습니다.') });

  const confirmClaimedByOther = (item: Gifticon, action: () => void) => {
    const claim = claimState({ claimedBy: item.claimed_by, claimExpiresAt: item.claim_expires_at, currentUserId: pb.authStore.record?.id });
    if (!claim.byOther) { action(); return; }
    Alert.alert('다른 사람이 찜했어요', `${displayUser(item.expand?.claimed_by)}이 찜했어요. 그래도 사용할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '사용', style: 'destructive', onPress: action },
    ]);
  };

  const busy = claimMutation.isPending || spendMutation.isPending || usedMutation.isPending;

  const emptyTitle = tab === 'DRAFT' ? '작성 중인 기프티콘이 없습니다.' : tab === 'AVAILABLE' ? '사용 가능한 기프티콘이 없습니다.' : tab === 'USED' ? '다 쓴 기프티콘이 없습니다.' : '등록된 기프티콘이 없습니다.';

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <Pressable style={styles.topButton} onPress={toggleTheme}><Text style={styles.topButtonText}>{isDark ? '라이트' : '다크'}</Text></Pressable>
        <Pressable style={styles.topButton} onPress={signOut}><Text style={styles.topButtonText}>로그아웃</Text></Pressable>
      </View>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={(query.data?.length ?? 0) === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.headerTitle}>기프티콘</Text><View style={styles.chipRow}><Pressable style={[styles.chip, tab === 'AVAILABLE' && styles.chipActive]} onPress={() => setTab('AVAILABLE')}><Text style={[styles.chipText, tab === 'AVAILABLE' && styles.chipTextActive]}>사용가능</Text></Pressable><Pressable style={[styles.chip, tab === 'DRAFT' && styles.chipActive]} onPress={() => setTab('DRAFT')}><Text style={[styles.chipText, tab === 'DRAFT' && styles.chipTextActive]}>작성중</Text></Pressable><Pressable style={[styles.chip, tab === 'USED' && styles.chipActive]} onPress={() => setTab('USED')}><Text style={[styles.chipText, tab === 'USED' && styles.chipTextActive]}>다씀</Text></Pressable><Pressable style={[styles.chip, tab === 'ALL' && styles.chipActive]} onPress={() => setTab('ALL')}><Text style={[styles.chipText, tab === 'ALL' && styles.chipTextActive]}>전체</Text></Pressable></View><View style={styles.sortRow}><Pressable style={[styles.sortButton, sortMode === 'latest' && styles.sortButtonActive]} onPress={() => setSortMode('latest')}><Text style={[styles.sortText, sortMode === 'latest' && styles.sortTextActive]}>최신순</Text></Pressable><Pressable style={[styles.sortButton, sortMode === 'expiring' && styles.sortButtonActive]} onPress={() => setSortMode('expiring')}><Text style={[styles.sortText, sortMode === 'expiring' && styles.sortTextActive]}>임박순</Text></Pressable></View></View>}
        renderItem={({ item }) => <GifticonCard item={item} isBusy={busy} onPress={() => router.push(`/${item.id}`)} onClaim={(target) => claimMutation.mutate(target)} onSpend={(target) => confirmClaimedByOther(target, () => setSpendTarget(target))} onMarkUsed={(target) => confirmClaimedByOther(target, () => usedMutation.mutate(target))} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListEmptyComponent={query.isLoading ? <ActivityIndicator size="large" color={colors.primary} /> : <View style={styles.emptyBox}><Text style={styles.emptyTitle}>{emptyTitle}</Text><Text style={styles.emptyText}>오른쪽 아래 + 버튼으로 첫 기프티콘을 올려보세요.</Text></View>}
      />
      {query.error ? <Text style={styles.error}>목록을 불러오지 못했습니다. 당겨서 다시 시도하세요.</Text> : null}
      <Pressable style={styles.fab} onPress={() => router.push('/add')}><Text style={styles.fabText}>+</Text></Pressable>
      {spendTarget?.remaining_amount != null ? <AmountModal visible={Boolean(spendTarget)} remainingAmount={spendTarget.remaining_amount} isSaving={spendMutation.isPending} onClose={() => setSpendTarget(null)} onSubmit={(amount) => spendMutation.mutate({ item: spendTarget, amount })} /> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: 18, paddingTop: 48, paddingBottom: 120 },
  header: { gap: 12, marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: colors.text },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.successSoft, borderColor: colors.success },
  chipText: { color: colors.textMuted, fontWeight: '900' },
  chipTextActive: { color: colors.successText },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortButton: { borderRadius: 999, backgroundColor: colors.surfaceMuted, paddingHorizontal: 14, paddingVertical: 9 },
  sortButtonActive: { backgroundColor: colors.primary },
  sortText: { color: colors.textMuted, fontWeight: '900' },
  sortTextActive: { color: colors.primaryText },
  topActions: { position: 'absolute', top: 10, right: 18, zIndex: 2, flexDirection: 'row', gap: 8 },
  topButton: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  topButtonText: { color: colors.textMuted, fontWeight: '900' },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  emptyText: { color: colors.textSubtle, textAlign: 'center' },
  error: { position: 'absolute', left: 18, right: 18, bottom: 92, padding: 12, borderRadius: 14, backgroundColor: colors.dangerSoft, color: colors.dangerText, fontWeight: '800' },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fabText: { color: colors.primaryText, fontSize: 36, lineHeight: 40, fontWeight: '600' },
});
