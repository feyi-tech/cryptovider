# Deployment Guide

This guide covers deploying the Crypto Payment Processor to production Firebase environment.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project with Blaze plan (required for Cloud Functions)
- Domain name (optional, for custom hosting)
- Blockchain provider API keys

## Production Setup

### 1. Create Firebase Project

```bash
# Create new project (or use existing)
firebase projects:create your-crypto-processor

# Initialize Firebase in your project directory
firebase init

# Select:
# - Functions (Node.js)
# - Firestore
# - Hosting
# - Storage (optional)
```

### 2. Configure Environment

```bash
# Set production project
firebase use your-crypto-processor

# Configure functions runtime
firebase functions:config:set runtime.node=18
```

### 3. Set Secrets

Store sensitive configuration in Firebase Secret Manager:

```bash
# Blockchain provider API keys
firebase functions:secrets:set QUICKNODE_API_KEY
firebase functions:secrets:set NOWNODES_API_KEY
firebase functions:secrets:set GETBLOCK_API_KEY
firebase functions:secrets:set CHAINSTACK_API_KEY
firebase functions:secrets:set MORALIS_API_KEY
firebase functions:secrets:set TRONGRID_API_KEY

# Master encryption key for wallet keys
firebase functions:secrets:set MASTER_ENCRYPTION_KEY

# Admin notification settings
firebase functions:secrets:set ADMIN_EMAIL
firebase functions:secrets:set SMTP_CONFIG
```

### 4. Configure Firestore

```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore
```

### 5. Deploy Cloud Functions

```bash
# Build and deploy functions
cd functions
npm run build
firebase deploy --only functions
```

### 6. Deploy Frontend

```bash
# Build Next.js for production
cd web
npm run build
npm run export

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Environment Configuration

### Production Environment Variables

Create `functions/.env.production`:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-crypto-processor
FIREBASE_REGION=us-central1

# Provider Configuration
PROVIDER_TIMEOUT=30000
PROVIDER_RETRY_ATTEMPTS=3
PROVIDER_FALLBACK_ENABLED=true

# Rate Limiting
RATE_LIMIT_STATUS_PER_IP=60
RATE_LIMIT_STATUS_PER_TOKEN=10
RATE_LIMIT_API_PER_KEY=1000

# Confirmation Requirements
BTC_CONFIRMATIONS_REQUIRED=3
ETH_CONFIRMATIONS_REQUIRED=12
BSC_CONFIRMATIONS_REQUIRED=15
TRON_CONFIRMATIONS_REQUIRED=20

# Fee Configuration
DEFAULT_GLOBAL_FEE_PCT=2.0
MIN_WITHDRAWAL_AMOUNT=10.0

# Security
WEBHOOK_SIGNATURE_TOLERANCE=300
STATUS_TOKEN_LENGTH=32
API_KEY_LENGTH=32

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
ALERT_EMAIL=admin@yourcompany.com
```

### Provider Configuration

Configure blockchain providers in Firestore:

```javascript
// Collection: config/providers
{
  "eth": {
    "primary": "quicknode",
    "fallbacks": ["chainstack", "alchemy"],
    "endpoints": {
      "quicknode": {
        "url": "https://your-endpoint.quiknode.pro/",
        "secretRef": "projects/your-project/secrets/QUICKNODE_API_KEY"
      }
    }
  },
  "btc": {
    "primary": "nownodes",
    "fallbacks": ["getblock", "blockchair"],
    "endpoints": {
      "nownodes": {
        "url": "https://btc.nownodes.io/",
        "secretRef": "projects/your-project/secrets/NOWNODES_API_KEY"
      }
    }
  }
}
```

## Security Hardening

### 1. Firestore Security Rules

Deploy comprehensive security rules:

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Merchants can only access their own data
    match /merchants/{merchantId} {
      allow read, write: if request.auth != null 
        && request.auth.uid == resource.data.ownerUid;
    }
    
    // Admin-only collections
    match /fees/{document} {
      allow read, write: if request.auth != null 
        && request.auth.token.admin == true;
    }
    
    // Public read for rates
    match /rates/{asset} {
      allow read: if true;
      allow write: if request.auth != null 
        && request.auth.token.admin == true;
    }
  }
}
```

### 2. Cloud Functions Security

```javascript
// functions/src/middleware/auth.ts
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth token' });
  }
  
  admin.auth().verifyIdToken(token)
    .then(decodedToken => {
      req.user = decodedToken;
      next();
    })
    .catch(() => {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid auth token' });
    });
};
```

### 3. Network Security

```bash
# Configure VPC (if using dedicated infrastructure)
gcloud compute networks create crypto-processor-vpc

# Set up firewall rules
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow HTTPS traffic"
```

## Monitoring and Alerting

### 1. Cloud Monitoring

```javascript
// functions/src/monitoring/metrics.ts
import { Monitoring } from '@google-cloud/monitoring';

const monitoring = new Monitoring.MetricServiceClient();

export const recordPaymentMetric = async (asset: string, amount: number) => {
  const request = {
    name: monitoring.projectPath(process.env.FIREBASE_PROJECT_ID),
    timeSeries: [{
      metric: {
        type: 'custom.googleapis.com/crypto_processor/payments',
        labels: { asset }
      },
      points: [{
        value: { doubleValue: amount },
        interval: { endTime: { seconds: Date.now() / 1000 } }
      }]
    }]
  };
  
  await monitoring.createTimeSeries(request);
};
```

### 2. Error Reporting

```javascript
// functions/src/monitoring/errors.ts
import { ErrorReporting } from '@google-cloud/error-reporting';

