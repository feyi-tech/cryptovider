import { BaseProvider, Transaction } from './base';
import { Asset } from '../../../shared/types';

export class NowNodesProvider extends BaseProvider {
  name = 'NowNodes';
  chains = ['bitcoin', 'ethereum', 'bsc', 'tron'];
  
  constructor(apiKey: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    super(apiKey, `https://${network}.nownodes.io`);
  }
  
  async getBalance(address: string, asset: Asset): Promise<number> {
    try {
      if (asset === 'btc') {
        const response = await this.makeRequest(`/btc/address/${address}`);
        return response.balance / 100000000;
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
      } else if (asset.startsWith('usdt_trc20')) {
        const response = await this.makeRequest('/tron', {
          method: 'POST',
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'wallet/getaccount',
            params: [{ address }],
            id: 1
          })
        });
        return response.result?.balance || 0;
      } else {
        const chain = asset.includes('erc20') ? 'eth' : 'bsc';
        const tokenAddresses = {
          usdt_erc20: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          usdt_bep20: '0x55d398326f99059fF775485246999027B3197955'
        };
        
        const tokenAddress = tokenAddresses[asset as keyof typeof tokenAddresses];
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
      console.error(`NowNodes getBalance error for ${asset}:`, error);
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
      console.error('NowNodes getTransactions error:', error);
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
      console.error('NowNodes getCurrentBlockHeight error:', error);
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
      console.error('NowNodes broadcastTransaction error:', error);
      throw error;
    }
  }
  
  async getRate(asset: string): Promise<number> {
    try {
      const response = await fetch(`https://api.coindesk.com/v1/bpi/currentprice.json`);
      const data = await response.json();
      
      if (asset === 'btc') {
        return parseFloat((data as any).bpi.USD.rate.replace(',', ''));
      }
      
      const coinGeckoIds = {
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
      
      const geckoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
      const geckoData = await geckoResponse.json();
      
      return (geckoData as any)[coinId].usd;
    } catch (error) {
      console.error(`NowNodes getRate error for ${asset}:`, error);
      throw error;
    }
  }
  
  private detectAssetFromTx(tx: any): Asset {
    if (tx.to && tx.input && tx.input !== '0x') {
      return 'usdt_erc20';
    }
    return 'eth';
  }
}
