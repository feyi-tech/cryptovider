import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

router.get('/:invoiceId/:statusToken', async (req, res) => {
  try {
    const { invoiceId, statusToken } = req.params;

    if (!invoiceId || !statusToken) {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Invoice ID and status token are required'
      });
    }

    const invoiceDoc = await db.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return res.status(404).json({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found'
      });
    }

    const invoice = invoiceDoc.data();
    
    if (invoice?.statusToken !== statusToken) {
      return res.status(403).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid status token'
      });
    }

    const now = new Date();
    const expiresAt = invoice.expiresAt.toDate();
    if (now > expiresAt && invoice.status === 'PENDING') {
      await db.collection('invoices').doc(invoiceId).update({
        status: 'EXPIRED',
        updatedAt: new Date()
      });
      invoice.status = 'EXPIRED';
    }

    const confirmationsRemaining = Math.max(0, invoice.confirmationsRequired - invoice.confirmationsSeen);

    res.json({
      status: invoice.status,
      confirmationsSeen: invoice.confirmationsSeen,
      confirmationsRequired: invoice.confirmationsRequired,
      confirmationsRemaining,
      amountCrypto: invoice.amountCrypto,
      address: invoice.address,
      asset: invoice.asset,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to check status'
    });
  }
});

export { router as statusRoutes };
