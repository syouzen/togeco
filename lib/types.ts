export type GifticonStatus = 'AVAILABLE' | 'USED';

export type Gifticon = {
  id: string;
  name?: string;
  image: string;
  total_amount?: number | null;
  remaining_amount?: number | null;
  status: GifticonStatus;
  memo?: string;
  expiry?: string | null;
  barcode?: string;
  created: string;
};

export type GifticonCreateInput = {
  name?: string;
  totalAmount: number | null;
  imageUri: string;
  memo?: string;
  expiry?: string | null;
  barcode?: string;
  isExchange?: boolean;
};
