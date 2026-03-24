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
};

export default withPWA(nextConfig);
