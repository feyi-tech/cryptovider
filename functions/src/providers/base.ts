export interface Transaction {
  txid: string;
  blockHeight: number;
  confirmations: number;
  amount: number;
  from: string;
  to: string;
  asset: string;
  timestamp: number;
}

export interface BlockchainProvider {
  name: string;
  chains: string[];
  getBalance(address: string, asset: string): Promise<number>;
  getTransactions(address: string, fromBlock?: number): Promise<Transaction[]>;
  getCurrentBlockHeight(): Promise<number>;
  broadcastTransaction(signedTx: string): Promise<string>;
  getRate(asset: string): Promise<number>;
}

export abstract class BaseProvider implements BlockchainProvider {
  abstract name: string;
  abstract chains: string[];
  
  protected apiKey: string;
  protected baseUrl: string;
  
  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  abstract getBalance(address: string, asset: string): Promise<number>;
  abstract getTransactions(address: string, fromBlock?: number): Promise<Transaction[]>;
  abstract getCurrentBlockHeight(): Promise<number>;
  abstract broadcastTransaction(signedTx: string): Promise<string>;
  abstract getRate(asset: string): Promise<number>;
  abstract getRate(asset: string): Promise<number>;

  protected async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Provider ${this.name} request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

export class ProviderManager {
  private providers: Map<string, BlockchainProvider[]> = new Map();
  private healthStatus: Map<string, { status: 'healthy' | 'degraded' | 'offline'; lastCheck: Date }> = new Map();

  addProvider(chain: string, provider: BlockchainProvider) {
    if (!this.providers.has(chain)) {
      this.providers.set(chain, []);
    }
    this.providers.get(chain)!.push(provider);
    this.healthStatus.set(`${chain}-${provider.name}`, { status: 'healthy', lastCheck: new Date() });
  }

  getProviders(chain: string): BlockchainProvider[] {
    return this.providers.get(chain) || [];
  }

  async executeWithFallback<T>(chain: string, operation: (provider: BlockchainProvider) => Promise<T>): Promise<T> {
    const providers = this.getProviders(chain);
    const sortedProviders = this.sortProvidersByHealth(chain, providers);
    
    for (const provider of sortedProviders) {
      try {
        console.log(`Trying provider ${provider.name} for chain ${chain}`);
        const startTime = Date.now();
        const result = await operation(provider);
        const responseTime = Date.now() - startTime;
        
        this.updateProviderHealth(`${chain}-${provider.name}`, 'healthy');
        console.log(`Provider ${provider.name} succeeded for chain ${chain} in ${responseTime}ms`);
        return result;
      } catch (error) {
        this.updateProviderHealth(`${chain}-${provider.name}`, 'degraded');
        console.warn(`Provider ${provider.name} failed for chain ${chain}:`, error);
      }
    }
    
    throw new Error(`All providers failed for chain ${chain}`);
  }

  private sortProvidersByHealth(chain: string, providers: BlockchainProvider[]): BlockchainProvider[] {
    return providers.sort((a, b) => {
      const aHealth = this.healthStatus.get(`${chain}-${a.name}`)?.status || 'healthy';
      const bHealth = this.healthStatus.get(`${chain}-${b.name}`)?.status || 'healthy';
      
      const healthPriority = { healthy: 0, degraded: 1, offline: 2 };
      return healthPriority[aHealth] - healthPriority[bHealth];
    });
  }

  private updateProviderHealth(key: string, status: 'healthy' | 'degraded' | 'offline') {
    this.healthStatus.set(key, { status, lastCheck: new Date() });
  }

  getProviderHealth(): Record<string, any> {
    const health: Record<string, any> = {};
    this.healthStatus.forEach((value, key) => {
      health[key] = value;
    });
    return health;
  }
}
