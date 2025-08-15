import { BlockchainProvider, Transaction } from './base';
import { Asset } from '../../../shared/types';

export class GetBlockProvider implements BlockchainProvider {
  name = 'GetBlock';
  chains = ['bitcoin', 'ethereum', 'bsc'];
  
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.apiKey = apiKey;
    this.baseUrl = `https://go.getblock.io`;
  }
  
  async getBalance(address: string, asset: Asset): Promise<number> {
    try {
      if (asset === 'btc') {
        const response = await this.makeRequest(`/btc/${address}/balance`);
        return response.confirmed / 100000000;
      } else if (asset === 'eth' || asset === 'bnb') {
        const chain = asset === 'eth' ? 'eth' : 'bsc';
        const response = await this.makeRequest(`/${chain}`, {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });
        return parseInt(response.result, 16) / Math.pow(10, 18);
      } else {
        const chain = asset.includes('erc20') ? 'eth' : 'bsc';
        const tokenAddresses = {
          usdt_erc20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          usdt_bep20: '0x55d398326f99059fF775485246999027B3197955'
        };
        
        const tokenAddress = (tokenAddresses as any)[asset];
        if (!tokenAddress) {
          throw new Error(`Unsupported asset: ${asset}`);
        }
        
        const response = await this.makeRequest(`/${chain}`, {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
              to: tokenAddress,
              data: `0x70a08231000000000000000000000000${address.slice(2)}`
            }, 'latest'],
            id: 1
          })
        });
        
        return parseInt(response.result, 16) / Math.pow(10, 6);
      }
    } catch (error) {
      console.error(`GetBlock getBalance error for ${asset}:`, error);
      throw error;
    }
  }
  
  async getTransactions(address: string, fromBlock?: number): Promise<Transaction[]> {
    try {
      const response = await this.makeRequest(`/address/${address}/transactions`);
      
      return response.transactions.map((tx: any) => ({
        txid: tx.hash,
        blockHeight: tx.blockNumber,
        confirmations: tx.confirmations || 0,
        amount: parseFloat(tx.value),
        from: tx.from,
        to: tx.to,
        asset: this.detectAssetFromTx(tx),
        timestamp: tx.timestamp
      }));
    } catch (error) {
      console.error('GetBlock getTransactions error:', error);
      throw error;
    }
  }
  
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await this.makeRequest('/eth', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });
      
      return parseInt(response.result, 16);
    } catch (error) {
      console.error('GetBlock getCurrentBlockHeight error:', error);
      throw error;
    }
  }
  
  async broadcastTransaction(signedTx: string): Promise<string> {
    try {
      const response = await this.makeRequest('/eth', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
          params: [signedTx],
          id: 1
        })
      });
      
      return response.result;
    } catch (error) {
      console.error('GetBlock broadcastTransaction error:', error);
      throw error;
    }
  }
  
  async getRate(asset: string): Promise<number> {
    try {
      const coinGeckoIds = {
        btc: 'bitcoin',
        eth: 'ethereum',
        bnb: 'binancecoin',
        usdt_erc20: 'tether',
        usdt_bep20: 'tether',
        usdt_trc20: 'tether'
      };
      
      const coinId = (coinGeckoIds as any)[asset];
      if (!coinId) {
        throw new Error(`Unsupported asset for rate: ${asset}`);
      }
      
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      const data = await response.json();
      
      return (data as any)[coinId].usd;
    } catch (error) {
      console.error(`GetBlock getRate error for ${asset}:`, error);
      throw error;
    }
  }
  
  private detectAssetFromTx(tx: any): Asset {
    if (tx.to && tx.input && tx.input !== '0x') {
      return 'usdt_erc20';
    }
    return 'eth';
  }
  
  private async makeRequest(endpoint: string, options?: RequestInit): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options?.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`GetBlock API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
}
