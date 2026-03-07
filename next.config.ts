import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Exclude Puppeteer from the Vercel serverless bundle
  serverExternalPackages: ['puppeteer'],
}

export default nextConfig
