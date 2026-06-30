export type GifticonStatus = 'AVAILABLE' | 'USED';

export type UserSummary = {
  id: string;
  email?: string;
  name?: string;
};

export type Gifticon = {
  id: string;
  name?: string;
  image: string;
  total_amount?: number | null;
  remaining_amount?: number | null;
  status: GifticonStatus;
  memo?: string;
  expired_at?: string | null;
  barcode?: string;
  owner?: string;
  expand?: { owner?: UserSummary };
  created: string;
};

export type Usage = {
  id: string;
  gifticon: string;
  user?: string;
  amount: number;
  created: string;
  expand?: { user?: UserSummary };
};

export type GifticonCreateInput = {
  name?: string;
  totalAmount: number | null;
  imageUri: string;
  memo?: string;
  expiredAt?: string | null;
  barcode?: string;
  isExchange?: boolean;
};
