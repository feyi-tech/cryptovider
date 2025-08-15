import { Router } from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

const updateWebhookSchema = z.object({
  webhookUrl: z.string().url()
});

router.put('/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateWebhookSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: validation.error.issues
      });
    }

    const { webhookUrl } = validation.data;

    const merchantDoc = await db.collection('merchants').doc(id).get();
    if (!merchantDoc.exists) {
      return res.status(404).json({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Merchant not found'
      });
    }

    await db.collection('merchants').doc(id).update({
      webhookUrl,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Webhook URL updated successfully'
    });

  } catch (error) {
    console.error('Update webhook error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update webhook URL'
    });
  }
});

export { router as merchantRoutes };
