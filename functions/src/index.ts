import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';

admin.initializeApp();

const app = express();

app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json());

const rateLimiter = new RateLimiterMemory({
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

const rateLimitMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    await rateLimiter.consume(req.ip || 'unknown');
    next();
  } catch (rejRes) {
    res.status(429).json({ code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' });
  }
};

import { checkoutRoutes } from './routes/checkout';
import { invoiceRoutes } from './routes/invoices';
import { statusRoutes } from './routes/status';
import { merchantRoutes } from './routes/merchants';
import { webhookRoutes } from './routes/webhooks';
import { withdrawalRoutes } from './routes/withdrawals';
import { adminRoutes } from './routes/admin';
import { authenticateApiKey, requireMerchant, requireAdmin } from './middleware/auth';
import { apiKeyRoutes } from './routes/api-keys';
import { providerStatusRoutes } from './routes/provider-status';
import { systemRoutes } from './routes/system';
import { ratesRoutes } from './routes/rates';

app.use('/v1/checkout', rateLimitMiddleware, checkoutRoutes);
app.use('/v1/status', rateLimitMiddleware, statusRoutes);

app.use('/v1/invoices', authenticateApiKey, requireMerchant, invoiceRoutes);
app.use('/v1/merchants', authenticateApiKey, requireMerchant, merchantRoutes);
app.use('/v1/withdrawals', authenticateApiKey, requireMerchant, withdrawalRoutes);

app.use('/v1/webhooks', webhookRoutes);

app.use('/v1/admin', authenticateApiKey, requireAdmin, adminRoutes);
app.use('/v1/api-keys', authenticateApiKey, requireMerchant, apiKeyRoutes);
app.use('/v1/providers', providerStatusRoutes);
app.use('/v1/system', systemRoutes);
app.use('/v1/rates', ratesRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      firestore: 'connected',
      auth: 'connected',
      functions: 'running'
    }
  });
});


app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', error);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An internal error occurred'
  });
});

export const api = functions.https.onRequest(app);

export { paymentWatcher } from './functions/payment-watcher';
export { confirmationUpdater } from './functions/confirmation-updater';
export { webhookDispatcher, webhookRetryProcessor } from './functions/webhook-dispatcher';
export { sweeper } from './functions/sweeper';
export { enhancedWebhookDispatcher } from './functions/enhanced-webhook-dispatcher';
