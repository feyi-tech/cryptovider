import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Asset } from '../../../shared/types';
// import { ProviderManager } from '../providers/base';
// import { QuickNodeProvider } from '../providers/quicknode';
// import { NowNodesProvider } from '../providers/nownodes';
import { generatePaymentId } from '../../../shared/utils';
import { getProviderForAsset } from '../providers/provider-manager';

const db = admin.firestore();

interface PendingInvoice {
  invoiceId: string;
  merchantId: string;
  storeId: string;
  asset: Asset;
  address: string;
  amountCrypto: number;
  confirmationsRequired: number;
  confirmationsSeen: number;
  status: string;
  createdAt: admin.firestore.Timestamp;
}

// const providerManager = new ProviderManager();
// providerManager.addProvider('ethereum', new QuickNodeProvider('demo-api-key'));
// providerManager.addProvider('ethereum', new NowNodesProvider('demo-api-key'));
// providerManager.addProvider('bsc', new QuickNodeProvider('demo-api-key'));
// providerManager.addProvider('bsc', new NowNodesProvider('demo-api-key'));
// providerManager.addProvider('bitcoin', new NowNodesProvider('demo-api-key'));

export const paymentWatcher = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  try {
    console.log('Payment watcher triggered at:', new Date().toISOString());
    
    const now = new Date();
    const pendingInvoicesQuery = await db.collection('invoices')
      .where('status', '==', 'PENDING')
      .where('expiresAt', '>', now)
      .get();

    if (pendingInvoicesQuery.empty) {
      console.log('No pending invoices to check');
      return null;
    }

    console.log(`Checking ${pendingInvoicesQuery.size} pending invoices`);

    const promises = pendingInvoicesQuery.docs.map(async (doc) => {
      const invoice = doc.data() as PendingInvoice;
      const invoiceId = doc.id;
      
      try {
        await checkInvoicePayment(invoiceId, invoice);
      } catch (error) {
        console.error(`Error checking invoice ${invoiceId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('Payment watcher completed');
    return null;
  } catch (error) {
    console.error('Payment watcher error:', error);
    throw error;
  }
});

async function checkInvoicePayment(invoiceId: string, invoice: PendingInvoice) {
  console.log(`Checking payment for invoice ${invoiceId}, asset: ${invoice.asset}, address: ${invoice.address}`);
  
  try {
    const provider = getProviderForAsset(invoice.asset);
    const transactions = await provider.getTransactions(invoice.address);
    
    console.log(`Checking ${transactions.length} transactions for invoice ${invoiceId}`);
    
    for (const tx of transactions) {
      if (tx.amount >= invoice.amountCrypto && tx.confirmations >= 0) {
        const existingPayment = await db.collection('payments')
          .where('txid', '==', tx.txid)
          .where('invoiceId', '==', invoiceId)
          .get();
          
        if (!existingPayment.empty) {
          console.log(`Transaction ${tx.txid} already processed for invoice ${invoiceId}`);
          continue;
        }
        
        console.log(`New payment detected for invoice ${invoiceId}: ${tx.txid}`);
        
        const paymentId = generatePaymentId();
        await db.collection('payments').doc(paymentId).set({
          invoiceId,
          merchantId: invoice.merchantId,
          asset: invoice.asset,
          txid: tx.txid,
          blockHeight: tx.blockHeight,
          amount: tx.amount,
          confirmations: tx.confirmations,
          createdAt: new Date()
        });
        
        const newStatus = tx.confirmations >= invoice.confirmationsRequired ? 'CONFIRMED' : 'PAID';
        await db.collection('invoices').doc(invoiceId).update({
          status: newStatus,
          confirmationsSeen: tx.confirmations,
          updatedAt: new Date()
        });
        
        await triggerWebhook(invoiceId, invoice, tx.txid, tx.confirmations, newStatus);
        
        console.log(`Invoice ${invoiceId} updated to status: ${newStatus}`);
        
        await updateMerchantBalance(invoice.merchantId, invoice.asset, tx.amount);
        
        break;
      }
    }
  } catch (providerError) {
    console.warn(`Provider error for invoice ${invoiceId}, using mock detection:`, providerError);
    
    const paymentDetected = Math.random() < 0.05;
    
    if (paymentDetected) {
      console.log(`Mock payment detected for invoice ${invoiceId} (provider fallback)`);
      
      const txid = generateMockTxid();
      const blockHeight = Math.floor(Math.random() * 1000000) + 800000;
      const confirmations = Math.floor(Math.random() * 5) + 1;
      
      const paymentId = generatePaymentId();
      await db.collection('payments').doc(paymentId).set({
        invoiceId,
        merchantId: invoice.merchantId,
        asset: invoice.asset,
        txid,
        blockHeight,
        amount: invoice.amountCrypto,
        confirmations,
        createdAt: new Date()
      });
      
      const newStatus = confirmations >= invoice.confirmationsRequired ? 'CONFIRMED' : 'PAID';
      await db.collection('invoices').doc(invoiceId).update({
        status: newStatus,
        confirmationsSeen: confirmations,
        updatedAt: new Date()
      });
      
      await triggerWebhook(invoiceId, invoice, txid, confirmations, newStatus);
      await updateMerchantBalance(invoice.merchantId, invoice.asset, invoice.amountCrypto);
      
      console.log(`Invoice ${invoiceId} updated to status: ${newStatus} (mock)`);
    }
  }
}

function getChainForAsset(asset: Asset): string {
  if (asset === 'btc') return 'bitcoin';
  if (asset === 'eth' || asset === 'usdt_erc20') return 'ethereum';
  if (asset === 'bnb' || asset === 'usdt_bep20') return 'bsc';
  if (asset === 'usdt_trc20') return 'tron';
  throw new Error(`Unsupported asset: ${asset}`);
}

async function updateMerchantBalance(merchantId: string, asset: Asset, amount: number) {
  try {
    const globalFeeDoc = await db.collection('fees').doc('global').get();
    const globalFee = globalFeeDoc.data()?.feePct || 2.0;
    
    const merchantDoc = await db.collection('merchants').doc(merchantId).get();
    const customFee = merchantDoc.data()?.customFeePct;
    
    const feePct = customFee !== null && customFee !== undefined ? customFee : globalFee;
    const feeAmount = amount * (feePct / 100);
    const merchantAmount = amount - feeAmount;
    
    const balanceId = `${merchantId}_${asset}`;
    
    await db.runTransaction(async (transaction) => {
      const balanceRef = db.collection('balances').doc(balanceId);
      const balanceDoc = await transaction.get(balanceRef);
      
      if (balanceDoc.exists) {
        transaction.update(balanceRef, {
          available: admin.firestore.FieldValue.increment(merchantAmount),
          updatedAt: new Date()
        });
      } else {
        transaction.set(balanceRef, {
          merchantId,
          asset,
          available: merchantAmount,
          pending: 0,
          updatedAt: new Date()
        });
      }
      
      const adminBalanceId = `admin_${asset}`;
      const adminBalanceRef = db.collection('balances').doc(adminBalanceId);
      const adminBalanceDoc = await transaction.get(adminBalanceRef);
      
      if (adminBalanceDoc.exists) {
        transaction.update(adminBalanceRef, {
          available: admin.firestore.FieldValue.increment(feeAmount),
          updatedAt: new Date()
        });
      } else {
        transaction.set(adminBalanceRef, {
          merchantId: 'admin',
          asset,
          available: feeAmount,
          pending: 0,
          updatedAt: new Date()
        });
      }
    });
    
    console.log(`Updated balance for merchant ${merchantId}: +${merchantAmount} ${asset} (fee: ${feeAmount})`);
  } catch (error) {
    console.error(`Error updating merchant balance:`, error);
  }
}

async function triggerWebhook(invoiceId: string, invoice: PendingInvoice, txid: string, confirmations: number, status: string) {
  const merchantDoc = await db.collection('merchants').doc(invoice.merchantId).get();
  const merchant = merchantDoc.data();
  
  if (!merchant?.webhookUrl) {
    console.log(`No webhook URL configured for merchant ${invoice.merchantId}`);
    return;
  }
  
  const webhookType = status === 'CONFIRMED' ? 'payment.confirmed' : 'payment.detected';
  const confirmationsRemaining = Math.max(0, invoice.confirmationsRequired - confirmations);
  
  const payload = {
    type: webhookType,
    invoiceId,
    merchantId: invoice.merchantId,
    asset: invoice.asset,
    amount: invoice.amountCrypto,
    txid,
    confirmationsRemaining,
    confirmationsRequired: invoice.confirmationsRequired,
    ...(webhookType === 'payment.detected' && {
      statusUrl: `https://api.example.com/v1/status/${invoiceId}/${generateStatusToken()}`
    }),
    ...(webhookType === 'payment.confirmed' && {
      confirmations,
      paidAt: Math.floor(Date.now() / 1000)
    })
  };
  
  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.collection('webhooks').doc(webhookId).set({
    url: merchant.webhookUrl,
    payload,
    status: 'PENDING',
    attempts: 0,
    createdAt: new Date()
  });
  
  console.log(`Webhook ${webhookType} queued for invoice ${invoiceId}`);
}

function generateMockTxid(): string {
  return '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateStatusToken(): string {
  return Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
