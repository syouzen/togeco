import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '900' } }}>
        <Stack.Screen name="login" options={{ title: '로그인', headerShown: false }} />
        <Stack.Screen name="index" options={{ title: '기프티콘' }} />
        <Stack.Screen name="add" options={{ title: '기프티콘 등록', presentation: 'modal' }} />
        <Stack.Screen name="[id]" options={{ title: '상세' }} />
      </Stack>
    </QueryClientProvider>
  );
}
