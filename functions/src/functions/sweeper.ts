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

const SWEEP_THRESHOLDS: Record<Asset, number> = {
  btc: 0.001, // 0.001 BTC
  eth: 0.01,  // 0.01 ETH
  bnb: 0.1,   // 0.1 BNB
  usdt_erc20: 100,  // 100 USDT
  usdt_bep20: 100,  // 100 USDT
  usdt_trc20: 100   // 100 USDT
};

const COLD_STORAGE_ADDRESSES: Record<Asset, string> = {
  btc: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  eth: '0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C',
  bnb: '0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C',
  usdt_erc20: '0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C',
  usdt_bep20: '0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C',
  usdt_trc20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
};

export const sweeper = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  try {
    console.log('Sweeper triggered at:', new Date().toISOString());
    
    const storesQuery = await db.collection('stores').get();
    
    if (storesQuery.empty) {
      console.log('No stores found for sweeping');
      return null;
    }

    console.log(`Checking ${storesQuery.size} stores for sweeping opportunities`);

    const promises = storesQuery.docs.map(async (doc) => {
      const store = doc.data();
      const storeId = doc.id;
      
      try {
        await sweepStoreAddresses(storeId, store);
      } catch (error) {
        console.error(`Error sweeping store ${storeId}:`, error);
      }
    });

    await Promise.all(promises);
    console.log('Sweeper completed');
    return null;
  } catch (error) {
    console.error('Sweeper error:', error);
    throw error;
  }
});

async function sweepStoreAddresses(storeId: string, store: any) {
  console.log(`Checking store ${storeId} for sweeping`);
  
  const invoicesQuery = await db.collection('invoices')
    .where('storeId', '==', storeId)
    .where('status', 'in', ['PAID', 'CONFIRMED'])
    .limit(100)
    .get();

  const addressesToCheck = new Set<string>();
  const assetAddressMap = new Map<string, Asset>();

  invoicesQuery.docs.forEach(doc => {
    const invoice = doc.data();
    addressesToCheck.add(invoice.address);
    assetAddressMap.set(invoice.address, invoice.asset);
  });

  console.log(`Checking ${addressesToCheck.size} addresses for store ${storeId}`);

  for (const address of addressesToCheck) {
    const asset = assetAddressMap.get(address);
    if (!asset) continue;

    try {
      await checkAndSweepAddress(address, asset, storeId);
    } catch (error) {
      console.error(`Error sweeping address ${address}:`, error);
    }
  }
}

async function checkAndSweepAddress(address: string, asset: Asset, storeId: string) {
  try {
    const provider = getProviderForAsset(asset);
    const balance = await provider.getBalance(address, asset);
    const threshold = SWEEP_THRESHOLDS[asset];
    
    if (balance >= threshold) {
      console.log(`Address ${address} has ${balance} ${asset}, sweeping to cold storage`);
      
      const coldStorageAddress = COLD_STORAGE_ADDRESSES[asset];
      const sweepAmount = balance * 0.95;
      
      console.log(`Sweeping ${sweepAmount} ${asset} from ${address} to ${coldStorageAddress}`);
      
      const sweepId = `sweep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('sweeps').doc(sweepId).set({
        storeId,
        fromAddress: address,
        toAddress: coldStorageAddress,
        asset,
        amount: sweepAmount,
        status: 'PENDING',
        createdAt: new Date(),
        txid: null
      });
      
      console.log(`Sweep ${sweepId} recorded for ${sweepAmount} ${asset}`);
    } else {
      console.log(`Address ${address} balance ${balance} ${asset} below threshold ${threshold}`);
    }
  } catch (providerError) {
    console.warn(`Provider error for address ${address}, using mock sweep:`, providerError);
    
    const balance = Math.random() * 1000;
    const threshold = SWEEP_THRESHOLDS[asset];
    
    if (balance >= threshold) {
      console.log(`DEMO: Would sweep ${balance} ${asset} from ${address} to cold storage`);
      
      const sweepId = `sweep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.collection('sweeps').doc(sweepId).set({
        storeId,
        fromAddress: address,
        toAddress: COLD_STORAGE_ADDRESSES[asset],
        asset,
        amount: balance * 0.95,
        status: 'DEMO_LOGGED',
        createdAt: new Date(),
        txid: null
      });
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

function getHotWalletAddress(asset: string): string {
  const addresses = {
    btc: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    eth: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    bnb: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    usdt_erc20: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    usdt_bep20: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    usdt_trc20: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
  };
  return (addresses as any)[asset] || addresses.eth;
}

function getColdStorageAddress(asset: string): string {
  const addresses = {
    btc: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    eth: '0x8ba1f109551bD432803012645Hac136c22C501e5',
    bnb: '0x8ba1f109551bD432803012645Hac136c22C501e5',
    usdt_erc20: '0x8ba1f109551bD432803012645Hac136c22C501e5',
    usdt_bep20: '0x8ba1f109551bD432803012645Hac136c22C501e5',
    usdt_trc20: 'TLyqzVGLV1srkB7dToTAEqgDSfPtXRJZYH'
  };
  return (addresses as any)[asset] || addresses.eth;
}
