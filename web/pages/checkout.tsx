import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import QRCode from 'qrcode'

interface Invoice {
  invoiceId: string
  merchantId: string
  asset: string
  amountCrypto: number
  amountFiat: number
  address: string
  status: string
  expiresAt: string
  confirmationsRequired: number
  confirmationsSeen: number
}

export default function CheckoutPage() {
  const router = useRouter()
  const { amount, merchant_id, asset, external_id, customer_id } = router.query
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!amount || !merchant_id) return

    createInvoice()
  }, [amount, merchant_id, asset, external_id, customer_id])

  useEffect(() => {
    if (!invoice) return

    const paymentString = `${invoice.asset}:${invoice.address}?amount=${invoice.amountCrypto}`
    QRCode.toDataURL(paymentString)
      .then(setQrCodeUrl)
      .catch(console.error)

    const expiryTime = new Date(invoice.expiresAt).getTime()
    const now = Date.now()
    setTimeLeft(Math.max(0, Math.floor((expiryTime - now) / 1000)))

    const timer = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
      setTimeLeft(remaining)
      
      if (remaining === 0) {
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [invoice])

  const createInvoice = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        amount: amount as string,
        merchant_id: merchant_id as string,
        asset: (asset as string) || 'usdt_bep20',
        ...(external_id && { external_id: external_id as string }),
        ...(customer_id && { customer_id: customer_id as string })
      })
      
      const response = await fetch(`http://localhost:5001/demo-crypto-payment/us-central1/api/v1/checkout?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create invoice')
      }
      
      const data = await response.json()
      setInvoice(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getAssetName = (asset: string) => {
    if (!asset) return 'Unknown Asset'
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Creating payment invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Error</h1>
            <p className="text-gray-600">{error || 'Failed to create payment invoice.'}</p>
            <button 
              onClick={() => router.back()} 
              className="mt-4 btn-secondary"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isExpired = timeLeft === 0
  const isPaid = invoice.status === 'PAID' || invoice.status === 'CONFIRMED'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Complete Your Payment
            </h1>
            <p className="text-gray-600">
              Send exactly <strong>{invoice.amountCrypto} {getAssetName(invoice.asset as string)}</strong> to complete this ${invoice.amountFiat} USD payment
            </p>
          </div>

          {isExpired && !isPaid && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="text-red-500 text-xl mr-3">⏰</div>
                <div>
                  <h3 className="text-red-800 font-medium">Payment Expired</h3>
                  <p className="text-red-600 text-sm">This payment request has expired. Please create a new payment.</p>
                </div>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="text-green-500 text-xl mr-3">✅</div>
                <div>
                  <h3 className="text-green-800 font-medium">Payment Received</h3>
                  <p className="text-green-600 text-sm">
                    {invoice.status === 'CONFIRMED' 
                      ? 'Payment confirmed!' 
                      : `Payment detected. ${invoice.confirmationsRequired - invoice.confirmationsSeen} confirmations remaining.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isExpired && !isPaid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="text-blue-500 text-xl mr-3">⏱️</div>
                  <div>
                    <h3 className="text-blue-800 font-medium">Time Remaining</h3>
                    <p className="text-blue-600 text-sm">Complete payment before expiry</p>
                  </div>
                </div>
                <div className="text-2xl font-mono font-bold text-blue-800">
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan QR Code</h3>
              {qrCodeUrl && (
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-lg">
                  <img src={qrCodeUrl} alt="Payment QR Code" className="w-48 h-48" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount
                  </label>
                  <div className="input-field bg-gray-50 font-mono text-lg">
                    {invoice.amountCrypto} {getAssetName(invoice.asset as string)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send To Address
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={invoice.address}
                      readOnly
                      className="input-field bg-gray-50 font-mono text-sm flex-1"
                    />
                    <button
                      onClick={() => copyToClipboard(invoice.address)}
                      className="ml-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-medium transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="font-medium text-yellow-800 mb-1">⚠️ Important:</p>
                  <ul className="space-y-1 text-yellow-700">
                    <li>• Send exactly the amount shown above</li>
                    <li>• Use the correct network ({getAssetName(invoice.asset as string)})</li>
                    <li>• Payment will be confirmed after {invoice.confirmationsRequired} network confirmations</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Invoice ID: {invoice.invoiceId}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
