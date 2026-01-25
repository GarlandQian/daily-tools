import withBundleAnalyzer from '@next/bundle-analyzer'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/social/retires',
        permanent: true,
      },
    ]
  },
  experimental: {
    // Vercel best practice: bundle-barrel-imports optimization
    optimizePackageImports: ['antd', '@ant-design/icons', 'dayjs', 'lodash-es', 'crypto-js'],
  },
  transpilePackages: ['three'],
  poweredByHeader: false,
  output: 'standalone',
}

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig)
