# Crypto Payment Processor

A secure, production-grade, modular, self-hosted cryptocurrency payment processor built with Firebase and Next.js.

## Features

- **Multi-Chain Support**: Bitcoin (BTC), Ethereum (ETH), BNB (BSC), USDT on ERC20/BEP20/TRC20
- **Firebase Backend**: Cloud Functions, Firestore, Auth, Secret Manager, Cloud Scheduler
- **Next.js Frontend**: JAMstack static export with responsive design
- **Secure Architecture**: Hot/cold wallet management, HMAC-signed webhooks, rate limiting
- **Pluggable Providers**: Support for QuickNode, NowNodes, GetBlock, Chainstack, Moralis, TronGrid
- **Merchant Dashboard**: Balance management, invoice tracking, webhook configuration
- **Admin Panel**: Fee management, merchant administration, system monitoring

## Architecture

```
crypto-payment-processor/
├── functions/          # Firebase Cloud Functions (Node.js + TypeScript)
├── web/               # Next.js frontend (JAMstack static export)
├── shared/            # Shared types and utilities
├── scripts/           # Development and deployment scripts
├── docs/              # Documentation and guides
├── firebase.json      # Firebase configuration
├── firestore.rules    # Firestore security rules
└── firestore.indexes.json # Firestore composite indexes
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Development Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd crypto-payment-processor
   npm install
   cd functions && npm install
   cd ../web && npm install
   ```

2. **Start Firebase Emulators**
   ```bash
   firebase emulators:start --only functions,firestore
   ```

3. **Seed Test Data**
   ```bash
   cd scripts
   node seed-data.js
   ```

4. **Start Frontend Development Server**
   ```bash
   cd web
   npm run dev
   ```

5. **Access the Application**
   - Frontend: http://localhost:3000
   - Firebase Functions: http://localhost:5001
   - Firestore UI: http://localhost:4000

## API Endpoints

### Public Endpoints

- `GET /v1/checkout` - Create invoice and redirect to checkout
- `GET /v1/status/:invoiceId/:statusToken` - Public payment status (rate-limited)

### Merchant Endpoints (API Key Required)

- `POST /v1/invoices` - Create invoice
- `GET /v1/invoices/:id` - Get invoice details
- `PUT /v1/merchants/:id/webhook` - Update webhook URL
- `POST /v1/webhooks/test` - Test webhook delivery
- `POST /v1/withdrawals` - Request withdrawal

### Admin Endpoints (Admin Auth Required)

- `GET/PUT /v1/admin/fees` - Manage global fees
- `PUT /v1/admin/merchants/:id/fee` - Set merchant custom fee
- `POST /v1/admin/withdraw-fees` - Withdraw admin fees
- `GET /v1/admin/merchants` - List all merchants

## Webhook Format

### Headers
```
X-Webhook-Id: uuid
X-Webhook-Timestamp: unix_seconds
X-Webhook-Signature: sha256=<hex>
```

### Signature Verification
```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex');
```

### Payment Detected Payload
```json
{
  "type": "payment.detected",
  "invoiceId": "inv_abc123",
  "merchantId": "merchant_123",
  "asset": "usdt_bep20",
  "amount": 99.8,
  "txid": "0x...",
  "confirmationsRemaining": 10,
  "confirmationsRequired": 15,
  "statusUrl": "https://api.example.com/v1/status/inv_abc123/token..."
}
```

### Payment Confirmed Payload
```json
{
  "type": "payment.confirmed",
  "invoiceId": "inv_abc123",
  "merchantId": "merchant_123",
  "asset": "usdt_bep20",
  "amount": 99.8,
  "confirmations": 15,
  "txid": "0x...",
  "paidAt": 1734222000
}
```

## Configuration

### Environment Variables