const errors = new ErrorReporting();

export const reportError = (error: Error, context?: any) => {
  errors.report(error, context);
};
```

### 3. Alerting Policies

```bash
# Create alerting policy for high error rates
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/error-rate-policy.yaml

# Create alerting policy for payment failures
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/payment-failure-policy.yaml
```

## Backup and Recovery

### 1. Firestore Backup

```bash
# Schedule daily backups
gcloud firestore operations list
gcloud firestore export gs://your-backup-bucket/firestore-backups/$(date +%Y%m%d)
```

### 2. Secret Manager Backup

```bash
# Export secrets (encrypted)
firebase functions:secrets:access MASTER_ENCRYPTION_KEY > secrets-backup.enc
```

### 3. Recovery Procedures

```bash
# Restore Firestore from backup
gcloud firestore import gs://your-backup-bucket/firestore-backups/20240115

# Restore secrets
firebase functions:secrets:set MASTER_ENCRYPTION_KEY < secrets-backup.enc
```

## Performance Optimization

### 1. Function Configuration

```javascript
// functions/src/index.ts
export const api = functions
  .runWith({
    memory: '1GB',
    timeoutSeconds: 60,
    maxInstances: 100
  })
  .https.onRequest(app);
```

### 2. Firestore Optimization

```javascript
// Use composite indexes for complex queries
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "merchantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 3. Caching Strategy

```javascript
// functions/src/cache/redis.ts
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL
});

export const cacheExchangeRates = async (rates: ExchangeRates) => {
  await redis.setex('exchange_rates', 300, JSON.stringify(rates));
};
```

## SSL and Domain Configuration

### 1. Custom Domain

```bash
# Add custom domain to Firebase Hosting
firebase hosting:channel:deploy production --only hosting

# Configure DNS
# Add CNAME record: pay.yourdomain.com -> your-project.web.app
```

### 2. SSL Certificate

Firebase Hosting automatically provisions SSL certificates for custom domains.

## Load Testing

### 1. Artillery.js Configuration

```yaml
# load-test.yml
config:
  target: 'https://your-crypto-processor.web.app'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50

scenarios:
  - name: "Checkout Flow"
    requests:
      - get:
          url: "/v1/checkout?amount=100&merchant_id=test123&asset=usdt_bep20"
      - get:
          url: "/v1/status/{{ invoiceId }}/{{ statusToken }}"
```

### 2. Run Load Tests

```bash
npm install -g artillery
artillery run load-test.yml
```

## Maintenance

### 1. Regular Updates

```bash
# Update dependencies
cd functions && npm update
cd web && npm update

# Deploy updates
firebase deploy
```

### 2. Health Checks

```bash
# Check function health
curl https://your-region-your-project.cloudfunctions.net/api/health

# Check Firestore connectivity
firebase firestore:delete --recursive test-collection
```

### 3. Log Analysis

```bash
# View function logs
firebase functions:log

# Filter by severity
firebase functions:log --only api --lines 100
```

## Troubleshooting

### Common Issues

1. **Function Timeout**
   - Increase timeout in function configuration
   - Optimize database queries
   - Add connection pooling

2. **Rate Limiting**
   - Monitor quota usage in Firebase Console
   - Implement exponential backoff
   - Consider upgrading plan

3. **Provider Failures**
   - Check provider status dashboards
   - Verify API key validity
   - Test fallback providers

4. **Webhook Delivery Failures**
   - Verify merchant webhook URLs
   - Check signature verification
   - Review retry logic

### Emergency Procedures

1. **Disable Payment Processing**
   ```bash
   firebase functions:config:set maintenance.enabled=true
   firebase deploy --only functions
   ```

2. **Emergency Wallet Sweep**
   ```bash
   firebase functions:call emergencySweep --data '{"asset":"all"}'
   ```

3. **Rollback Deployment**
   ```bash
   firebase functions:log --lines 1000 > deployment-logs.txt
   # Analyze logs and rollback if needed
   ```

## Cost Optimization

### 1. Function Optimization

- Use appropriate memory allocation
- Implement connection pooling
- Cache frequently accessed data
- Use Cloud Scheduler for periodic tasks

### 2. Firestore Optimization

- Minimize document reads/writes
- Use batch operations
- Implement proper indexing
- Archive old data

### 3. Provider Cost Management

- Monitor API usage
- Implement request caching
- Use webhooks instead of polling
- Negotiate volume discounts

## Compliance and Legal

### 1. Data Privacy

- Implement GDPR compliance
- Add data retention policies
- Provide data export functionality
- Maintain audit logs

### 2. Financial Regulations

- Implement KYC/AML procedures
- Maintain transaction records
- Report suspicious activities
- Comply with local regulations

### 3. Security Audits

- Regular penetration testing
- Code security reviews
- Dependency vulnerability scanning
- Compliance certifications

This deployment guide provides a comprehensive approach to deploying and maintaining the Crypto Payment Processor in production. Follow these steps carefully and adapt them to your specific requirements and infrastructure.
