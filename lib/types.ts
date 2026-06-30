export type GifticonStatus = 'DRAFT' | 'AVAILABLE' | 'USED';

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
  claimed_by?: string | null;
  claimed_at?: string | null;
  claim_expires_at?: string | null;
  expand?: { owner?: UserSummary; claimed_by?: UserSummary };
  created: string;
};

export type Usage = {
  id: string;
  gifticon: string;
  user?: string;
  amount: number;
  memo?: string;
  before_amount?: number | null;
  after_amount?: number | null;
  action_type?: 'SPEND' | 'MARK_USED' | 'REVERT';
  reverted_at?: string | null;
  reverted_by?: string | null;
  reversal_of?: string | null;
  created: string;
  expand?: { user?: UserSummary; reverted_by?: UserSummary; reversal_of?: Usage };
};

export type Reminder = {
  id: string;
  user: string;
  gifticon: string;
  remind_at: string;
  offset_days: number;
  sent: boolean;
  created: string;
};

export type GifticonCreateInput = {
  name?: string;
  totalAmount: number | null;
  imageUri: string;
  memo?: string;
  expiredAt?: string | null;
  barcode?: string;
  isExchange?: boolean;
  status?: 'DRAFT' | 'AVAILABLE';
};

export type GifticonUpdateInput = {
  id: string;
  name?: string;
  totalAmount: number | null;
  imageUri?: string | null;
  memo?: string;
  expiredAt?: string | null;
  barcode?: string;
  isExchange?: boolean;
  currentTotalAmount?: number | null;
  currentRemainingAmount?: number | null;
};
