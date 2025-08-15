import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { generateInvoiceId, generateStatusToken, addBuffer } from '../../../shared/utils';
import { Asset } from '../../../shared/types';

const router = Router();
const db = admin.firestore();

const createInvoiceSchema = z.object({
  merchantId: z.string().min(1),
  storeId: z.string().min(1),
  externalId: z.string().optional(),
  currency: z.literal('USD'),
  amountFiat: z.number().positive(),
  asset: z.enum(['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20'])
});

router.post('/', async (req, res) => {
  try {
    const validation = createInvoiceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { merchantId, storeId, externalId, currency, amountFiat, asset } = validation.data;

    const merchantDoc = await db.collection('merchants').doc(merchantId).get();
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

    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists || storeDoc.data()?.merchantId !== merchantId) {
      return res.status(404).json({
        code: 'STORE_NOT_FOUND',
        message: 'Store not found or does not belong to merchant'
      });
    }

    const storeData = storeDoc.data();

    const rateDoc = await db.collection('rates').doc(asset).get();
    if (!rateDoc.exists) {
      return res.status(400).json({
        code: 'RATE_NOT_AVAILABLE',
        message: 'Exchange rate not available for asset'
      });
    }

    const rate = rateDoc.data()?.value;
    if (!rate) {
      return res.status(400).json({
        code: 'INVALID_RATE',
        message: 'Invalid exchange rate'
      });
    }

    const cryptoAmount = addBuffer(amountFiat / rate);
    const address = await generateAddressForAsset(asset, merchantId, storeId, storeData);

    const invoiceId = generateInvoiceId();
    const statusToken = generateStatusToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const confirmPolicy = storeData?.confirmPolicy || {};
    const assetPolicy = confirmPolicy[asset] || { paidAt: 1, confirmedAt: 12 };

    const invoice = {
      merchantId,
      storeId,
      externalId: externalId || null,
      currency,
      amountFiat,
      asset: asset as Asset,
      amountCrypto: cryptoAmount,
      address,
      derivationPath: null,
      status: 'PENDING',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusToken,
      confirmationsRequired: assetPolicy.confirmedAt,
      confirmationsSeen: 0
    };

    await db.collection('invoices').doc(invoiceId).set(invoice);

    res.json({
      invoiceId,
      address,
      amountCrypto: cryptoAmount,
      asset,
      expiresAt: expiresAt.toISOString(),
      statusUrl: `/v1/status/${invoiceId}/${statusToken}`
    });

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create invoice'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const invoiceDoc = await db.collection('invoices').doc(id).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found'
      });
    }

    const invoice = invoiceDoc.data();
    
    res.json({
      invoiceId: id,
      merchantId: invoice?.merchantId,
      storeId: invoice?.storeId,
      externalId: invoice?.externalId,
      currency: invoice?.currency,
      amountFiat: invoice?.amountFiat,
      asset: invoice?.asset,
      amountCrypto: invoice?.amountCrypto,
      address: invoice?.address,
      status: invoice?.status,
      expiresAt: invoice?.expiresAt?.toDate?.()?.toISOString(),
      createdAt: invoice?.createdAt?.toDate?.()?.toISOString(),
      confirmationsRequired: invoice?.confirmationsRequired,
      confirmationsSeen: invoice?.confirmationsSeen
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get invoice'
    });
  }
});

async function generateAddressForAsset(asset: Asset, merchantId: string, storeId: string, storeData: any): Promise<string> {
  switch (asset) {
    case 'btc':
      return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    case 'eth':
    case 'usdt_erc20':
      return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    case 'bnb':
    case 'usdt_bep20':
      return '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
    case 'usdt_trc20':
      return 'TLPpXqSYXS8bnxkZNjmqVSqpQgnDSLqmkv';
    default:
      throw new Error('Unsupported asset');
  }
}

export { router as invoiceRoutes };
