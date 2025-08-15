import * as crypto from 'crypto';

export function generateStatusToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateInvoiceId(): string {
  return 'inv_' + crypto.randomBytes(16).toString('hex');
}

export function generatePaymentId(): string {
  return 'pay_' + crypto.randomBytes(16).toString('hex');
}

export function generateWithdrawalId(): string {
  return 'wd_' + crypto.randomBytes(16).toString('hex');
}

export function generateWebhookId(): string {
  return crypto.randomUUID();
}

export function calculateFee(amount: number, feePct: number): number {
  return Math.round(amount * feePct / 100 * 1e8) / 1e8;
}

export function addBuffer(amount: number, bufferPct: number = 0.5): number {
  return amount * (1 + bufferPct / 100);
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  body: string,
  signature: string
): boolean {
  const expectedSignature = signWebhook(secret, timestamp, body);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export function isValidTimestamp(timestamp: number, toleranceMs: number = 300000): boolean {
  const now = Date.now();
  const diff = Math.abs(now - timestamp * 1000);
  return diff <= toleranceMs;
}

export const DEFAULT_CONFIRMATION_POLICY = {
  btc: { paidAt: 1, confirmedAt: 3 },
  eth: { paidAt: 1, confirmedAt: 12 },
  bnb: { paidAt: 1, confirmedAt: 15 },
  usdt_erc20: { paidAt: 1, confirmedAt: 12 },
  usdt_bep20: { paidAt: 1, confirmedAt: 15 },
  usdt_trc20: { paidAt: 1, confirmedAt: 20 }
};

export const SUPPORTED_ASSETS = ['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20'] as const;

export function getBalanceId(merchantId: string, asset: string): string {
  return `${merchantId}_${asset}`;
}

export function parseBalanceId(balanceId: string): { merchantId: string; asset: string } {
  const [merchantId, asset] = balanceId.split('_');
  return { merchantId, asset };
}
