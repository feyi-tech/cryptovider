import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { signWebhook } from '../../../shared/utils';

const db = admin.firestore();

const MAX_RETRIES = 5;
const INITIAL_DELAY = 1000;

export const enhancedWebhookDispatcher = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  try {
    console.log('Enhanced webhook dispatcher triggered at:', new Date().toISOString());
    
    const pendingWebhooksQuery = await db.collection('webhooks')
      .where('status', 'in', ['PENDING', 'RETRYING'])
      .where('nextRetryAt', '<=', new Date())
      .limit(50)
      .get();

    if (pendingWebhooksQuery.empty) {
      console.log('No pending webhooks to process');
      return null;
    }

    console.log(`Processing ${pendingWebhooksQuery.size} pending webhooks`);

    const promises = pendingWebhooksQuery.docs.map(async (doc) => {
      const webhook = doc.data();
      const webhookId = doc.id;
      
      try {
        await deliverWebhookWithRetry(webhook, webhookId, webhook.attempts + 1);
      } catch (error) {
        console.error(`Error processing webhook ${webhookId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('Enhanced webhook dispatcher completed');
    return null;
  } catch (error) {
    console.error('Enhanced webhook dispatcher error:', error);
    throw error;
  }
});

async function deliverWebhookWithRetry(webhook: any, webhookId: string, attempt: number = 1): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(webhook.payload);
  const signature = signWebhook('webhook-secret', timestamp, body);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
    console.error(`Webhook delivery attempt ${attempt} failed for ${webhookId}:`, error);
    
    if (attempt < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
      const nextRetryAt = new Date(Date.now() + delay);
      
      await db.collection('webhooks').doc(webhookId).update({
        status: 'RETRYING',
        attempts: attempt,
        lastAttemptAt: new Date(),
        nextRetryAt,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.log(`Scheduling retry ${attempt + 1} for webhook ${webhookId} at ${nextRetryAt.toISOString()}`);
    } else {
      await db.collection('webhooks').doc(webhookId).update({
        status: 'FAILED',
        attempts: attempt,
        lastAttemptAt: new Date(),
        lastError: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date()
      });
      console.error(`Webhook ${webhookId} failed permanently after ${attempt} attempts`);
    }
  }
}

export async function queueWebhook(payload: any, url: string, merchantId: string): Promise<string> {
  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.collection('webhooks').doc(webhookId).set({
    url,
    payload,
    merchantId,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date(),
    nextRetryAt: new Date()
  });
  
  console.log(`Webhook ${webhookId} queued for delivery to ${url}`);
  return webhookId;
}
