import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { validateExpiryInput, validateGifticonAmount } from '@/lib/domain';
import { createGifticon } from '@/lib/gifticons';
import { isAuthenticated } from '@/lib/pb';
import { scanGifticon } from '@/lib/scan';

export default function AddScreen() {
  const queryClient = useQueryClient();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [barcode, setBarcode] = useState('');
  const [memo, setMemo] = useState('');
  const [isExchange, setIsExchange] = useState(false);
  const mutation = useMutation({
    mutationFn: createGifticon,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['gifticons'] }); router.back(); },
    onError: (error: Error) => Alert.alert(error.message.includes('이미 등록된 바코드') ? '이미 등록됨' : '저장 실패', error.message.includes('이미 등록된 바코드') ? '같은 바코드의 기프티콘이 이미 등록되어 있습니다.' : '기프티콘을 저장하지 못했습니다. 네트워크와 PocketBase 설정을 확인해주세요.'),
  });
  const scanMutation = useMutation({
    mutationFn: scanGifticon,
    onSuccess: (result) => {
      setName(result.name);
      setAmount(result.amountText);
      setExpiry(result.expiry);
      setBarcode(result.barcode);
      setIsExchange(result.isExchange);
      Alert.alert('스캔 완료', '자동 인식 값을 채웠습니다. 저장 전 꼭 확인해주세요.');
    },
    onError: () => Alert.alert('스캔 실패', '자동 인식에 실패했습니다. 다시 시도하거나 직접 입력해주세요.'),
  });

  if (!isAuthenticated()) {
    router.replace('/login');
    return null;
  }

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('권한 필요', '이미지를 등록하려면 사진 접근 권한이 필요합니다.'); return null; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (result.canceled) return null;
    const uri = result.assets[0]?.uri ?? null;
    if (uri) setImageUri(uri);
    return uri;
  };

  const scanFromGallery = async () => {
    const uri = await pickImage();
    if (uri) scanMutation.mutate(uri);
  };

  const save = () => {
    if (!imageUri) { Alert.alert('이미지 필요', '기프티콘 이미지를 선택해주세요.'); return; }
    const parsed = validateGifticonAmount(amount, isExchange);
    if (!parsed.ok) { Alert.alert('금액 확인', parsed.message); return; }
    const expiryResult = validateExpiryInput(expiry);
    if (!expiryResult.ok) { Alert.alert('유효기간 확인', expiryResult.message); return; }
    mutation.mutate({ imageUri, name, memo, totalAmount: parsed.amount, expiredAt: expiryResult.expiry, barcode, isExchange });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.imagePicker} onPress={pickImage}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : <Text style={styles.imageText}>이미지 선택</Text>}</Pressable>
        <View style={styles.scanRow}>
          <Pressable style={[styles.scanButton, scanMutation.isPending && styles.disabled]} onPress={scanFromGallery} disabled={scanMutation.isPending}>
            <Text style={styles.scanText}>{scanMutation.isPending ? '스캔 중...' : '갤러리에서 스캔'}</Text>
          </Pressable>
          <Text style={styles.scanHint}>자동 저장 안 함 · 확인 후 저장</Text>
        </View>
        <View style={styles.field}><Text style={styles.label}>이름</Text><TextInput value={name} onChangeText={setName} placeholder="예: 스타벅스 금액권" style={styles.input} /></View>
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.label}>교환권</Text><Text style={styles.help}>금액이 없는 쿠폰이면 켜세요.</Text></View><Switch value={isExchange} onValueChange={(value) => { setIsExchange(value); if (value) setAmount(''); }} /></View>
        <View style={styles.field}><Text style={styles.label}>금액 {isExchange ? '' : '*'}</Text><TextInput value={amount} onChangeText={setAmount} placeholder={isExchange ? '교환권은 금액 없음' : '예: 30000'} keyboardType="number-pad" style={[styles.input, isExchange && styles.disabledInput]} editable={!isExchange} /></View>
        <View style={styles.field}><Text style={styles.label}>유효기간</Text><TextInput value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>바코드</Text><TextInput value={barcode} onChangeText={setBarcode} placeholder="스캔 또는 직접 입력" autoCapitalize="none" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>메모</Text><TextInput value={memo} onChangeText={setMemo} placeholder="선택 입력" style={[styles.input, styles.memo]} multiline /></View>
        <Pressable style={[styles.save, (mutation.isPending || scanMutation.isPending) && styles.disabled]} onPress={save} disabled={mutation.isPending || scanMutation.isPending}><Text style={styles.saveText}>{mutation.isPending ? '저장 중...' : '저장'}</Text></Pressable>
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
  scanRow: { gap: 8 },
  scanButton: { borderRadius: 18, alignItems: 'center', backgroundColor: '#eef2ff', paddingVertical: 15 },
  scanText: { color: '#3730a3', fontSize: 16, fontWeight: '900' },
  scanHint: { color: '#6b7280', textAlign: 'center', fontWeight: '700' },
  field: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', padding: 14 },
  label: { color: '#111827', fontWeight: '900' },
  help: { color: '#6b7280', marginTop: 4 },
  input: { borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  disabledInput: { backgroundColor: '#f3f4f6', color: '#9ca3af' },
  memo: { minHeight: 84, textAlignVertical: 'top' },
  save: { marginTop: 8, borderRadius: 18, alignItems: 'center', backgroundColor: '#111827', paddingVertical: 16 },
  disabled: { opacity: 0.55 },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
