import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { generateInvoiceId, generateStatusToken, addBuffer } from '../../../shared/utils';
import { Asset } from '../../../shared/types';
import { RateService } from '../services/rates';

const router = Router();
const db = admin.firestore();

const rateService = new RateService([]);

const checkoutSchema = z.object({
  amount: z.coerce.number().positive(),
  merchant_id: z.string().min(1),
  asset: z.enum(['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20']).optional().default('usdt_erc20'),
  external_id: z.string().optional(),
  customer_id: z.string().optional()
});

router.get('/', async (req, res) => {
  try {
    const validation = checkoutSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { amount, merchant_id, asset, external_id } = validation.data;
    
    console.log('Checkout request:', { amount, merchant_id, asset, external_id });

    const merchantDoc = await db.collection('merchants').doc(merchant_id).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Merchant not found'
      });
    }

    const merchant = merchantDoc.data();
    if (merchant?.status !== 'active') {
      return res.status(400).json({
        code: 'MERCHANT_INACTIVE',
        message: 'Merchant is not active'
      });
    }

    const storesQuery = await db.collection('stores')
      .where('merchantId', '==', merchant_id)
      .limit(1)
      .get();

    if (storesQuery.empty) {
      return res.status(400).json({
        code: 'NO_STORE_FOUND',
        message: 'No store configured for merchant'
      });
    }

    const storeDoc = storesQuery.docs[0];
    const store = storeDoc;
    const storeData = store.data();

    let rate: number;
    try {
      rate = await rateService.getRateWithBuffer(asset as Asset, 0.5);
      console.log(`Using real-time rate for ${asset}: $${rate}`);
    } catch (error) {
      console.error(`Failed to get rate for ${asset}, using fallback:`, error);
      const fallbackRates: Record<string, number> = {
        'usdt_bep20': 1.0,
        'usdt_erc20': 1.0,
        'usdt_trc20': 1.0,
        'btc': 45000.0,
        'eth': 2500.0,
        'bnb': 300.0
      };
      rate = fallbackRates[asset] * 1.005;
      if (!rate) {
        return res.status(400).json({
          code: 'RATE_NOT_AVAILABLE',
          message: 'Exchange rate not available for asset'
        });
      }
    }

    const cryptoAmount = amount / rate;

    const address = await generateAddressForAsset(asset, merchant_id, storeDoc.id, storeData);

    const invoiceId = generateInvoiceId();
    const statusToken = generateStatusToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const confirmPolicy = storeData.confirmPolicy || {};
    const assetPolicy = confirmPolicy[asset] || { paidAt: 1, confirmedAt: 12 };

    const invoice = {
      merchantId: merchant_id,
      storeId: storeDoc.id,
      externalId: external_id || null,
      currency: 'USD',
      amountFiat: amount,
      asset: asset as Asset,
      amountCrypto: cryptoAmount,
      address,
      derivationPath: null, // Will be set by address generation
      status: 'PENDING',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusToken,
      confirmationsRequired: assetPolicy.confirmedAt,
      confirmationsSeen: 0,
      rate: rate
    };

    await db.collection('invoices').doc(invoiceId).set(invoice);

    console.log(`Created invoice ${invoiceId} for ${amount} USD = ${cryptoAmount} ${asset}`);

    res.json({
      invoiceId,
      merchantId: merchant_id,
      storeId: storeDoc.id,
      externalId: external_id || null,
      currency: 'USD',
      amountFiat: amount,
      asset: asset as Asset,
      amountCrypto: cryptoAmount,
      address,
      status: 'PENDING',
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      confirmationsRequired: assetPolicy.confirmedAt,
      confirmationsSeen: 0,
      statusUrl: `/v1/status/${invoiceId}/${statusToken}`
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create checkout'
    });
  }
});

async function generateAddressForAsset(asset: Asset, merchantId: string, storeId: string, storeData: any): Promise<string> {
  switch (asset) {
    case 'btc':
      return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'; // Example BTC address
    case 'eth':
    case 'usdt_erc20':
      return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'; // Example ETH address
    case 'bnb':
    case 'usdt_bep20':
      return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'; // Example BSC address
    case 'usdt_trc20':
      return 'TLPpXqSYXS8bnxkZNjmqVSqpQgnDSLqmkv'; // Example TRON address
    default:
      throw new Error('Unsupported asset');
  }
}

export { router as checkoutRoutes };
