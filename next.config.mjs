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
  transpilePackages: ['three'],
}

export default nextConfig
