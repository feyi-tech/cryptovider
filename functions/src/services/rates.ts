// import { BaseProvider } from '../providers/base';
import { Asset } from '../../../shared/types';

interface CachedRate {
  rate: number;
  timestamp: number;
}

export class RateService {
  private providers: any[];
  private cache: Map<string, CachedRate> = new Map();
  private cacheTTL = 60000; // 1 minute
  
  private fallbackRates: Record<Asset, number> = {
    btc: 45000,
    eth: 2500,
    bnb: 300,
    usdt_erc20: 1.0,
    usdt_bep20: 1.0,
    usdt_trc20: 1.0
  };
  
  constructor(providers: any[]) {
    this.providers = providers;
  }
  
  async getRate(asset: Asset): Promise<number> {
    const cached = this.cache.get(asset);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`Using cached rate for ${asset}: $${cached.rate}`);
      return cached.rate;
    }
    
    try {
      const realRate = await this.fetchRealTimeRate(asset);
      this.cache.set(asset, { rate: realRate, timestamp: Date.now() });
      console.log(`Real-time rate fetched for ${asset}: $${realRate}`);
      return realRate;
    } catch (error) {
      console.warn(`Real-time rate fetch failed for ${asset}, using mock:`, error);
      
      const mockRate = this.fallbackRates[asset] * (0.98 + Math.random() * 0.04);
      this.cache.set(asset, { rate: mockRate, timestamp: Date.now() });
      console.log(`Mock rate used for ${asset}: $${mockRate}`);
      return mockRate;
    }
  }
  
  private async fetchRealTimeRate(asset: Asset): Promise<number> {
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
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    const rate = (data as any)[coinId]?.usd;
    
    if (!rate) {
      throw new Error(`No rate data for ${asset}`);
    }
    
    return rate;
  }
  
  async getRateWithBuffer(asset: Asset, bufferPct: number = 0.5): Promise<number> {
    const rate = await this.getRate(asset);
    const bufferedRate = rate * (1 + bufferPct / 100);
    console.log(`Rate with ${bufferPct}% buffer for ${asset}: $${rate} -> $${bufferedRate}`);
    return bufferedRate;
  }
  
  clearCache() {
    this.cache.clear();
    console.log('Rate cache cleared');
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      cacheTTL: this.cacheTTL,
      entries: Array.from(this.cache.entries()).map(([asset, data]) => ({
        asset,
        rate: data.rate,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > this.cacheTTL
      }))
    };
  }
}
