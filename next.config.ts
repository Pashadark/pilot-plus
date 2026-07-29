import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', '192.168.31.172'],
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
