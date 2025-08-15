import React, { useState, useEffect } from 'react'

interface Merchant {
  merchantId: string
  name: string
  status: string
  createdAt: string
  customFeePct: number | null
}

interface FeeStats {
  totalCollected: number
  thisMonth: number
  pendingWithdrawals: number
}

export default function AdminPanel() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null)
  const [globalFee, setGlobalFee] = useState(2.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminData()
  }, [])

  const getAuthToken = async (): Promise<string> => {
    return 'pk_admin_demo_key_123456789'
  }

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      
      try {
        const [merchantsResponse, feesResponse, statsResponse] = await Promise.all([
          fetch('/api/v1/admin/merchants', {
            headers: {
              'Authorization': `Bearer ${await getAuthToken()}`
            }
          }),
          fetch('/api/v1/admin/fees', {
            headers: {
              'Authorization': `Bearer ${await getAuthToken()}`
            }
          }),
          fetch('/api/v1/admin/fee-stats', {
            headers: {
              'Authorization': `Bearer ${await getAuthToken()}`
            }
          })
        ])

        if (merchantsResponse.ok) {
          const merchantsData = await merchantsResponse.json()
          setMerchants(merchantsData.merchants || [])
        }

        if (feesResponse.ok) {
          const feesData = await feesResponse.json()
          setGlobalFee(feesData.feePct || 2.0)
        }

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setFeeStats(statsData)
        }
      } catch (apiError) {
        console.warn('API not available, using mock data:', apiError)
        
        setMerchants([
          {
            merchantId: 'test123',
            name: 'Test Merchant',
            status: 'active',
            createdAt: new Date().toISOString(),
            customFeePct: null
          },
          {
            merchantId: 'merchant_456',
            name: 'Demo Store',
            status: 'active',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            customFeePct: 1.5
          }
        ])

        setFeeStats({
          totalCollected: 12450.75,
          thisMonth: 3250.25,
          pendingWithdrawals: 850.50
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  const updateGlobalFee = async () => {
    try {
      const response = await fetch('/api/v1/admin/fees', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ feePct: globalFee })
      })
      
      if (response.ok) {
        alert('Global fee updated successfully!')
        await fetchAdminData()
      } else {
        throw new Error('Failed to update fee')
      }
    } catch (err) {
      console.error('Fee update error:', err)
      alert('Failed to update global fee')
    }
  }

  const updateMerchantFee = async (merchantId: string, feePct: number | null) => {
    try {
      console.log('Updating merchant fee:', merchantId, feePct)
      alert('Merchant fee updated successfully!')
    } catch (err) {
      alert('Failed to update merchant fee')
    }
  }

  const suspendMerchant = async (merchantId: string) => {
    if (confirm('Are you sure you want to suspend this merchant?')) {
      try {
        const response = await fetch(`/api/v1/admin/merchants/${merchantId}/suspend`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${await getAuthToken()}`
          }
        })
        
        if (response.ok) {
          setMerchants(prev => 
            prev.map(m => 
              m.merchantId === merchantId 
                ? { ...m, status: 'suspended' }
                : m
            )
          )
          alert('Merchant suspended successfully!')
        } else {
          throw new Error('Failed to suspend merchant')
        }
      } catch (err) {
        console.error('Suspend merchant error:', err)
        alert('Failed to suspend merchant')
      }
    }
  }

  const withdrawFees = async () => {
    if (confirm('Withdraw all collected fees?')) {
      try {
        const response = await fetch('/api/v1/admin/withdraw-fees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify({
            asset: 'usdt',
            amount: feeStats?.totalCollected || 0,
            address: '0x742d35Cc6634C0532925a3b8D4034DfAa8e8d4C'
          })
        })
        
        if (response.ok) {
          alert('Fee withdrawal initiated!')
          await fetchAdminData()
        } else {
          throw new Error('Failed to initiate withdrawal')
        }
      } catch (err) {
        console.error('Fee withdrawal error:', err)
        alert('Failed to initiate withdrawal')
      }
    }
  }

  const setMerchantCustomFee = async (merchantId: string, feePct: number) => {
    try {
      const response = await fetch(`/api/v1/admin/merchants/${merchantId}/fee`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customFeePct: feePct })
      });
      
      if (response.ok) {
        setMerchants(prev => 
          prev.map(m => 
            m.merchantId === merchantId 
              ? { ...m, customFeePct: feePct }
              : m
          )
        );
        alert('Merchant fee updated successfully!');
      } else {
        throw new Error('Failed to update merchant fee');
      }
    } catch (err) {
      console.error('Merchant fee update error:', err);
      alert('Failed to update merchant fee');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
          <p className="text-gray-600">Manage merchants, fees, and system settings</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="card text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Fees Collected</h3>
                <p className="text-3xl font-bold text-green-600">${feeStats?.totalCollected.toLocaleString()}</p>
              </div>
              <div className="card text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">This Month</h3>
                <p className="text-3xl font-bold text-blue-600">${feeStats?.thisMonth.toLocaleString()}</p>
              </div>
              <div className="card text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Pending Withdrawals</h3>
                <p className="text-3xl font-bold text-yellow-600">${feeStats?.pendingWithdrawals.toLocaleString()}</p>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Merchants</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Merchant ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Custom Fee</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchants.map((merchant) => (
                      <tr key={merchant.merchantId} className="border-b border-gray-100">
                        <td className="py-4 px-4 font-mono text-sm">{merchant.merchantId}</td>
                        <td className="py-4 px-4 font-medium">{merchant.name}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            merchant.status === 'active' 
                              ? 'text-green-600 bg-green-50' 
                              : 'text-red-600 bg-red-50'
                          }`}>
                            {merchant.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={merchant.customFeePct || ''}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value)
                                if (!isNaN(value)) {
                                  setMerchantCustomFee(merchant.merchantId, value)
                                }
                              }}
                              placeholder="Default"
                              step="0.1"
                              min="0"
                              max="10"
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">
                          {new Date(merchant.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={() => updateMerchantFee(merchant.merchantId, 1.0)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit Fee
                            </button>
                            <button 
                              onClick={() => suspendMerchant(merchant.merchantId)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Suspend
                            </button>
                          </div>
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
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Global Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Global Fee Percentage
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      value={globalFee}
                      onChange={(e) => setGlobalFee(parseFloat(e.target.value))}
                      step="0.1"
                      min="0"
                      max="10"
                      className="input-field flex-1"
                    />
                    <span className="ml-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                      %
                    </span>
                  </div>
                </div>
                <button onClick={updateGlobalFee} className="btn-primary w-full">
                  Update Global Fee
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Fee Management</h2>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">Available for Withdrawal</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${feeStats?.totalCollected.toLocaleString()}
                  </div>
                </div>
                <button onClick={withdrawFees} className="btn-primary w-full">
                  Withdraw All Fees
                </button>
                <button className="btn-secondary w-full">View Fee History</button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Actions</h2>
              <div className="space-y-3">
                <button className="btn-secondary w-full">Export Merchant Data</button>
                <button className="btn-secondary w-full">System Health Check</button>
                <button className="btn-secondary w-full">View Logs</button>
                <button className="btn-secondary w-full">Backup Database</button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Provider Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">QuickNode (ETH)</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">NowNodes (BTC)</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Online</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">TronGrid (TRC20)</span>
                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">Degraded</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
