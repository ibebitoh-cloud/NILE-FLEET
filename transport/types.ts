export type TransportRole = 'ADMIN' | 'VIEWER';

export interface TransportUser {
  id: string;
  email: string;
  name: string;
  role: TransportRole;
}

export interface Rate {
  id: number;
  customer: string;
  load_port: string;
  destination: string;
  transit_port: string;
  price_1x20: number;
  price_2x20: number;
  price_40dc: number;
  price_40rf: number;
  currency: string;
  notes: string;
  active: boolean;
  updated_at?: string;
}

export type RateDraft = Omit<Rate, 'id' | 'updated_at'> & { id?: number };

export const PRICE_KEYS = ['price_1x20', 'price_2x20', 'price_40dc', 'price_40rf'] as const;
export type PriceKey = typeof PRICE_KEYS[number];

export const PRICE_LABELS: Record<PriceKey, string> = {
  price_1x20: '1*20',
  price_2x20: '2*20',
  price_40dc: '40 DC',
  price_40rf: '40 RF',
};

export const emptyDraft = (): RateDraft => ({
  customer: '', load_port: '', destination: '', transit_port: '',
  price_1x20: 0, price_2x20: 0, price_40dc: 0, price_40rf: 0,
  currency: 'EGP', notes: '', active: true,
});
