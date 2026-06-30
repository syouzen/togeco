import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { validateLoginInput } from '@/lib/domain';
import { login } from '@/lib/pb';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function LoginScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const placeholderTextColor = colors.textSubtle;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: () => {
      setError(null);
      router.replace('/');
    },
    onError: () => setError('로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.'),
  });

  const submit = () => {
    const validationError = validateLoginInput(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    mutation.mutate();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Pressable style={styles.themeButton} onPress={toggleTheme}><Text style={styles.themeButtonText}>{isDark ? '라이트 모드' : '다크 모드'}</Text></Pressable>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Togeco</Text>
        <Text style={styles.title}>기프티콘 공유 로그인</Text>
        <Text style={styles.description}>공유 계정으로 로그인하면 등록된 기프티콘과 잔액을 함께 관리할 수 있습니다.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            value={email}
            onChangeText={(text) => { setEmail(text); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="shared@example.com"
            placeholderTextColor={placeholderTextColor}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            value={password}
            onChangeText={(text) => { setPassword(text); setError(null); }}
            secureTextEntry
            placeholder="비밀번호"
            placeholderTextColor={placeholderTextColor}
            style={styles.input}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.button, mutation.isPending && styles.disabled]} onPress={submit} disabled={mutation.isPending}>
          <Text style={styles.buttonText}>{mutation.isPending ? '로그인 중...' : '로그인'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.background, padding: 20 },
  themeButton: { position: 'absolute', top: 18, right: 18, borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 },
  themeButtonText: { color: colors.textMuted, fontWeight: '900' },
  card: { borderRadius: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 16, shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  eyebrow: { color: colors.primarySoftText, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  description: { color: colors.textSubtle, lineHeight: 21 },
  field: { gap: 8 },
  label: { color: colors.text, fontWeight: '900' },
  input: { borderRadius: 16, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  error: { color: colors.dangerText, fontWeight: '800' },
  button: { marginTop: 4, borderRadius: 18, alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 16 },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.primaryText, fontWeight: '900', fontSize: 17 },
});
