import { BlockchainProvider } from '../providers/base';
import { QuickNodeProvider } from '../providers/quicknode';
import { NowNodesProvider } from '../providers/nownodes';
import { GetBlockProvider } from '../providers/getblock';

export class ProviderFactory {
  private static providers: Map<string, BlockchainProvider[]> = new Map();
  
  static initializeProviders() {
    const quickNode = new QuickNodeProvider('demo-key');
    const nowNodes = new NowNodesProvider('demo-key');
    const getBlock = new GetBlockProvider('demo-key');
    
    this.providers.set('ethereum', [quickNode, nowNodes, getBlock]);
    this.providers.set('bsc', [quickNode, nowNodes, getBlock]);
    this.providers.set('bitcoin', [nowNodes, getBlock]);
    this.providers.set('tron', [nowNodes]);
  }
  
  static getProvider(chain: string): BlockchainProvider {
    if (this.providers.size === 0) {
      this.initializeProviders();
    }
    
    const chainProviders = this.providers.get(chain);
    if (!chainProviders || chainProviders.length === 0) {
      throw new Error(`No providers available for chain: ${chain}`);
    }
    
    return chainProviders[0];
  }
  
  static getAllProviders(chain: string): BlockchainProvider[] {
    if (this.providers.size === 0) {
      this.initializeProviders();
    }
    
    return this.providers.get(chain) || [];
  }
}
