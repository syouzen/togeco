export type GifticonStatus = 'AVAILABLE' | 'USED';

export type Gifticon = {
  id: string;
  name?: string;
  image: string;
  total_amount: number;
  remaining_amount: number;
  status: GifticonStatus;
  memo?: string;
  created: string;
};

export type GifticonCreateInput = {
  name?: string;
  totalAmount: number;
  imageUri: string;
  memo?: string;
};
