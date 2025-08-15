# API Reference

## Authentication

### API Keys
Merchant endpoints require API key authentication via header:
```
Authorization: Bearer pk_live_your_api_key_here
```

### Admin Authentication
Admin endpoints require Firebase Auth token with `admin: true` custom claim:
```
Authorization: Bearer firebase_auth_token
```

## Public Endpoints

### Create Checkout
Creates an invoice and returns checkout URL.

**Endpoint:** `GET /v1/checkout`

**Query Parameters:**
- `amount` (required): USD amount (number)
- `merchant_id` (required): Merchant identifier
- `asset` (required): Cryptocurrency asset (`btc|eth|bnb|usdt_erc20|usdt_bep20|usdt_trc20`)
- `external_id` (optional): External reference ID
- `customer_id` (optional): Customer identifier

**Response:**
```json
{
  "invoiceId": "inv_abc123",
  "checkoutUrl": "/checkout?invoice=inv_abc123",
  "statusUrl": "/v1/status/inv_abc123/token123"
}
```

**Example:**
```bash
curl "https://api.example.com/v1/checkout?amount=100&merchant_id=merchant_123&asset=usdt_bep20"
```

### Payment Status
Get public payment status (rate-limited).

**Endpoint:** `GET /v1/status/:invoiceId/:statusToken`

**Response:**
```json
{
  "status": "PENDING|PAID|CONFIRMED|EXPIRED|UNDERPAID",
  "confirmationsSeen": 5,
  "confirmationsRequired": 15,
  "amountReceived": 99.8,
  "amountRequired": 100.0
}
```

**Rate Limits:**
- 60 requests per minute per IP
- 10 requests per minute per status token

## Merchant Endpoints

### Create Invoice
Create a new payment invoice.

**Endpoint:** `POST /v1/invoices`

**Request Body:**
```json
{
  "currency": "USD",
  "amountFiat": 100.00,
  "asset": "usdt_bep20",
  "externalId": "order_123",
  "customerId": "customer_456"
}
```

**Response:**
```json
{
  "invoiceId": "inv_abc123",
  "merchantId": "merchant_123",
  "storeId": "store_123",
  "currency": "USD",
  "amountFiat": 100.00,
  "asset": "usdt_bep20",
  "amountCrypto": 100.5,
  "address": "0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C",
  "status": "PENDING",
  "expiresAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-15T10:15:00Z",
  "statusToken": "9d8f3ef7c2...",
  "confirmationsRequired": 15,
  "confirmationsSeen": 0
}
```

### Get Invoice
Retrieve invoice details.

**Endpoint:** `GET /v1/invoices/:invoiceId`

**Response:** Same as create invoice response.

### Update Webhook URL
Set or update merchant webhook URL.

**Endpoint:** `PUT /v1/merchants/:merchantId/webhook`

**Request Body:**
```json
{
  "webhookUrl": "https://your-site.com/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "webhookUrl": "https://your-site.com/webhook",
  "webhookSecret": "whsec_abc123..."
}
```

### Test Webhook
Send test webhook to merchant URL.

**Endpoint:** `POST /v1/webhooks/test`

**Request Body:**
```json
{
  "merchantId": "merchant_123"
}
```

**Response:**
```json
{
  "success": true,
  "deliveryId": "delivery_123",
  "responseStatus": 200,
  "responseTime": 150
}
```

### Request Withdrawal
Request withdrawal of available balance.

**Endpoint:** `POST /v1/withdrawals`

**Request Body:**
```json
{
  "asset": "usdt_bep20",
  "amount": 500.00,
  "address": "0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C"
}
```

**Response:**
```json
{
  "withdrawalId": "withdrawal_123",
  "asset": "usdt_bep20",
  "amount": 500.00,
  "address": "0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C",
  "status": "PENDING",
  "createdAt": "2024-01-15T10:15:00Z"
}
```

## Admin Endpoints

### Get Global Fee
Retrieve current global fee percentage.

**Endpoint:** `GET /v1/admin/fees`

**Response:**
```json
{
  "feePct": 2.0
}
```

### Update Global Fee
Set global fee percentage.

**Endpoint:** `PUT /v1/admin/fees`

