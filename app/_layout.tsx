import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ensureAuth } from '@/lib/pb';

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    ensureAuth().then(() => { if (mounted) setReady(true); }).catch((err: unknown) => { if (mounted) setError(err instanceof Error ? err.message : 'PocketBase 로그인에 실패했습니다.'); });
    return () => { mounted = false; };
  }, []);
  if (error) return <View style={styles.center}><Text style={styles.title}>로그인 실패</Text><Text style={styles.message}>{error}</Text><Text style={styles.hint}>.env의 PocketBase 주소와 공용 계정을 확인하세요.</Text></View>;
  if (!ready) return <View style={styles.center}><ActivityIndicator size="large" color="#111827" /><Text style={styles.message}>공용 계정으로 접속 중...</Text></View>;
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '900' } }}>
        <Stack.Screen name="index" options={{ title: '기프티콘' }} />
        <Stack.Screen name="add" options={{ title: '기프티콘 등록', presentation: 'modal' }} />
        <Stack.Screen name="[id]" options={{ title: '상세' }} />
      </Stack>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f8fafc', gap: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#111827' },
  message: { textAlign: 'center', color: '#374151', fontWeight: '700' },
  hint: { textAlign: 'center', color: '#6b7280' },
});
