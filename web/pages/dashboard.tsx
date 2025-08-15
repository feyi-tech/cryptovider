import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

interface Balance {
  asset: string
  available: number
  pending: number
}

interface Invoice {
  invoiceId: string
  currency: string
  amountFiat: number
  asset: string
  amountCrypto: number
  status: string
  createdAt: string
  expiresAt: string
}

export default function MerchantDashboard() {
  const router = useRouter()
  const [balances, setBalances] = useState<Balance[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      setBalances([
        { asset: 'btc', available: 0.00125, pending: 0.0003 },
        { asset: 'eth', available: 0.45, pending: 0.12 },
        { asset: 'bnb', available: 2.8, pending: 0.5 },
        { asset: 'usdt_erc20', available: 1250.75, pending: 300.25 },
        { asset: 'usdt_bep20', available: 890.50, pending: 150.00 },
        { asset: 'usdt_trc20', available: 650.25, pending: 75.50 }
      ])
      
      setInvoices([
        {
          invoiceId: 'inv_7924d36aae8d4d3eb88d36fa3f89a2be',
          currency: 'USD',
          amountFiat: 100,
          asset: 'usdt_bep20',
          amountCrypto: 100.5,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        }
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getAssetName = (asset: string) => {
    const names: Record<string, string> = {
      btc: 'Bitcoin',
      eth: 'Ethereum',
      bnb: 'BNB',
      usdt_erc20: 'USDT (ERC20)',
      usdt_bep20: 'USDT (BEP20)',
      usdt_trc20: 'USDT (TRC20)'
    }
    return names[asset] || asset.toUpperCase()
  }

  const formatAmount = (amount: number, asset: string) => {
    const decimals = asset === 'btc' ? 8 : asset.includes('usdt') ? 2 : 4
    return amount.toFixed(decimals)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'text-green-600 bg-green-50'
      case 'PAID': return 'text-blue-600 bg-blue-50'
      case 'PENDING': return 'text-yellow-600 bg-yellow-50'
      case 'EXPIRED': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Merchant Dashboard</h1>
          <p className="text-gray-600">Manage your cryptocurrency payments and balances</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Asset Balances</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Asset</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Available</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Pending</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr key={balance.asset} className="border-b border-gray-100">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{getAssetName(balance.asset)}</div>
                          <div className="text-sm text-gray-500">{balance.asset.toUpperCase()}</div>
                        </td>
                        <td className="py-4 px-4 text-right font-mono">
                          {formatAmount(balance.available, balance.asset)}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-yellow-600">
                          {formatAmount(balance.pending, balance.asset)}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button className="btn-primary text-sm">Withdraw</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Invoices</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Invoice ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Asset</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.invoiceId} className="border-b border-gray-100">
                        <td className="py-4 px-4">
                          <div className="font-mono text-sm text-gray-900">
                            {invoice.invoiceId.substring(0, 20)}...
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-medium">${invoice.amountFiat}</div>
                          <div className="text-sm text-gray-500 font-mono">
                            {formatAmount(invoice.amountCrypto, invoice.asset)}
                          </div>
                        </td>
                        <td className="py-4 px-4">{getAssetName(invoice.asset)}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Webhook Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-site.com/webhook"
                    className="input-field"
                  />
                </div>
                <button className="btn-primary w-full">Update Webhook</button>
                <button className="btn-secondary w-full">Test Webhook</button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">API Keys</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Production Key</span>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Active</span>
                  </div>
                  <div className="font-mono text-sm text-gray-600">
                    pk_live_••••••••••••••••
                  </div>
                </div>
                <button className="btn-secondary w-full">Generate New Key</button>
                <button className="btn-secondary w-full">Revoke Key</button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
              <div className="space-y-3">
                <button 
                  onClick={() => router.push('/checkout?amount=100&merchant_id=test123&asset=usdt_bep20&customer_id=demo_customer')}
                  className="btn-primary w-full"
                >
                  Create Test Invoice
                </button>
                <button className="btn-secondary w-full">Download Reports</button>
                <button className="btn-secondary w-full">View Documentation</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
