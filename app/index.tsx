import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GifticonCard } from '@/components/GifticonCard';
import { type GifticonSortMode, listGifticons } from '@/lib/gifticons';
import { isAuthenticated, logout } from '@/lib/pb';

export default function IndexScreen() {
  const [sortMode, setSortMode] = useState<GifticonSortMode>('latest');
  const query = useQuery({ queryKey: ['gifticons', { tab: 'all', sortMode }], queryFn: () => listGifticons(sortMode), enabled: isAuthenticated() });
  const { refetch } = query;

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

  return (
    <View style={styles.container}>
      <Pressable style={styles.logout} onPress={signOut}><Text style={styles.logoutText}>로그아웃</Text></Pressable>
      <FlatList data={query.data ?? []} keyExtractor={(item) => item.id} contentContainerStyle={(query.data?.length ?? 0) === 0 ? styles.emptyList : styles.list} ListHeaderComponent={<View style={styles.header}><Text style={styles.headerTitle}>기프티콘</Text><View style={styles.sortRow}><Pressable style={[styles.sortButton, sortMode === 'latest' && styles.sortButtonActive]} onPress={() => setSortMode('latest')}><Text style={[styles.sortText, sortMode === 'latest' && styles.sortTextActive]}>최신순</Text></Pressable><Pressable style={[styles.sortButton, sortMode === 'expiring' && styles.sortButtonActive]} onPress={() => setSortMode('expiring')}><Text style={[styles.sortText, sortMode === 'expiring' && styles.sortTextActive]}>임박순</Text></Pressable></View></View>} renderItem={({ item }) => <GifticonCard item={item} onPress={() => router.push(`/${item.id}`)} />} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} refreshing={query.isRefetching} onRefresh={query.refetch} ListEmptyComponent={query.isLoading ? <ActivityIndicator size="large" color="#111827" /> : <View style={styles.emptyBox}><Text style={styles.emptyTitle}>등록된 기프티콘이 없습니다.</Text><Text style={styles.emptyText}>오른쪽 아래 + 버튼으로 첫 기프티콘을 올려보세요.</Text></View>} />
      {query.error ? <Text style={styles.error}>목록을 불러오지 못했습니다. 당겨서 다시 시도하세요.</Text> : null}
      <Pressable style={styles.fab} onPress={() => router.push('/add')}><Text style={styles.fabText}>+</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 18, paddingTop: 48, paddingBottom: 120 },
  header: { gap: 12, marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#111827' },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortButton: { borderRadius: 999, backgroundColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 9 },
  sortButtonActive: { backgroundColor: '#111827' },
  sortText: { color: '#374151', fontWeight: '900' },
  sortTextActive: { color: '#fff' },
  logout: { position: 'absolute', top: 10, right: 18, zIndex: 2, borderRadius: 999, backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 7 },
  logoutText: { color: '#374151', fontWeight: '900' },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  emptyText: { color: '#6b7280', textAlign: 'center' },
  error: { position: 'absolute', left: 18, right: 18, bottom: 92, padding: 12, borderRadius: 14, backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '800' },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fabText: { color: '#fff', fontSize: 36, lineHeight: 40, fontWeight: '600' },
});
