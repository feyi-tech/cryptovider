import { BaseProvider, Transaction } from './base';
import { Asset } from '../../../shared/types';

export class QuickNodeProvider extends BaseProvider {
  name = 'QuickNode';
  chains = ['ethereum', 'bsc', 'bitcoin'];
  
  constructor(apiKey: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    const baseUrls = {
      ethereum: `https://api.quicknode.com/v1/ethereum/${network}`,
      bsc: `https://api.quicknode.com/v1/bsc/${network}`,
      bitcoin: `https://api.quicknode.com/v1/bitcoin/${network}`
    };
    super(apiKey, baseUrls.ethereum);
  }
  
  async getBalance(address: string, asset: Asset): Promise<number> {
    try {
      if (asset === 'btc') {
        const response = await this.makeRequest(`/address/${address}/balance`);
        return response.balance / 100000000; // Convert satoshis to BTC
      } else if (asset === 'eth' || asset === 'bnb') {
        const response = await this.makeRequest('/', {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1
          })
        });
        return parseInt(response.result, 16) / Math.pow(10, 18); // Convert wei to ETH/BNB
      } else {
        const tokenAddresses = {
          usdt_erc20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          usdt_bep20: '0x55d398326f99059fF775485246999027B3197955',
          usdt_trc20: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        };
        
        const tokenAddress = tokenAddresses[asset as keyof typeof tokenAddresses];
        if (!tokenAddress) {
          throw new Error(`Unsupported asset: ${asset}`);
        }
        
        const response = await this.makeRequest('/', {
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
        
        return parseInt(response.result, 16) / Math.pow(10, 6); // USDT has 6 decimals
      }
    } catch (error) {
      console.error(`QuickNode getBalance error for ${asset}:`, error);
      throw error;
    }
  }
  
  async getTransactions(address: string, fromBlock?: number): Promise<Transaction[]> {
    try {
      const response = await this.makeRequest(`/address/${address}/transactions`, {
        method: 'GET'
      });
      
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
      console.error('QuickNode getTransactions error:', error);
      throw error;
    }
  }
  
  async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await this.makeRequest('/', {
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
      console.error('QuickNode getCurrentBlockHeight error:', error);
      throw error;
    }
  }
  
  async broadcastTransaction(signedTx: string): Promise<string> {
    try {
      const response = await this.makeRequest('/', {
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
      console.error('QuickNode broadcastTransaction error:', error);
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
      console.error(`QuickNode getRate error for ${asset}:`, error);
      throw error;
    }
  }
  
  private detectAssetFromTx(tx: any): Asset {
    if (tx.to && tx.input && tx.input !== '0x') {
      return 'usdt_erc20'; // Assume ERC20 token transfer
    }
    return 'eth'; // Native ETH transfer
  }
}
