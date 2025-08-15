import { Router } from 'express';
import { RateService } from '../services/rates';

const router = Router();
const rateService = new RateService([]);

router.get('/', async (req, res) => {
  try {
    const { asset } = req.query;
    
    if (!asset || typeof asset !== 'string') {
      return res.status(400).json({
        code: 'INVALID_PARAMS',
        message: 'Asset parameter is required'
      });
    }
    
    const supportedAssets = ['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20'];
    if (!supportedAssets.includes(asset)) {
      return res.status(400).json({
        code: 'UNSUPPORTED_ASSET',
        message: `Asset ${asset} is not supported. Supported assets: ${supportedAssets.join(', ')}`
      });
    }
    
    const rate = await rateService.getRate(asset as any);
    
    res.json({
      asset,
      rate,
      currency: 'USD',
      timestamp: new Date().toISOString(),
      source: 'aggregated'
    });
    
  } catch (error) {
    console.error('Rate fetch error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch rate'
    });
  }
});

router.get('/all', async (req, res) => {
  try {
    const assets = ['btc', 'eth', 'bnb', 'usdt_erc20', 'usdt_bep20', 'usdt_trc20'];
    const rates: Record<string, any> = {};
    
    await Promise.all(assets.map(async (asset) => {
      try {
        const rate = await rateService.getRate(asset as any);
        rates[asset] = {
          rate,
          currency: 'USD',
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        console.error(`Failed to fetch rate for ${asset}:`, error);
        rates[asset] = {
          error: 'Rate unavailable',
          timestamp: new Date().toISOString()
        };
      }
    }));
    
    res.json({
      rates,
      timestamp: new Date().toISOString(),
      source: 'aggregated'
    });
    
  } catch (error) {
    console.error('All rates fetch error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch rates'
    });
  }
});

router.get('/cache-stats', async (req, res) => {
  try {
    const stats = rateService.getCacheStats();
    res.json(stats);
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch cache stats'
    });
  }
});

router.post('/clear-cache', async (req, res) => {
  try {
    rateService.clearCache();
    res.json({
      success: true,
      message: 'Rate cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to clear cache'
    });
  }
});

export { router as ratesRoutes };
