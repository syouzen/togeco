import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
/* eslint-disable react-hooks/set-state-in-effect */
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { validateExpiryInput, validateGifticonAmount } from '@/lib/domain';
import { getGifticon, getGifticonImageUrl, updateGifticon } from '@/lib/gifticons';
import { isAuthenticated } from '@/lib/pb';
import { useTheme, type ThemeColors } from '@/lib/theme';
import type { Gifticon, GifticonUpdateInput } from '@/lib/types';

export default function EditGifticonScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = rawId ?? '';
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['gifticon', id], queryFn: () => getGifticon(id), enabled: Boolean(id) && isAuthenticated() });
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expiry, setExpiry] = useState('');
  const [barcode, setBarcode] = useState('');
  const [memo, setMemo] = useState('');
  const [isExchange, setIsExchange] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    setName(query.data.name ?? '');
    setAmount(query.data.total_amount != null ? String(query.data.total_amount) : '');
    setExpiry(query.data.expired_at?.slice(0, 10) ?? '');
    setBarcode(query.data.barcode ?? '');
    setMemo(query.data.memo ?? '');
    setIsExchange(query.data.total_amount == null || query.data.remaining_amount == null);
  }, [query.data]);

  const mutation = useMutation<Gifticon, Error, GifticonUpdateInput>({
    mutationFn: updateGifticon,
    onSuccess: async (gifticon) => {
      await queryClient.invalidateQueries({ queryKey: ['gifticons'] });
      await queryClient.invalidateQueries({ queryKey: ['gifticon', gifticon.id] });
      router.back();
    },
    onError: (error: Error) => Alert.alert(error.message.includes('이미 등록된 바코드') ? '이미 등록됨' : '수정 실패', error.message.includes('이미 등록된 바코드') ? '같은 바코드의 기프티콘이 이미 등록되어 있습니다.' : '기프티콘을 수정하지 못했습니다.'),
  });

  if (!isAuthenticated()) {
    router.replace('/login');
    return null;
  }

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('권한 필요', '이미지를 교체하려면 사진 접근 권한이 필요합니다.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null);
  };

  const save = () => {
    if (!query.data) return;
    const parsed = validateGifticonAmount(amount, isExchange);
    if (!parsed.ok) { Alert.alert('금액 확인', parsed.message); return; }
    const expiryResult = validateExpiryInput(expiry);
    if (!expiryResult.ok) { Alert.alert('유효기간 확인', expiryResult.message); return; }
    mutation.mutate({
      id,
      imageUri,
      name,
      memo,
      totalAmount: parsed.amount,
      expiredAt: expiryResult.expiry,
      barcode,
      isExchange,
      currentTotalAmount: query.data.total_amount,
      currentRemainingAmount: query.data.remaining_amount,
    });
  };

  if (query.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!query.data) return <View style={styles.center}><Text style={styles.error}>기프티콘을 불러오지 못했습니다.</Text></View>;

  const previewUri = imageUri ?? getGifticonImageUrl(query.data);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.imagePicker} onPress={pickImage}><Image source={{ uri: previewUri }} style={styles.preview} /></Pressable>
        <Text style={styles.imageHint}>이미지를 누르면 교체합니다.</Text>
        <View style={styles.field}><Text style={styles.label}>이름</Text><TextInput value={name} onChangeText={setName} placeholder="예: 스타벅스 금액권" placeholderTextColor={colors.textSubtle} style={styles.input} /></View>
        <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.label}>교환권</Text><Text style={styles.help}>켜면 금액/잔액을 비웁니다. 끄고 금액을 바꾸면 잔액은 새 금액으로 초기화됩니다.</Text></View><Switch value={isExchange} onValueChange={(value) => { setIsExchange(value); if (value) setAmount(''); }} thumbColor={isExchange ? colors.success : colors.textSubtle} trackColor={{ false: colors.surfaceMuted, true: colors.successSoft }} /></View>
        <View style={styles.field}><Text style={styles.label}>금액 {isExchange ? '' : '*'}</Text><TextInput value={amount} onChangeText={setAmount} placeholder={isExchange ? '교환권은 금액 없음' : '예: 30000'} placeholderTextColor={colors.textSubtle} keyboardType="number-pad" style={[styles.input, isExchange && styles.disabledInput]} editable={!isExchange} /></View>
        <View style={styles.field}><Text style={styles.label}>유효기간</Text><TextInput value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} keyboardType="numbers-and-punctuation" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>바코드</Text><TextInput value={barcode} onChangeText={setBarcode} placeholder="스캔 또는 직접 입력" placeholderTextColor={colors.textSubtle} autoCapitalize="none" style={styles.input} /></View>
        <View style={styles.field}><Text style={styles.label}>메모</Text><TextInput value={memo} onChangeText={setMemo} placeholder="선택 입력" placeholderTextColor={colors.textSubtle} style={[styles.input, styles.memo]} multiline /></View>
        <Pressable style={[styles.save, mutation.isPending && styles.disabled]} onPress={save} disabled={mutation.isPending}><Text style={styles.saveText}>{mutation.isPending ? '수정 중...' : '수정 저장'}</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  content: { padding: 20, gap: 18 },
  imagePicker: { height: 280, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  preview: { width: '100%', height: '100%' },
  imageHint: { color: colors.textSubtle, textAlign: 'center', fontWeight: '700' },
  field: { gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14 },
  label: { color: colors.text, fontWeight: '900' },
  help: { color: colors.textSubtle, marginTop: 4 },
  input: { borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  disabledInput: { backgroundColor: colors.surfaceMuted, color: colors.textSubtle },
  memo: { minHeight: 84, textAlignVertical: 'top' },
  save: { borderRadius: 18, alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 16 },
  disabled: { opacity: 0.55 },
  saveText: { color: colors.primaryText, fontSize: 17, fontWeight: '900' },
  error: { color: colors.dangerText, fontWeight: '900' },
});
