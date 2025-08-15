import React from 'react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="card max-w-md w-full mx-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Crypto Payment Processor
          </h1>
          <p className="text-gray-600 mb-8">
            Secure, production-grade cryptocurrency payment processing
          </p>
          
          <div className="space-y-4">
            <Link href="/checkout?amount=100&merchant_id=test123&asset=usdt_bep20&customer_id=demo_customer" className="btn-primary block">
              Demo Checkout
            </Link>
            <Link href="/dashboard" className="btn-secondary block">
              Merchant Dashboard
            </Link>
            <Link href="/admin" className="btn-secondary block">
              Admin Panel
            </Link>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Built with Next.js, Firebase, and Tailwind CSS
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
