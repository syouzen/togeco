import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import '@/lib/polyfills';
import { pb, waitForAuthStore } from '@/lib/pb';
import { registerPushToken } from '@/lib/push';
import { syncReminders } from '@/lib/reminders';
import { ThemeProvider, useTheme, type ThemeColors } from '@/lib/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootStack />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const segments = useSegments();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  useEffect(() => {
    if (ready && authed) {
      registerPushToken();
      syncReminders();
    }
  }, [authed, ready]);

  const onLogin = segments[0] === 'login';

  if (!ready) {
    return (
      <View style={styles.center}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.message}>로그인 상태 확인 중...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!authed && !onLogin ? <Redirect href="/login" /> : null}
      {authed && onLogin ? <Redirect href="/" /> : null}
      <Stack screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '900' },
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="login" options={{ title: '로그인', headerShown: false }} />
        <Stack.Screen name="index" options={{ title: '기프티콘' }} />
        <Stack.Screen name="add" options={{ title: '기프티콘 등록', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
        <Stack.Screen name="[id]" options={{ title: '상세' }} />
      </Stack>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background, padding: 24 },
  message: { color: colors.textMuted, fontWeight: '800' },
});
