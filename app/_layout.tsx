import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import '@/lib/polyfills';
import { pb, waitForAuthStore } from '@/lib/pb';

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(pb.authStore.isValid);

  useEffect(() => {
    let mounted = true;
    waitForAuthStore().finally(() => {
      if (!mounted) return;
      setAuthed(pb.authStore.isValid);
      setReady(true);
    });
    const unsubscribe = pb.authStore.onChange(() => {
      if (mounted) setAuthed(pb.authStore.isValid);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const onLogin = segments[0] === 'login';

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.message}>로그인 상태 확인 중...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {!authed && !onLogin ? <Redirect href="/login" /> : null}
      {authed && onLogin ? <Redirect href="/" /> : null}
      <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '900' } }}>
        <Stack.Screen name="login" options={{ title: '로그인', headerShown: false }} />
        <Stack.Screen name="index" options={{ title: '기프티콘' }} />
        <Stack.Screen name="add" options={{ title: '기프티콘 등록', presentation: 'modal' }} />
        <Stack.Screen name="[id]" options={{ title: '상세' }} />
      </Stack>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f8fafc', padding: 24 },
  message: { color: '#374151', fontWeight: '800' },
});
