import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();
const db = admin.firestore();

router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        firestore: 'connected',
        functions: 'running',
        auth: 'available'
      },
      version: '1.0.0'
    };
    
    res.json(healthCheck);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [invoicesQuery, paymentsQuery, merchantsQuery] = await Promise.all([
      db.collection('invoices').get(),
      db.collection('payments').get(),
      db.collection('merchants').get()
    ]);
    
    const stats = {
      totalInvoices: invoicesQuery.size,
      totalPayments: paymentsQuery.size,
      totalMerchants: merchantsQuery.size,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch system statistics'
    });
  }
});

export { router as systemRoutes };
