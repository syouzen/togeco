import BarcodeScanning from '@react-native-ml-kit/barcode-scanning';
import * as ImageManipulator from 'expo-image-manipulator';

import { normalizeScanFields } from './domain';
import { pb } from './pb';

export type ScanResult = {
  barcode?: string;
  name?: string;
  amount?: number | null;
  expiry?: string | null;
  isExchange?: boolean;
};

export type NormalizedScanResult = ReturnType<typeof normalizeScanFields> & { barcode: string };

export async function scanGifticon(uri: string): Promise<NormalizedScanResult> {
  const [barcodes, fields] = await Promise.all([
    BarcodeScanning.scan(uri),
    scanText(uri),
  ]);
  const barcode = barcodes.find((item) => item.value?.trim())?.value?.trim() ?? '';
  return { ...normalizeScanFields(fields), barcode };
}

async function scanText(uri: string): Promise<ScanResult> {
  const { base64 } = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!base64) throw new Error('이미지를 스캔용 데이터로 변환하지 못했습니다.');
  return pb.send<ScanResult>('/api/scan', {
    method: 'POST',
    body: { imageBase64: base64 },
  });
}