**Request Body:**
```json
{
  "feePct": 2.5
}
```

### Set Merchant Custom Fee
Override global fee for specific merchant.

**Endpoint:** `PUT /v1/admin/merchants/:merchantId/fee`

**Request Body:**
```json
{
  "customFeePct": 1.5
}
```

### Withdraw Admin Fees
Withdraw collected admin fees.

**Endpoint:** `POST /v1/admin/withdraw-fees`

**Request Body:**
```json
{
  "asset": "usdt_bep20",
  "amount": 1000.00,
  "address": "0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C"
}
```

### List Merchants
Get all merchants (paginated).

**Endpoint:** `GET /v1/admin/merchants`

**Query Parameters:**
- `limit` (optional): Results per page (default: 50, max: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "merchants": [
    {
      "merchantId": "merchant_123",
      "name": "Test Merchant",
      "status": "active",
      "createdAt": "2024-01-15T10:15:00Z",
      "customFeePct": null
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

## Error Responses

All endpoints return consistent error format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable error message",
  "details": {
    "field": "Additional error context"
  }
}
```

### Common Error Codes

- `INVALID_REQUEST` - Malformed request or missing required fields
- `UNAUTHORIZED` - Invalid or missing authentication
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Too many requests
- `MERCHANT_NOT_FOUND` - Merchant ID not found
- `INVOICE_NOT_FOUND` - Invoice ID not found
- `INVOICE_EXPIRED` - Invoice has expired
- `INSUFFICIENT_BALANCE` - Not enough balance for withdrawal
- `INVALID_ADDRESS` - Invalid cryptocurrency address
- `PROVIDER_ERROR` - Blockchain provider error
- `INTERNAL_ERROR` - Server error

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (INVALID_REQUEST)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests (RATE_LIMITED)
- `500` - Internal Server Error

## Webhook Verification

### Node.js Example
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Express.js middleware
app.use('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const payload = req.body;
  
  if (!verifyWebhook(payload, signature, timestamp, webhookSecret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const event = JSON.parse(payload);
  console.log('Webhook received:', event.type);
  
  res.status(200).send('OK');
});
```

### PHP Example
```php
<?php
function verifyWebhook($payload, $signature, $timestamp, $secret) {
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
    return hash_equals($expectedSignature, $signature);
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$timestamp = $_SERVER['HTTP_X_WEBHOOK_TIMESTAMP'];

if (!verifyWebhook($payload, $signature, $timestamp, $webhookSecret)) {
    http_response_code(401);
    exit('Invalid signature');
}

$event = json_decode($payload, true);
echo "Webhook received: " . $event['type'];
?>
```

### Python Example
```python
import hmac
import hashlib
import json

def verify_webhook(payload, signature, timestamp, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        f"{timestamp}.{payload}".encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected_signature, signature)

# Flask example
from flask import Flask, request

@app.route('/webhook', methods=['POST'])
def webhook():
    payload = request.get_data()
    signature = request.headers.get('X-Webhook-Signature')
    timestamp = request.headers.get('X-Webhook-Timestamp')
    
    if not verify_webhook(payload, signature, timestamp, webhook_secret):
        return 'Invalid signature', 401
    
    event = json.loads(payload)
    print(f"Webhook received: {event['type']}")
    
    return 'OK', 200
```

## Rate Limiting

### Status Endpoint Limits
- **Per IP**: 60 requests per minute
- **Per Token**: 10 requests per minute
- **Burst**: 10 requests per 10 seconds

### API Endpoint Limits
- **Merchant APIs**: 1000 requests per hour per API key
- **Admin APIs**: 500 requests per hour per admin user
- **Webhook Tests**: 10 per hour per merchant

### Headers
Rate limit information is returned in response headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1640995200
```

## SDKs and Libraries

### Official SDKs
- Node.js SDK (coming soon)
- PHP SDK (coming soon)
- Python SDK (coming soon)

### Community Libraries
- Go client library
- Ruby gem
- .NET package

## Postman Collection

Import our Postman collection for easy API testing:
[Download Collection](./postman-collection.json)

## OpenAPI Specification

Full OpenAPI 3.0 specification available:
[Download OpenAPI Spec](./openapi.yaml)
