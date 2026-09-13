import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', '192.168.31.172'],
  experimental: {
    serverActions: {
      bodySizeLimit: '180mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'autopilotrent.ru',
      },
    ],
  },
};

export default nextConfig;
