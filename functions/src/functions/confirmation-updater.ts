import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Asset } from '../../../shared/types';
// import { ProviderManager } from '../providers/base';
import { getProviderForAsset } from '../providers/provider-manager';

const db = admin.firestore();

// const providerManager = new ProviderManager();
// providerManager.addProvider('ethereum', new QuickNodeProvider('demo-api-key'));
// providerManager.addProvider('ethereum', new NowNodesProvider('demo-api-key'));
// providerManager.addProvider('bsc', new QuickNodeProvider('demo-api-key'));
// providerManager.addProvider('bsc', new NowNodesProvider('demo-api-key'));
// providerManager.addProvider('bitcoin', new NowNodesProvider('demo-api-key'));

export const confirmationUpdater = functions.pubsub.schedule('every 2 minutes').onRun(async (context) => {
  try {
    console.log('Confirmation updater triggered at:', new Date().toISOString());
    
    const paymentsQuery = await db.collection('payments')
      .where('confirmations', '<', 50) // Only check payments with less than 50 confirmations
      .limit(100)
      .get();

    if (paymentsQuery.empty) {
      console.log('No payments need confirmation updates');
      return null;
    }

    console.log(`Updating confirmations for ${paymentsQuery.size} payments`);

    const promises = paymentsQuery.docs.map(async (doc) => {
      const payment = doc.data();
      const paymentId = doc.id;
      
      try {
        await updatePaymentConfirmations(paymentId, payment);
      } catch (error) {
        console.error(`Error updating confirmations for payment ${paymentId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('Confirmation updater completed');
    return null;
  } catch (error) {
    console.error('Confirmation updater error:', error);
    throw error;
  }
});

async function updatePaymentConfirmations(paymentId: string, payment: any) {
  try {
    const provider = getProviderForAsset(payment.asset);
    const currentHeight = await provider.getCurrentBlockHeight();
    const confirmations = currentHeight - payment.blockHeight + 1;
    
    console.log(`Updating confirmations for payment ${paymentId}: ${confirmations}`);
    
    if (confirmations !== payment.confirmations) {
      await db.collection('payments').doc(paymentId).update({
        confirmations,
        updatedAt: new Date()
      });
      
      const invoiceDoc = await db.collection('invoices').doc(payment.invoiceId).get();
      const invoice = invoiceDoc.data();
      
      if (invoice && confirmations >= invoice.confirmationsRequired && invoice.status === 'PAID') {
        await db.collection('invoices').doc(payment.invoiceId).update({
          status: 'CONFIRMED',
          confirmationsSeen: confirmations,
          updatedAt: new Date()
        });
        
        await triggerConfirmationWebhook(payment.invoiceId, invoice, payment.txid, confirmations);
        
        console.log(`Payment ${paymentId} confirmed with ${confirmations} confirmations`);
      }
    }
  } catch (providerError) {
    console.warn(`Provider error for payment ${paymentId}, using mock confirmations:`, providerError);
    
    const newConfirmations = payment.confirmations + 1;
    await db.collection('payments').doc(paymentId).update({
      confirmations: newConfirmations,
      updatedAt: new Date()
    });
    
    console.log(`Fallback: Updated payment ${paymentId} confirmations to ${newConfirmations}`);
  }
}

async function triggerConfirmationWebhook(invoiceId: string, invoice: any, txid: string, confirmations: number) {
  try {
    const merchantDoc = await db.collection('merchants').doc(invoice.merchantId).get();
    const merchant = merchantDoc.data();
    
    if (!merchant?.webhookUrl) {
      console.log(`No webhook URL configured for merchant ${invoice.merchantId}`);
      return;
    }
    
    const payload = {
      type: 'payment.confirmed',
      invoiceId,
      merchantId: invoice.merchantId,
      asset: invoice.asset,
      amount: invoice.amountCrypto,
      confirmations,
      txid,
      paidAt: Math.floor(Date.now() / 1000)
    };
    
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.collection('webhooks').doc(webhookId).set({
      url: merchant.webhookUrl,
      payload,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date()
    });
    
    console.log(`Confirmation webhook queued for invoice ${invoiceId}`);
  } catch (error) {
    console.error(`Error triggering confirmation webhook:`, error);
  }
}

function getChainForAsset(asset: Asset): string {
  if (asset === 'btc') return 'bitcoin';
  if (asset === 'eth' || asset === 'usdt_erc20') return 'ethereum';
  if (asset === 'bnb' || asset === 'usdt_bep20') return 'bsc';
  if (asset === 'usdt_trc20') return 'tron';
  throw new Error(`Unsupported asset: ${asset}`);
}
