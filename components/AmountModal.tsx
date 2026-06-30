import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatWon, validateSpendAmount } from '@/lib/domain';

type Props = { visible: boolean; remainingAmount: number; isSaving: boolean; onClose: () => void; onSubmit: (amount: number) => void };

export function AmountModal({ visible, remainingAmount, isSaving, onClose, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!visible) return null;
  const submit = () => {
    const result = validateSpendAmount(value, remainingAmount);
    if (!result.ok) { setError(result.message); return; }
    onSubmit(result.amount);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>부분 차감</Text>
          <Text style={styles.description}>현재 잔액 {formatWon(remainingAmount)}에서 사용할 금액을 입력하세요.</Text>
          <TextInput value={value} onChangeText={(text) => { setValue(text); setError(null); }} keyboardType="number-pad" placeholder="예: 3000" style={styles.input} autoFocus />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.secondary]} onPress={onClose} disabled={isSaving}><Text style={styles.secondaryText}>취소</Text></Pressable>
            <Pressable style={[styles.button, styles.primary]} onPress={submit} disabled={isSaving}><Text style={styles.primaryText}>{isSaving ? '저장 중...' : '차감'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.55)', padding: 24 },
  card: { width: '100%', borderRadius: 24, backgroundColor: '#fff', padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  description: { color: '#4b5563', lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
  error: { color: '#dc2626', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  button: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  primary: { backgroundColor: '#111827' },
  secondary: { backgroundColor: '#f3f4f6' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryText: { color: '#111827', fontWeight: '800' },
});
