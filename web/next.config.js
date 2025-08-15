/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  basePath: '',
  ...(process.env.NODE_ENV === 'production' && { distDir: 'out' }),
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:5001/demo-crypto-payment/us-central1/api/:path*'
        }
      ]
    }
    return []
  }
}

module.exports = nextConfig
