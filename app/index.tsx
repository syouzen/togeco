import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GifticonCard } from '@/components/GifticonCard';
import { listGifticons } from '@/lib/gifticons';

export default function IndexScreen() {
  const query = useQuery({ queryKey: ['gifticons'], queryFn: listGifticons });
  const { refetch } = query;
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));
  return (
    <View style={styles.container}>
      <FlatList data={query.data ?? []} keyExtractor={(item) => item.id} contentContainerStyle={(query.data?.length ?? 0) === 0 ? styles.emptyList : styles.list} renderItem={({ item }) => <GifticonCard item={item} onPress={() => router.push(`/${item.id}`)} />} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} refreshing={query.isRefetching} onRefresh={query.refetch} ListEmptyComponent={query.isLoading ? <ActivityIndicator size="large" color="#111827" /> : <View style={styles.emptyBox}><Text style={styles.emptyTitle}>등록된 기프티콘이 없습니다.</Text><Text style={styles.emptyText}>오른쪽 아래 + 버튼으로 첫 기프티콘을 올려보세요.</Text></View>} />
      {query.error ? <Text style={styles.error}>목록을 불러오지 못했습니다. 당겨서 다시 시도하세요.</Text> : null}
      <Pressable style={styles.fab} onPress={() => router.push('/add')}><Text style={styles.fabText}>+</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 18, paddingBottom: 120 },
  emptyList: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyBox: { alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#111827' },
  emptyText: { color: '#6b7280', textAlign: 'center' },
  error: { position: 'absolute', left: 18, right: 18, bottom: 92, padding: 12, borderRadius: 14, backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '800' },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', shadowColor: '#0f172a', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  fabText: { color: '#fff', fontSize: 36, lineHeight: 40, fontWeight: '600' },
});
