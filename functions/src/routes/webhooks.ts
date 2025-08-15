import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { generateWebhookId, signWebhook } from '../../../shared/utils';

const router = Router();
const db = admin.firestore();

const testWebhookSchema = z.object({
  merchantId: z.string().min(1)
});

router.post('/test', async (req, res) => {
  try {
    const validation = testWebhookSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { merchantId } = validation.data;

    const merchantDoc = await db.collection('merchants').doc(merchantId).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Merchant not found'
      });
    }

    const merchant = merchantDoc.data();
    if (!merchant?.webhookUrl) {
      return res.status(400).json({
        code: 'NO_WEBHOOK_URL',
        message: 'No webhook URL configured for merchant'
      });
    }

    const testPayload = {
      type: 'test',
      merchantId,
      timestamp: Math.floor(Date.now() / 1000),
      message: 'This is a test webhook'
    };

    const webhookId = generateWebhookId();
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(testPayload);
    
    const signature = signWebhook('test-secret', timestamp, body);

    const webhookDelivery = {
      merchantId,
      webhookId,
      url: merchant.webhookUrl,
      payload: testPayload,
      status: 'PENDING',
      attempts: 0,
      lastAttemptAt: null,
      createdAt: new Date()
    };

    await db.collection('webhooks').doc(webhookId).set(webhookDelivery);

    res.json({
      success: true,
      webhookId,
      message: 'Test webhook queued for delivery'
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to send test webhook'
    });
  }
});

export { router as webhookRoutes };
