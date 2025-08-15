import express from 'express';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();
const db = admin.firestore();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).default(['read', 'write'])
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createApiKeySchema.parse(req.body);
    const { name, permissions } = validatedData;
    const merchantId = req.merchantId!;
    
    const apiKey = `pk_live_${Math.random().toString(36).substr(2, 32)}`;
    
    await db.collection('apiKeys').doc(apiKey).set({
      merchantId,
      name,
      permissions,
      status: 'active',
      createdAt: new Date(),
      lastUsedAt: null,
      usageCount: 0
    });
    
    res.json({
      apiKey,
      name,
      permissions,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'Invalid request parameters',
        details: error.issues
      });
    }

    console.error('API key creation error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create API key'
    });
  }
});

router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const merchantId = req.merchantId!;
    
    const keysQuery = await db.collection('apiKeys')
      .where('merchantId', '==', merchantId)
      .orderBy('createdAt', 'desc')
      .get();
    
    const keys = keysQuery.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id.substr(0, 12) + '...',
        name: data.name,
        permissions: data.permissions,
        status: data.status,
        createdAt: data.createdAt.toDate().toISOString(),
        lastUsedAt: data.lastUsedAt?.toDate().toISOString() || null,
        usageCount: data.usageCount || 0
      };
    });
    
    res.json({ apiKeys: keys });
  } catch (error) {
    console.error('API keys fetch error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch API keys'
    });
  }
});

router.delete('/:keyId', async (req: AuthenticatedRequest, res) => {
  try {
    const { keyId } = req.params;
    const merchantId = req.merchantId!;
    
    const keysQuery = await db.collection('apiKeys')
      .where('merchantId', '==', merchantId)
      .get();
    
    let keyToRevoke: admin.firestore.QueryDocumentSnapshot | null = null;
    for (const doc of keysQuery.docs) {
      if (doc.id.startsWith(keyId.replace('...', ''))) {
        keyToRevoke = doc;
        break;
      }
    }
    
    if (!keyToRevoke) {
      return res.status(404).json({
        code: 'API_KEY_NOT_FOUND',
        message: 'API key not found'
      });
    }
    
    await keyToRevoke.ref.update({
      status: 'revoked',
      revokedAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('API key revocation error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to revoke API key'
    });
  }
});

export { router as apiKeyRoutes };
