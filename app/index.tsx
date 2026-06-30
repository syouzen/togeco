import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmountModal } from '@/components/AmountModal';
import { RetryNotice } from '@/components/RetryNotice';
import { GifticonCard } from '@/components/GifticonCard';
import { claimState, filterGifticons, formatWon } from '@/lib/domain';
import { appErrorMessage } from '@/lib/errors';
import { expiryInfo } from '@/lib/expiry';
import { useRealtimeGifticons } from '@/hooks/useRealtimeGifticons';
import { type GifticonSortMode, type GifticonStatusTab, claimGifticon, listGifticons, listRecentUsages, markGifticonUsed, retryPendingUsageRecords, spendGifticon } from '@/lib/gifticons';
import { isAuthenticated, pb } from '@/lib/pb';
import { useTheme, type ThemeColors } from '@/lib/theme';
import type { Gifticon } from '@/lib/types';
import { displayUser } from '@/lib/users';

type ExpiryFilter = 'all' | 'soon';
type ClaimedFilter = 'all' | 'mine';
type AmountKindFilter = 'all' | 'amount' | 'exchange';

export default function IndexScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GifticonStatusTab>('AVAILABLE');
  const [sortMode, setSortMode] = useState<GifticonSortMode>('latest');
  const [searchText, setSearchText] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>('all');
  const [claimedFilter, setClaimedFilter] = useState<ClaimedFilter>('all');
  const [amountKindFilter, setAmountKindFilter] = useState<AmountKindFilter>('all');
  const [spendTarget, setSpendTarget] = useState<Gifticon | null>(null);
  const query = useQuery({ queryKey: ['gifticons', { tab, sortMode, searchText, expiryFilter, claimedFilter, amountKindFilter }], queryFn: () => listGifticons(sortMode, tab), enabled: isAuthenticated() });
  const dashboardQuery = useQuery({ queryKey: ['gifticons-dashboard'], queryFn: () => listGifticons('latest', 'ALL'), enabled: isAuthenticated() });
  const recentUsageQuery = useQuery({ queryKey: ['recent-usages'], queryFn: () => listRecentUsages(3), enabled: isAuthenticated() });
  const { refetch } = query;
  useRealtimeGifticons();

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    retryPendingUsageRecords().then((count) => { if (count > 0) queryClient.invalidateQueries({ queryKey: ['usages'] }); }).catch(() => undefined);
    refetch();
    dashboardQuery.refetch();
    recentUsageQuery.refetch();
  }, [dashboardQuery, queryClient, recentUsageQuery, refetch]));


  const invalidateGifticons = async () => {
    await queryClient.invalidateQueries({ queryKey: ['gifticons'] });
  };
  const claimMutation = useMutation({ mutationFn: (item: Gifticon) => claimGifticon(item.id), onSuccess: async () => { await invalidateGifticons(); Alert.alert('찜 완료', '30분 동안 사용 예정으로 표시됩니다.'); }, onError: (error) => Alert.alert('찜 실패', appErrorMessage(error, '찜 상태를 저장하지 못했습니다. 다시 시도해주세요.')) });
  const spendMutation = useMutation({ mutationFn: ({ item, amount }: { item: Gifticon; amount: number }) => spendGifticon(item.id, item.remaining_amount ?? 0, amount), onSuccess: async () => { setSpendTarget(null); await invalidateGifticons(); Alert.alert('차감 완료', '사용 내역에 기록했습니다.'); }, onError: (error) => Alert.alert('차감 확인 필요', appErrorMessage(error, '잔액 차감 또는 사용 내역 기록에 실패했습니다. 목록을 새로고침한 뒤 다시 시도해주세요.')) });
  const usedMutation = useMutation({ mutationFn: (item: Gifticon) => markGifticonUsed(item.id, item.remaining_amount ?? null), onSuccess: async () => { await invalidateGifticons(); Alert.alert('처리 완료', '다 씀으로 표시했습니다.'); }, onError: (error) => Alert.alert('처리 실패', appErrorMessage(error, '다 씀 처리에 실패했습니다. 다시 시도해주세요.')) });

  const confirmClaimedByOther = (item: Gifticon, action: () => void) => {
    const claim = claimState({ claimedBy: item.claimed_by, claimExpiresAt: item.claim_expires_at, currentUserId: pb.authStore.record?.id });
    if (!claim.byOther) { action(); return; }
    Alert.alert('다른 사람이 찜했어요', `${displayUser(item.expand?.claimed_by)}이 찜했어요. 그래도 사용할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '사용', style: 'destructive', onPress: action },
    ]);
  };

  const busy = claimMutation.isPending || spendMutation.isPending || usedMutation.isPending;
  const hasActiveFilters = searchText.trim().length > 0 || expiryFilter !== 'all' || claimedFilter !== 'all' || amountKindFilter !== 'all';
  const visibleData = useMemo(() => filterGifticons(query.data ?? [], { query: searchText, expiry: expiryFilter, claimed: claimedFilter, amountKind: amountKindFilter, currentUserId: pb.authStore.record?.id }), [amountKindFilter, claimedFilter, expiryFilter, query.data, searchText]);
  const expirySummary = useMemo(() => {
    const source = dashboardQuery.data ?? query.data ?? [];
    const today = source.filter((item) => expiryInfo(item.expired_at).dday === 0 && item.status === 'AVAILABLE').length;
    const soon = source.filter((item) => { const info = expiryInfo(item.expired_at); return info.state === 'soon' && (info.dday ?? 99) <= 3 && item.status === 'AVAILABLE'; }).length;
    const expired = source.filter((item) => expiryInfo(item.expired_at).state === 'expired').length;
    return { today, soon, expired };
  }, [dashboardQuery.data, query.data]);

  const dashboard = useMemo(() => {
    const source = dashboardQuery.data ?? [];
    const available = source.filter((item) => item.status === 'AVAILABLE');
    const totalAvailableAmount = available.reduce((sum, item) => sum + (item.remaining_amount ?? 0), 0);
    const expiringSoon = available.filter((item) => expiryInfo(item.expired_at).state === 'soon').length;
    const claimedMine = available.filter((item) => claimState({ claimedBy: item.claimed_by, claimExpiresAt: item.claim_expires_at, currentUserId: pb.authStore.record?.id }).byMe).length;
    const todayUse = available.filter((item) => expiryInfo(item.expired_at).dday === 0).slice(0, 2);
    return { totalAvailableAmount, expiringSoon, claimedMine, todayUse };
  }, [dashboardQuery.data]);

  const resetFilters = () => {
    setSearchText('');
    setExpiryFilter('all');
    setClaimedFilter('all');
    setAmountKindFilter('all');
  };

  const emptyTitle = hasActiveFilters ? '조건에 맞는 기프티콘이 없습니다.' : tab === 'DRAFT' ? '작성 중인 기프티콘이 없습니다.' : tab === 'AVAILABLE' ? '사용 가능한 기프티콘이 없습니다.' : tab === 'USED' ? '다 쓴 기프티콘이 없습니다.' : '등록된 기프티콘이 없습니다.';

  return (
    <View style={styles.container}>
      <View style={styles.topActions}>
        <Pressable style={styles.topButton} onPress={() => router.push('/settings')}><Text style={styles.topButtonText}>설정</Text></Pressable>
      </View>
      <FlatList
        data={visibleData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={visibleData.length === 0 ? styles.emptyList : styles.list}
        ListHeaderComponent={<View style={styles.header}><Text style={styles.headerTitle}>기프티콘</Text><View style={styles.expirySummary}><Text style={styles.expirySummaryTitle}>만료 체크</Text><Text style={styles.expirySummaryText}>오늘 {expirySummary.today}개 · 3일 이내 {expirySummary.soon}개 · 만료 {expirySummary.expired}개</Text></View><View style={styles.dashboard}><View style={styles.metricRow}><View style={styles.metric}><Text style={styles.metricLabel}>사용 가능 총액</Text><Text style={styles.metricValue}>{formatWon(dashboard.totalAvailableAmount)}</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>임박</Text><Text style={styles.metricValue}>{dashboard.expiringSoon}개</Text></View><View style={styles.metric}><Text style={styles.metricLabel}>내 찜</Text><Text style={styles.metricValue}>{dashboard.claimedMine}개</Text></View></View><Text style={styles.dashboardTitle}>오늘 써야 할 기프티콘</Text>{dashboard.todayUse.length ? dashboard.todayUse.map((item) => <Text key={item.id} style={styles.dashboardText}>· {item.name?.trim() || '이름 없음'} {item.expired_at?.slice(0, 10)}</Text>) : <Text style={styles.dashboardText}>오늘 만료 예정 없음</Text>}<Text style={styles.dashboardTitle}>최근 사용 내역</Text>{recentUsageQuery.data?.length ? recentUsageQuery.data.map((usage) => <Text key={usage.id} style={styles.dashboardText}>· {usage.expand?.gifticon?.name || '기프티콘'} · {formatWon(usage.amount)}</Text>) : <Text style={styles.dashboardText}>최근 사용 내역 없음</Text>}</View><TextInput value={searchText} onChangeText={setSearchText} placeholder="이름, 메모, 바코드 검색" placeholderTextColor={colors.textSubtle} style={styles.searchInput} /><View style={styles.chipRow}><Pressable style={[styles.chip, tab === 'AVAILABLE' && styles.chipActive]} onPress={() => setTab('AVAILABLE')}><Text style={[styles.chipText, tab === 'AVAILABLE' && styles.chipTextActive]}>사용가능</Text></Pressable><Pressable style={[styles.chip, tab === 'DRAFT' && styles.chipActive]} onPress={() => setTab('DRAFT')}><Text style={[styles.chipText, tab === 'DRAFT' && styles.chipTextActive]}>작성중</Text></Pressable><Pressable style={[styles.chip, tab === 'USED' && styles.chipActive]} onPress={() => setTab('USED')}><Text style={[styles.chipText, tab === 'USED' && styles.chipTextActive]}>다씀</Text></Pressable><Pressable style={[styles.chip, tab === 'ALL' && styles.chipActive]} onPress={() => setTab('ALL')}><Text style={[styles.chipText, tab === 'ALL' && styles.chipTextActive]}>전체</Text></Pressable></View><View style={styles.sortRow}><Pressable style={[styles.sortButton, sortMode === 'latest' && styles.sortButtonActive]} onPress={() => setSortMode('latest')}><Text style={[styles.sortText, sortMode === 'latest' && styles.sortTextActive]}>최신순</Text></Pressable><Pressable style={[styles.sortButton, sortMode === 'expiring' && styles.sortButtonActive]} onPress={() => setSortMode('expiring')}><Text style={[styles.sortText, sortMode === 'expiring' && styles.sortTextActive]}>임박순</Text></Pressable></View><View style={styles.filterRow}><Pressable style={[styles.filterButton, expiryFilter === 'soon' && styles.filterButtonActive]} onPress={() => setExpiryFilter(expiryFilter === 'soon' ? 'all' : 'soon')}><Text style={[styles.filterText, expiryFilter === 'soon' && styles.filterTextActive]}>만료 임박</Text></Pressable><Pressable style={[styles.filterButton, claimedFilter === 'mine' && styles.filterButtonActive]} onPress={() => setClaimedFilter(claimedFilter === 'mine' ? 'all' : 'mine')}><Text style={[styles.filterText, claimedFilter === 'mine' && styles.filterTextActive]}>내 찜</Text></Pressable><Pressable style={[styles.filterButton, amountKindFilter === 'amount' && styles.filterButtonActive]} onPress={() => setAmountKindFilter(amountKindFilter === 'amount' ? 'all' : 'amount')}><Text style={[styles.filterText, amountKindFilter === 'amount' && styles.filterTextActive]}>금액권</Text></Pressable><Pressable style={[styles.filterButton, amountKindFilter === 'exchange' && styles.filterButtonActive]} onPress={() => setAmountKindFilter(amountKindFilter === 'exchange' ? 'all' : 'exchange')}><Text style={[styles.filterText, amountKindFilter === 'exchange' && styles.filterTextActive]}>교환권</Text></Pressable>{hasActiveFilters ? <Pressable style={styles.resetButton} onPress={resetFilters}><Text style={styles.resetText}>초기화</Text></Pressable> : null}</View></View>}
        renderItem={({ item }) => <GifticonCard item={item} isBusy={busy} onPress={() => router.push(`/${item.id}`)} onClaim={(target: Gifticon) => claimMutation.mutate(target)} onSpend={(target: Gifticon) => confirmClaimedByOther(target, () => setSpendTarget(target))} onMarkUsed={(target: Gifticon) => confirmClaimedByOther(target, () => usedMutation.mutate(target))} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListEmptyComponent={query.isLoading ? <ActivityIndicator size="large" color={colors.primary} /> : query.error ? <RetryNotice message={appErrorMessage(query.error, '목록을 불러오지 못했습니다.')} onRetry={() => query.refetch()} isRetrying={query.isRefetching} /> : <View style={styles.emptyBox}><Text style={styles.emptyTitle}>{emptyTitle}</Text><Text style={styles.emptyText}>{hasActiveFilters ? '검색어나 필터를 초기화해보세요.' : '오른쪽 아래 + 버튼으로 첫 기프티콘을 올려보세요.'}</Text>{hasActiveFilters ? <Pressable style={styles.resetButton} onPress={resetFilters}><Text style={styles.resetText}>필터 초기화</Text></Pressable> : null}</View>}
      />
      {query.error && visibleData.length > 0 ? <View style={styles.error}><RetryNotice message={appErrorMessage(query.error, '목록을 새로고침하지 못했습니다.')} onRetry={() => query.refetch()} isRetrying={query.isRefetching} /></View> : null}
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
  expirySummary: { borderRadius: 18, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  dashboard: { borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, borderRadius: 16, backgroundColor: colors.surfaceMuted, padding: 10, gap: 4 },
  metricLabel: { color: colors.textSubtle, fontWeight: '800', fontSize: 12 },
  metricValue: { color: colors.text, fontWeight: '900' },
  dashboardTitle: { color: colors.text, fontWeight: '900', marginTop: 2 },
  dashboardText: { color: colors.textMuted, fontWeight: '700' },
  expirySummaryTitle: { color: colors.warningText, fontWeight: '900' },
  expirySummaryText: { color: colors.text, fontWeight: '800' },
  searchInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  filterButtonActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { color: colors.textMuted, fontWeight: '900' },
  filterTextActive: { color: colors.primarySoftText },
  resetButton: { borderRadius: 999, backgroundColor: colors.dangerSoft, paddingHorizontal: 12, paddingVertical: 8 },
  resetText: { color: colors.dangerText, fontWeight: '900' },
  topActions: { position: 'absolute', top: 10, right: 18, zIndex: 2, flexDirection: 'row', gap: 8 },
  topButton: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  topButtonText: { color: colors.textMuted, fontWeight: '900' },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: colors.text },
  emptyText: { color: colors.textSubtle, textAlign: 'center' },
  error: { position: 'absolute', left: 18, right: 18, bottom: 92 },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, shadowColor: colors.shadow, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fabText: { color: colors.primaryText, fontSize: 36, lineHeight: 40, fontWeight: '600' },
});
