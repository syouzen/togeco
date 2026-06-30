import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { appErrorMessage } from '@/lib/errors';
import { logout, pb } from '@/lib/pb';
import { DEFAULT_EXPIRY_REMINDER_OFFSETS, getDefaultExpiryReminderOffsets, setDefaultExpiryReminderOffsets, type ExpiryReminderOffset } from '@/lib/reminders';
import { useTheme, type ThemeColors, type ThemePreference } from '@/lib/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; help: string }[] = [
  { value: 'system', label: '시스템', help: '기기 설정을 따라갑니다.' },
  { value: 'light', label: '라이트', help: '밝은 화면으로 고정합니다.' },
  { value: 'dark', label: '다크', help: '어두운 화면으로 고정합니다.' },
];

function formatPermission(status: Notifications.PermissionStatus | null) {
  if (status === Notifications.PermissionStatus.GRANTED) return '허용됨';
  if (status === Notifications.PermissionStatus.DENIED) return '거부됨';
  if (status === Notifications.PermissionStatus.UNDETERMINED) return '아직 묻지 않음';
  return '확인 중';
}

export default function SettingsScreen() {
  const { colors, preference, resolvedTheme, setPreference } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'ok' | 'failed'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('아직 확인하지 않았습니다.');
  const [defaultOffsets, setDefaultOffsets] = useState<ExpiryReminderOffset[]>([]);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((result) => setPermission(result.status))
      .catch(() => setPermission(null));
    getDefaultExpiryReminderOffsets()
      .then(setDefaultOffsets)
      .catch(() => setDefaultOffsets([...DEFAULT_EXPIRY_REMINDER_OFFSETS]));
  }, []);

  const requestPermission = async () => {
    const result = await Notifications.requestPermissionsAsync();
    setPermission(result.status);
    if (result.status === Notifications.PermissionStatus.DENIED) {
      setConnectionMessage('알림 권한이 거부되었습니다. 기기 설정에서 알림을 허용해주세요.');
    }
  };

  const checkConnection = async () => {
    setChecking(true);
    setConnectionStatus('checking');
    try {
      await pb.health.check();
      setConnectionStatus('ok');
      setConnectionMessage('PocketBase 연결 정상입니다.');
    } catch (error) {
      setConnectionStatus('failed');
      setConnectionMessage(appErrorMessage(error, 'PocketBase 연결을 확인하지 못했습니다. 네트워크와 EXPO_PUBLIC_PB_URL을 확인해주세요.'));
    } finally {
      setChecking(false);
    }
  };


  const toggleDefaultOffset = async (offset: ExpiryReminderOffset) => {
    const next = defaultOffsets.includes(offset)
      ? defaultOffsets.filter((value) => value !== offset)
      : [...defaultOffsets, offset].sort((a, b) => b - a);
    setDefaultOffsets(next);
    await setDefaultExpiryReminderOffsets(next);
  };

  const signOut = () => {
    logout();
    router.replace('/login');
  };

  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  const buildInfo = Constants.expoConfig?.extra?.eas?.projectId ? 'EAS 프로젝트 연결됨' : '로컬/개발 빌드';
  const pbUrl = process.env.EXPO_PUBLIC_PB_URL || '미설정';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>설정</Text>
        <Text style={styles.subtitle}>테마, 알림, 계정, 연결 상태를 한 곳에서 관리합니다.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>테마</Text>
        <Text style={styles.help}>현재 적용: {resolvedTheme === 'dark' ? '다크' : '라이트'}</Text>
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <Pressable key={option.value} style={[styles.optionRow, active && styles.optionActive]} onPress={() => setPreference(option.value)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
                <Text style={styles.help}>{option.help}</Text>
              </View>
              <Text style={styles.check}>{active ? '✓' : ''}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>알림</Text>
        <Text style={styles.statusText}>권한 상태: {formatPermission(permission)}</Text>
        <View style={styles.rowActions}>
          <Pressable style={styles.secondaryButton} onPress={requestPermission}><Text style={styles.secondaryText}>권한 요청</Text></Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => Linking.openSettings()}><Text style={styles.secondaryText}>기기 설정 열기</Text></Pressable>
        </View>
        {permission === Notifications.PermissionStatus.DENIED ? <Text style={styles.warning}>권한이 거부되어 만료 알림이 울리지 않습니다. 기기 설정에서 알림을 허용해주세요.</Text> : null}
        <Text style={styles.sectionTitle}>기본 만료 알림</Text>
        <Text style={styles.help}>새 기프티콘 저장 시 선택한 날짜만 자동 예약합니다. 서버 동기화 없이 이 기기에만 저장됩니다.</Text>
        <View style={styles.rowActions}>
          {DEFAULT_EXPIRY_REMINDER_OFFSETS.map((offset) => {
            const active = defaultOffsets.includes(offset);
            return <Pressable key={offset} style={[styles.offsetChip, active && styles.offsetChipActive]} onPress={() => toggleDefaultOffset(offset)}><Text style={[styles.offsetChipText, active && styles.offsetChipTextActive]}>{offset}일 전</Text></Pressable>;
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>PocketBase 연결</Text>
        <Text style={styles.help}>URL: {pbUrl}</Text>
        <Text style={[styles.statusText, connectionStatus === 'ok' && styles.okText, connectionStatus === 'failed' && styles.warning]}>{connectionMessage}</Text>
        <Pressable style={[styles.primaryButton, checking && styles.disabled]} disabled={checking} onPress={checkConnection}>
          {checking ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryText}>연결 확인</Text>}
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>계정</Text>
        <Text style={styles.help}>{pb.authStore.record?.email || pb.authStore.record?.id || '로그인 정보 없음'}</Text>
        <Pressable style={styles.dangerButton} onPress={signOut}><Text style={styles.dangerText}>로그아웃</Text></Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>앱 정보</Text>
        <Text style={styles.help}>버전 {appVersion}</Text>
        <Text style={styles.help}>{buildInfo}</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  panel: { borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  subtitle: { color: colors.textMuted, lineHeight: 21, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  help: { color: colors.textSubtle, lineHeight: 20, fontWeight: '700' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: 14 },
  optionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionLabel: { color: colors.text, fontWeight: '900', fontSize: 16 },
  optionLabelActive: { color: colors.primarySoftText },
  check: { width: 24, color: colors.primarySoftText, fontWeight: '900', fontSize: 18, textAlign: 'center' },
  statusText: { color: colors.text, fontWeight: '900', lineHeight: 20 },
  okText: { color: colors.successText },
  warning: { color: colors.warningText, fontWeight: '800', lineHeight: 20 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  primaryButton: { borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', paddingVertical: 14 },
  primaryText: { color: colors.primaryText, fontWeight: '900', fontSize: 16 },
  secondaryButton: { borderRadius: 16, backgroundColor: colors.primarySoft, paddingHorizontal: 14, paddingVertical: 12 },
  secondaryText: { color: colors.primarySoftText, fontWeight: '900' },
  dangerButton: { borderRadius: 16, backgroundColor: colors.dangerSoft, alignItems: 'center', paddingVertical: 14 },
  dangerText: { color: colors.dangerText, fontWeight: '900', fontSize: 16 },
  offsetChip: { borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 9 },
  offsetChipActive: { backgroundColor: colors.successSoft, borderColor: colors.success },
  offsetChipText: { color: colors.textMuted, fontWeight: '900' },
  offsetChipTextActive: { color: colors.successText },
  disabled: { opacity: 0.55 },
});
