import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export interface AuthenticatedRequest extends Request {
  merchantId?: string;
  isAdmin?: boolean;
}

export const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    
    if (token.startsWith('pk_')) {
      const keyDoc = await db.collection('apiKeys').doc(token).get();
      if (!keyDoc.exists) {
        return res.status(401).json({
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        });
      }
      
      const keyData = keyDoc.data();
      if (keyData?.status !== 'active') {
        return res.status(401).json({
          code: 'INACTIVE_API_KEY',
          message: 'API key is inactive'
        });
      }
      
      try {
        await keyDoc.ref.update({
          lastUsedAt: new Date(),
          usageCount: admin.firestore.FieldValue.increment(1)
        });
      } catch (updateError) {
        console.warn('Failed to update API key usage:', updateError);
      }
      
      req.merchantId = keyData.merchantId;
      
      if (keyData.merchantId === 'admin' || (keyData.permissions && keyData.permissions.includes('admin'))) {
        req.isAdmin = true;
      }
    } else {
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        if (!decodedToken.admin) {
          return res.status(403).json({
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required'
          });
        }
        req.isAdmin = true;
      } catch (authError) {
        return res.status(401).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid Firebase token'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication failed'
    });
  }
};

export const requireMerchant = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.merchantId) {
    return res.status(403).json({
      code: 'MERCHANT_ACCESS_REQUIRED',
      message: 'Merchant authentication required'
    });
  }
  next();
};

export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return res.status(403).json({
      code: 'ADMIN_ACCESS_REQUIRED',
      message: 'Admin access required'
    });
  }
  next();
};

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }
  
  try {
    await authenticateApiKey(req, res, next);
  } catch (error) {
    next();
  }
};
