import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { validateLoginInput } from '@/lib/domain';
import { login } from '@/lib/pb';

export default function LoginScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#f8fafc', padding: 20 },
  card: { borderRadius: 28, backgroundColor: '#fff', padding: 24, gap: 16, shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  eyebrow: { color: '#4f46e5', fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#111827', fontSize: 28, fontWeight: '900' },
  description: { color: '#6b7280', lineHeight: 21 },
  field: { gap: 8 },
  label: { color: '#111827', fontWeight: '900' },
  input: { borderRadius: 16, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  error: { color: '#b91c1c', fontWeight: '800' },
  button: { marginTop: 4, borderRadius: 18, alignItems: 'center', backgroundColor: '#111827', paddingVertical: 16 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 17 },
});
