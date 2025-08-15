import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { generateWithdrawalId } from '../../../shared/utils';
import { Asset } from '../../../shared/types';

const router = Router();
const db = admin.firestore();

const createWithdrawalSchema = z.object({
  merchantId: z.string().min(1),
  asset: z.enum(['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20']),
  amount: z.number().positive(),
  address: z.string().min(1)
});

router.post('/', async (req, res) => {
  try {
    const validation = createWithdrawalSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { merchantId, asset, amount, address } = validation.data;

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

    const balanceId = `${merchantId}_${asset}`;
    const balanceDoc = await db.collection('balances').doc(balanceId).get();
    
    if (!balanceDoc.exists) {
      return res.status(400).json({
        code: 'INSUFFICIENT_BALANCE',
        message: 'No balance found for this asset'
      });
    }

    const balance = balanceDoc.data();
    if (!balance || balance.available < amount) {
      return res.status(400).json({
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient available balance'
      });
    }

    const withdrawalId = generateWithdrawalId();

    const withdrawal = {
      merchantId,
      asset: asset as Asset,
      amount,
      address,
      status: 'PENDING',
      txid: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.runTransaction(async (transaction) => {
      const balanceRef = db.collection('balances').doc(balanceId);
      const withdrawalRef = db.collection('withdrawals').doc(withdrawalId);

      const currentBalance = await transaction.get(balanceRef);
      if (!currentBalance.exists || currentBalance.data()?.available < amount) {
        throw new Error('Insufficient balance');
      }

      transaction.update(balanceRef, {
        available: admin.firestore.FieldValue.increment(-amount),
        updatedAt: new Date()
      });

      transaction.set(withdrawalRef, withdrawal);
    });

    res.json({
      withdrawalId,
      status: 'PENDING',
      message: 'Withdrawal request created successfully'
    });

  } catch (error) {
    console.error('Create withdrawal error:', error);
    if (error instanceof Error && error.message === 'Insufficient balance') {
      return res.status(400).json({
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient available balance'
      });
    }
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create withdrawal request'
    });
  }
});

export { router as withdrawalRoutes };