```bash
# Firebase Project
FIREBASE_PROJECT_ID=your-project-id

# Blockchain Provider API Keys (stored in Secret Manager)
QUICKNODE_API_KEY=your-quicknode-key
NOWNODES_API_KEY=your-nownodes-key
GETBLOCK_API_KEY=your-getblock-key
CHAINSTACK_API_KEY=your-chainstack-key
MORALIS_API_KEY=your-moralis-key
TRONGRID_API_KEY=your-trongrid-key

# Webhook Secrets (auto-generated per merchant)
# Hot Wallet Keys (encrypted in Secret Manager)
```

### Confirmation Policies

| Asset | PAID Status | CONFIRMED Status |
|-------|-------------|------------------|
| BTC | 1 confirmation | 3 confirmations |
| ETH | 1 confirmation | 12 confirmations |
| BNB | 1 confirmation | 15 confirmations |
| USDT (ERC20) | 1 confirmation | 12 confirmations |
| USDT (BEP20) | 1 confirmation | 15 confirmations |
| USDT (TRC20) | 1 confirmation | 20 confirmations |

## Security Features

- **Secret Management**: All private keys and API keys stored in Firebase Secret Manager
- **HMAC Webhooks**: SHA-256 signed webhooks with timestamp verification
- **Rate Limiting**: Public endpoints protected against abuse
- **Firestore Rules**: Database access restricted by authentication and authorization
- **Status Tokens**: Unguessable tokens for public status URLs
- **Hot/Cold Architecture**: Minimal hot wallet balances with automated sweeping

## Testing

### Unit Tests
```bash
cd functions
npm test
```

### Integration Tests (Firebase Emulator)
```bash
firebase emulators:exec --only functions,firestore "npm test"
```

### End-to-End Tests
```bash
npm run test:e2e
```

## Deployment

### Production Deployment

1. **Configure Firebase Project**
   ```bash
   firebase use --add your-production-project
   ```

2. **Set Environment Variables**
   ```bash
   firebase functions:secrets:set QUICKNODE_API_KEY
   firebase functions:secrets:set NOWNODES_API_KEY
   # ... other secrets
   ```

3. **Deploy Backend**
   ```bash
   firebase deploy --only functions,firestore
   ```

4. **Build and Deploy Frontend**
   ```bash
   cd web
   npm run build
   firebase deploy --only hosting
   ```

### Development Deployment
```bash
npm run deploy:dev
```

## Provider Configuration

### Adding New Providers

1. Create adapter in `functions/src/adapters/`
2. Implement `BlockchainProvider` interface
3. Add to provider registry in `functions/src/providers/`
4. Update configuration in Firebase config

### Provider Priority

Providers are tried in order of priority. Configure fallback chains:

```javascript
const providerConfig = {
  eth: ['quicknode', 'chainstack', 'alchemy'],
  btc: ['nownodes', 'getblock', 'blockchair'],
  tron: ['trongrid', 'getblock']
};
```

## Monitoring

- **Cloud Functions Logs**: Firebase Console → Functions → Logs
- **Firestore Usage**: Firebase Console → Firestore → Usage
- **Provider Health**: Admin Panel → Provider Status
- **Fee Collection**: Admin Panel → Fee Management

## Support

### Common Issues

1. **Webhook Delivery Failures**: Check merchant webhook URL and signature verification
2. **Payment Detection Delays**: Verify provider API keys and rate limits
3. **Confirmation Delays**: Check blockchain network congestion
4. **Balance Discrepancies**: Review fee calculations and withdrawal history

### Key Rotation

```bash
# Rotate webhook secrets
firebase functions:call rotateWebhookSecret --data '{"merchantId":"merchant_123"}'

# Rotate hot wallet keys (requires manual approval)
firebase functions:call rotateHotWalletKey --data '{"asset":"eth"}'
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## Changelog

### v1.0.0 (MVP)
- Multi-chain payment processing (BTC, ETH, BSC, USDT variants)
- Firebase backend with Cloud Functions
- Next.js frontend with static export
- Webhook system with HMAC signing
- Merchant dashboard and admin panel
- Hot/cold wallet architecture
- Pluggable blockchain provider system
