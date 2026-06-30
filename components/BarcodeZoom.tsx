import * as Brightness from 'expo-brightness';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  uri: string;
  visible: boolean;
  barcode?: string | null;
  amountLabel?: string;
  onClose: () => void;
};

export function BarcodeZoom({ uri, visible, barcode, amountLabel, onClose }: Props) {
  const previousBrightnessRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);
  const hasBarcode = Boolean(barcode?.trim());

  useEffect(() => {
    if (!visible) return undefined;
    let mounted = true;
    async function maximizeBrightness() {
      try {
        const previousBrightness = await Brightness.getBrightnessAsync();
        if (!mounted) return;
        previousBrightnessRef.current = previousBrightness;
        await Brightness.setBrightnessAsync(1);
      } catch {
        previousBrightnessRef.current = null;
      }
    }

    maximizeBrightness();

    return () => {
      mounted = false;
      const previousBrightness = previousBrightnessRef.current;
      previousBrightnessRef.current = null;
      if (previousBrightness != null) {
        Brightness.setBrightnessAsync(previousBrightness).catch(() => undefined);
      }
    };
  }, [visible]);

  const close = () => {
    setCopied(false);
    Alert.alert('밝기 원복', '화면 밝기를 이전 상태로 되돌립니다.', [{ text: '확인', onPress: onClose }]);
  };

  const copyBarcode = async () => {
    const value = barcode?.trim();
    if (!value) return;
    const clipboard = (globalThis.navigator as { clipboard?: { writeText?: (text: string) => Promise<void> } } | undefined)?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(value).catch(() => undefined);
      setCopied(true);
      return;
    }
    Alert.alert('바코드 번호', value);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <Text style={styles.title}>사용 직전 모드</Text>
          <Text style={styles.hint}>닫으면 화면 밝기를 원래대로 되돌립니다.</Text>
        </View>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        <View style={styles.footer}>
          {amountLabel ? <Text style={styles.amount}>{amountLabel}</Text> : null}
          {hasBarcode ? (
            <>
              <Text selectable style={styles.barcode}>{barcode}</Text>
              <Pressable style={styles.copyButton} onPress={copyBarcode}><Text style={styles.copyText}>{copied ? '복사됨' : '바코드 번호 복사'}</Text></Pressable>
            </>
          ) : <Text style={styles.noBarcode}>저장된 바코드 번호가 없습니다. 이미지 바코드를 보여주세요.</Text>}
          <Pressable style={styles.closeButton} onPress={close}><Text style={styles.closeText}>닫기</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 18 },
  header: { position: 'absolute', top: 18, left: 18, right: 18, zIndex: 1, alignItems: 'center', gap: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900' },
  hint: { color: '#d1d5db', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  image: { width: '100%', height: '66%' },
  footer: { position: 'absolute', left: 18, right: 18, bottom: 24, alignItems: 'center', gap: 10 },
  amount: { color: '#fff', fontSize: 22, fontWeight: '900' },
  barcode: { color: '#fff', fontSize: 22, letterSpacing: 2, fontWeight: '900', textAlign: 'center' },
  noBarcode: { color: '#fde68a', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  copyButton: { borderRadius: 999, backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 12 },
  copyText: { color: '#111827', fontWeight: '900' },
  closeButton: { borderRadius: 999, borderWidth: 1, borderColor: '#4b5563', paddingHorizontal: 20, paddingVertical: 12 },
  closeText: { color: '#fff', fontWeight: '900' },
});
