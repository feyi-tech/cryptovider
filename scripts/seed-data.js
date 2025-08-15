const admin = require('../functions/node_modules/firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
admin.initializeApp({ projectId: 'demo-crypto-payment' });

const db = admin.firestore();

async function seedData() {
  try {
    console.log('Seeding test data...');

    await db.collection('merchants').doc('demo-merchant').set({
      name: 'Demo Merchant',
      ownerUid: 'demo-user-123',
      createdAt: admin.firestore.Timestamp.now(),
      status: 'active',
      webhookUrl: null,
      webhookSecretRef: null,
      customFeePct: null
    });
    console.log('✓ Created demo merchant');

    await db.collection('stores').doc('demo-store').set({
      merchantId: 'demo-merchant',
      name: 'Test Store',
      btcXpub: null,
      evmKeyRef: null,
      bscKeyRef: null,
      tronKeyRef: null,
      confirmPolicy: {
        btc: { paidAt: 1, confirmedAt: 3 },
        eth: { paidAt: 1, confirmedAt: 12 },
        bnb: { paidAt: 1, confirmedAt: 15 },
        usdt_erc20: { paidAt: 1, confirmedAt: 12 },
        usdt_bep20: { paidAt: 1, confirmedAt: 15 },
        usdt_trc20: { paidAt: 1, confirmedAt: 20 }
      }
    });
    console.log('✓ Created test store');

    const rates = {
      btc: { value: 45000, updatedAt: admin.firestore.Timestamp.now() },
      eth: { value: 2500, updatedAt: admin.firestore.Timestamp.now() },
      bnb: { value: 300, updatedAt: admin.firestore.Timestamp.now() },
      usdt_erc20: { value: 1, updatedAt: admin.firestore.Timestamp.now() },
      usdt_bep20: { value: 1, updatedAt: admin.firestore.Timestamp.now() },
      usdt_trc20: { value: 1, updatedAt: admin.firestore.Timestamp.now() }
    };

    for (const [asset, data] of Object.entries(rates)) {
      await db.collection('rates').doc(asset).set(data);
    }
    console.log('✓ Created exchange rates');

    await db.collection('fees').doc('global').set({
      feePct: 0.02 // 2% global fee
    });
    console.log('✓ Created global fee configuration');

    await db.collection('apiKeys').doc('pk_admin_demo_key_123456789').set({
      merchantId: 'admin',
      name: 'Admin Demo Key',
      status: 'active',
      permissions: ['admin'],
      createdAt: admin.firestore.Timestamp.now(),
      lastUsedAt: null,
      usageCount: 0
    });
    console.log('✓ Created admin API key');

    console.log('✅ Test data seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
