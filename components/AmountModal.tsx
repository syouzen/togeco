import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatWon, quickSpendPresets, validateSpendAmount } from '@/lib/domain';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = { visible: boolean; remainingAmount: number; isSaving: boolean; onClose: () => void; onSubmit: (amount: number) => void };

export function AmountModal({ visible, remainingAmount, isSaving, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const presets = useMemo(() => quickSpendPresets(remainingAmount), [remainingAmount]);
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
          <View style={styles.presetRow}>
            {presets.map((amount) => (
              <Pressable key={amount} style={styles.preset} disabled={isSaving} onPress={() => { setValue(String(amount)); setError(null); }}>
                <Text style={styles.presetText}>{amount === remainingAmount ? '전액' : formatWon(amount)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={value} onChangeText={(text) => { setValue(text); setError(null); }} keyboardType="number-pad" placeholder="예: 3000" placeholderTextColor={colors.textSubtle} style={styles.input} autoFocus />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, padding: 24 },
  card: { width: '100%', borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  description: { color: colors.textMuted, lineHeight: 20 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { borderRadius: 999, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 8 },
  presetText: { color: colors.primarySoftText, fontWeight: '900' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
  error: { color: colors.dangerText, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  button: { borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surfaceMuted },
  primaryText: { color: colors.primaryText, fontWeight: '800' },
  secondaryText: { color: colors.text, fontWeight: '800' },
});
