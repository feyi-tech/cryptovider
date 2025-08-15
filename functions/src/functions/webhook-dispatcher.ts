import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { signWebhook } from '../../../shared/utils';

const db = admin.firestore();

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000; // 1 second
const MAX_DELAY = 300000; // 5 minutes

export const webhookDispatcher = functions.firestore
  .document('webhooks/{webhookId}')
  .onCreate(async (snap, context) => {
    const webhook = snap.data();
    const webhookId = context.params.webhookId;
    
    console.log('Dispatching webhook:', webhookId);
    
    if (!webhook.url || webhook.status !== 'PENDING') {
      return;
    }

    await deliverWebhookWithRetry(webhook, webhookId, 1);
  });

async function deliverWebhookWithRetry(webhook: any, webhookId: string, attempt: number = 1): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(webhook.payload);
  
  let webhookSecret = 'webhook-secret'; // Default fallback
  try {
    const merchantDoc = await db.collection('merchants').doc(webhook.payload.merchantId).get();
    const merchantData = merchantDoc.data();
    if (merchantData?.webhookSecretRef) {
      webhookSecret = merchantData.webhookSecretRef;
    }
  } catch (error) {
    console.warn('Failed to get webhook secret, using default:', error);
  }
  
  const signature = signWebhook(webhookSecret, timestamp, body);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': webhookId,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Signature': `sha256=${signature}`,
        'User-Agent': 'CryptoPaymentProcessor/1.0'
      },
      body,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      await db.collection('webhooks').doc(webhookId).update({
        status: 'DELIVERED',
        attempts: attempt,
        lastAttemptAt: new Date(),
        deliveredAt: new Date(),
        lastResponse: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      });
      
      console.log(`Webhook ${webhookId} delivered successfully on attempt ${attempt}`);
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Webhook ${webhookId} attempt ${attempt} failed:`, errorMessage);
    
    if (attempt < MAX_RETRIES) {
      const delay = Math.min(INITIAL_DELAY * Math.pow(2, attempt - 1), MAX_DELAY);
      const nextRetryAt = new Date(Date.now() + delay);
      
      await db.collection('webhooks').doc(webhookId).update({
        status: 'RETRYING',
        attempts: attempt,
        lastAttemptAt: new Date(),
        nextRetryAt,
        lastError: errorMessage
      });
      
      console.log(`Scheduling webhook ${webhookId} retry ${attempt + 1} in ${delay}ms`);
      
      setTimeout(() => {
        deliverWebhookWithRetry(webhook, webhookId, attempt + 1).catch(retryError => {
          console.error(`Webhook ${webhookId} retry ${attempt + 1} scheduling failed:`, retryError);
        });
      }, delay);
    } else {
      await db.collection('webhooks').doc(webhookId).update({
        status: 'FAILED',
        attempts: attempt,
        lastAttemptAt: new Date(),
        lastError: errorMessage,
        failedAt: new Date()
      });
      
      console.error(`Webhook ${webhookId} permanently failed after ${attempt} attempts`);
    }
  }
}

export const webhookRetryProcessor = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  try {
    const now = new Date();
    const retryQuery = await db.collection('webhooks')
      .where('status', '==', 'RETRYING')
      .where('nextRetryAt', '<=', now)
      .limit(50)
      .get();

    if (retryQuery.empty) {
      console.log('No webhooks to retry');
      return null;
    }

    console.log(`Processing ${retryQuery.size} webhook retries`);

    const promises = retryQuery.docs.map(async (doc) => {
      const webhook = doc.data();
      const webhookId = doc.id;
      
      try {
        await deliverWebhookWithRetry(webhook, webhookId, webhook.attempts + 1);
      } catch (error) {
        console.error(`Error retrying webhook ${webhookId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('Webhook retry processing completed');
    return null;
  } catch (error) {
    console.error('Webhook retry processor error:', error);
    throw error;
  }
});
