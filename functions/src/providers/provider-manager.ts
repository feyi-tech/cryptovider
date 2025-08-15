import { ProviderFactory } from '../utils/provider-factory';
import { BlockchainProvider } from './base';

export function getProviderForAsset(asset: string): BlockchainProvider {
  let chain: string;
  if (asset === 'btc') {
    chain = 'bitcoin';
  } else if (asset === 'eth' || asset === 'usdt_erc20') {
    chain = 'ethereum';
  } else if (asset === 'bnb' || asset === 'usdt_bep20') {
    chain = 'bsc';
  } else if (asset === 'usdt_trc20') {
    chain = 'tron';
  } else {
    throw new Error(`Unsupported asset: ${asset}`);
  }
  
  return ProviderFactory.getProvider(chain);
}
