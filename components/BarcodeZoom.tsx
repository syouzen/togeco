import * as Brightness from 'expo-brightness';
import { useEffect, useRef } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  uri: string;
  visible: boolean;
  onClose: () => void;
};

export function BarcodeZoom({ uri, visible, onClose }: Props) {
  const previousBrightnessRef = useRef<number | null>(null);

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

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.header}><Text style={styles.hint}>탭해서 닫기</Text></View>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 18 },
  header: { position: 'absolute', top: 18, left: 18, right: 18, zIndex: 1, alignItems: 'center' },
  hint: { color: '#d1d5db', fontSize: 13, fontWeight: '800' },
  image: { width: '100%', height: '88%' },
});
