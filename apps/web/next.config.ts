import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  transpilePackages: [
    '@marutime/auth',
    '@marutime/config',
    '@marutime/core',
    '@marutime/db',
    '@marutime/metadata',
    '@marutime/storage',
    '@marutime/ui',
  ],
  serverExternalPackages: ['postgres', 'sharp', '@aws-sdk/client-s3'],
  images: {
    // TMDB already serves pre-sized variants, and Vercel's image optimizer is
    // quota-limited on the free tier, so we serve images directly.
    unoptimized: true,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
