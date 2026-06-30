import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { parseWonAmount } from '@/lib/domain';
import { createGifticon } from '@/lib/gifticons';

export default function AddScreen() {
  const queryClient = useQueryClient();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const mutation = useMutation({ mutationFn: createGifticon, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); }, onError: () => Alert.alert('저장 실패', '기프티콘을 저장하지 못했습니다. 네트워크와 PocketBase 설정을 확인해주세요.') });
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('권한 필요', '이미지를 등록하려면 사진 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null);
  };
  const save = () => {
    if (!imageUri) { Alert.alert('이미지 필요', '기프티콘 이미지를 선택해주세요.'); return; }
    const parsed = parseWonAmount(amount);
    if (!parsed.ok) { Alert.alert('금액 확인', parsed.message); return; }
    mutation.mutate({ imageUri, name, memo, totalAmount: parsed.amount });
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.imagePicker} onPress={pickImage}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : <Text style={styles.imageText}>이미지 선택</Text>}</Pressable>
        <View style={styles.field}><Text style={styles.label}>이름</Text><TextInput value={name} onChangeText={setName} placeholder="예: 스타벅스 금액권" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>금액 *</Text><TextInput value={amount} onChangeText={setAmount} placeholder="예: 30000" keyboardType="number-pad" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>메모</Text><TextInput value={memo} onChangeText={setMemo} placeholder="선택 입력" style={[styles.input, styles.memo]} multiline /></View>
        <Pressable style={[styles.save, mutation.isPending && styles.disabled]} onPress={save} disabled={mutation.isPending}><Text style={styles.saveText}>{mutation.isPending ? '저장 중...' : '저장'}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 18 },
  imagePicker: { height: 280, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#e5e7eb', borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed' },
  preview: { width: '100%', height: '100%' },
  imageText: { fontSize: 18, fontWeight: '900', color: '#374151' },
  field: { gap: 8 },
  label: { color: '#111827', fontWeight: '900' },
  input: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  memo: { minHeight: 84, textAlignVertical: 'top' },
  save: { marginTop: 8, borderRadius: 18, alignItems: 'center', backgroundColor: '#111827', paddingVertical: 16 },
  disabled: { opacity: 0.55 },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
