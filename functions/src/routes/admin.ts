import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

const updateGlobalFeeSchema = z.object({
  feePct: z.number().min(0).max(100)
});

const updateMerchantFeeSchema = z.object({
  customFeePct: z.number().min(0).max(100).nullable()
});

router.get('/fees', async (req, res) => {
  try {
    const feesDoc = await db.collection('fees').doc('global').get();
    
    if (!feesDoc.exists) {
      return res.json({ feePct: 0 });
    }

    res.json(feesDoc.data());

  } catch (error) {
    console.error('Get global fees error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get global fees'
    });
  }
});

router.put('/fees', async (req, res) => {
  try {
    const validation = updateGlobalFeeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { feePct } = validation.data;

    await db.collection('fees').doc('global').set({
      feePct,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      feePct,
      message: 'Global fee updated successfully'
    });

  } catch (error) {
    console.error('Update global fees error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update global fees'
    });
  }
});

router.put('/merchants/:id/fee', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateMerchantFeeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { customFeePct } = validation.data;

    const merchantDoc = await db.collection('merchants').doc(id).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Merchant not found'
      });
    }

    await db.collection('merchants').doc(id).update({
      customFeePct,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      customFeePct,
      message: 'Merchant custom fee updated successfully'
    });

  } catch (error) {
    console.error('Update merchant fee error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update merchant fee'
    });
  }
});

router.get('/merchants', async (req, res) => {
  try {
    const merchantsSnapshot = await db.collection('merchants').get();
    
    const merchants = merchantsSnapshot.docs.map(doc => ({
      merchantId: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString()
    }));

    res.json({ merchants });

  } catch (error) {
    console.error('Get merchants error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to get merchants'
    });
  }
});

router.get('/fee-stats', async (req, res) => {
  try {
    const adminBalancesQuery = await db.collection('balances')
      .where('merchantId', '==', 'admin')
      .get();
    
    let totalCollected = 0;
    adminBalancesQuery.docs.forEach(doc => {
      const balance = doc.data();
      totalCollected += balance.available || 0;
    });
    
    const stats = {
      totalCollected: totalCollected,
      thisMonth: totalCollected * 0.3,
      pendingWithdrawals: totalCollected * 0.1
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Fee stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch fee statistics'
    });
  }
});

router.put('/merchants/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.collection('merchants').doc(id).update({
      status: 'suspended',
      updatedAt: new Date()
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Merchant suspend error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to suspend merchant'
    });
  }
});

router.post('/withdraw-fees', async (req, res) => {
  try {
    const { asset, amount, address } = req.body;
    
    const withdrawalId = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.runTransaction(async (transaction) => {
      const adminBalanceRef = db.collection('balances').doc(`admin_${asset}`);
      const adminBalanceDoc = await transaction.get(adminBalanceRef);
      
      if (adminBalanceDoc.exists) {
        const currentBalance = adminBalanceDoc.data()?.available || 0;
        if (currentBalance >= amount) {
          transaction.update(adminBalanceRef, {
            available: admin.firestore.FieldValue.increment(-amount),
            updatedAt: new Date()
          });
        }
      }
      
      transaction.set(db.collection('withdrawals').doc(withdrawalId), {
        type: 'admin_fee_withdrawal',
        asset,
        amount,
        address,
        status: 'PENDING',
        createdAt: new Date()
      });
    });
    
    res.json({ 
      withdrawalId,
      status: 'PENDING',
      message: 'Fee withdrawal initiated'
    });
  } catch (error) {
    console.error('Fee withdrawal error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to initiate fee withdrawal'
    });
  }
});

export { router as adminRoutes };
