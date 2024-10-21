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
}

export default nextConfig
