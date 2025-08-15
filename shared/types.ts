export type Asset = 'btc' | 'eth' | 'bnb' | 'usdt_erc20' | 'usdt_bep20' | 'usdt_trc20';

export interface Merchant {
  name: string;
  ownerUid: string;
  createdAt: Date;
  status: 'active' | 'suspended';
  webhookUrl: string | null;
  webhookSecretRef: string;
  customFeePct: number | null;
}

export interface Store {
  merchantId: string;
  name: string;
  btcXpub: string | null;
  evmKeyRef: string | null;
  bscKeyRef: string | null;
  tronKeyRef: string | null;
  confirmPolicy: ConfirmationPolicy;
}

export interface ConfirmationPolicy {
  [asset: string]: {
    paidAt: number;
    confirmedAt: number;
  };
}

export interface Invoice {
  merchantId: string;
  storeId: string;
  externalId: string | null;
  currency: 'USD';
  amountFiat: number;
  asset: Asset;
  amountCrypto: number;
  address: string;
  derivationPath: string | null;
  status: 'PENDING' | 'PAID' | 'CONFIRMED' | 'UNDERPAID' | 'EXPIRED';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  statusToken: string;
  confirmationsRequired: number;
  confirmationsSeen: number;
}
