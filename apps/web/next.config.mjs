import withPWAInit from 'next-pwa';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runtimeCaching = require('./pwa/runtime-caching.cjs');

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const upstream = process.env.ORION_API_UPSTREAM ?? 'http://127.0.0.1:3211';
    return [
      {
        source: '/api/:path*',
        destination: `${upstream}/api/:path*`,
      },
    ];
  },
};

export default withPWA(nextConfig);
