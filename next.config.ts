import type { NextConfig } from 'next';

const deploymentId = process.env.NEXT_DEPLOYMENT_ID;
const assetDeploymentId = deploymentId?.replace(/[^A-Za-z0-9._-]/gu, '-');

const nextConfig: NextConfig = {
  deploymentId,
  assetPrefix: assetDeploymentId ? `/assets/${assetDeploymentId}` : undefined,
  // This repository is deployed inside /opt/pilot-plus/releases; do not let
  // Next.js pick an unrelated lockfile from the server filesystem root.
  turbopack: {
    root: process.cwd(),
  },
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', '192.168.31.172'],
  experimental: {
    // Production has limited memory; one build worker keeps deployments from starving the live slot.
    cpus: 1,
    serverActions: {
      bodySizeLimit: '180mb',
    },
  },
  typescript: {
    // CI/local builds still type-check; the constrained production host reuses that verification.
    ignoreBuildErrors: process.env.SUPAPRO_SKIP_BUILD_TYPECHECK === '1',
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
