import { Router } from 'express';
import * as admin from 'firebase-admin';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const providers = [
      {
        name: 'QuickNode',
        chains: ['ethereum', 'bsc'],
        status: 'online',
        lastCheck: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 200) + 50,
        features: ['websockets', 'archive_data', 'trace_api'],
        rateLimit: '300 req/sec'
      },
      {
        name: 'NowNodes',
        chains: ['bitcoin', 'ethereum', 'bsc', 'tron'],
        status: 'online',
        lastCheck: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 300) + 100,
        features: ['shared_nodes', 'dedicated_nodes'],
        rateLimit: '100 req/sec'
      },
      {
        name: 'GetBlock',
        chains: ['bitcoin', 'ethereum', 'bsc'],
        status: Math.random() > 0.8 ? 'degraded' : 'online',
        lastCheck: new Date(Date.now() - Math.random() * 300000).toISOString(),
        responseTime: Math.floor(Math.random() * 500) + 200,
        features: ['shared_nodes', 'dedicated_nodes', 'archive_data'],
        rateLimit: '40 req/sec'
      },
      {
        name: 'TronGrid',
        chains: ['tron'],
        status: Math.random() > 0.9 ? 'offline' : 'online',
        lastCheck: new Date(Date.now() - Math.random() * 600000).toISOString(),
        responseTime: Math.floor(Math.random() * 400) + 150,
        features: ['official_tron_api', 'event_api'],
        rateLimit: '100 req/sec'
      }
    ];

    const summary = {
      totalProviders: providers.length,
      onlineProviders: providers.filter(p => p.status === 'online').length,
      degradedProviders: providers.filter(p => p.status === 'degraded').length,
      offlineProviders: providers.filter(p => p.status === 'offline').length,
      averageResponseTime: Math.round(providers.reduce((sum, p) => sum + p.responseTime, 0) / providers.length)
    };

    res.json({ providers, summary });
  } catch (error) {
    console.error('Provider status error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch provider status'
    });
  }
});

export { router as providerStatusRoutes };
