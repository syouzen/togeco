import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { slowNetworkHint } from '@/lib/errors';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
};

export function RetryNotice({ title = '다시 시도할 수 있어요', message, retryLabel = '재시도', onRetry, isRetrying = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>{slowNetworkHint()}</Text>
      {onRetry ? (
        <Pressable style={[styles.button, isRetrying && styles.disabled]} disabled={isRetrying} onPress={onRetry}>
          <Text style={styles.buttonText}>{isRetrying ? '재시도 중...' : retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  box: { borderRadius: 18, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 7 },
  title: { color: colors.warningText, fontWeight: '900', fontSize: 15 },
  message: { color: colors.text, fontWeight: '800', lineHeight: 20 },
  hint: { color: colors.textMuted, lineHeight: 19 },
  button: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, marginTop: 2 },
  buttonText: { color: colors.primaryText, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
