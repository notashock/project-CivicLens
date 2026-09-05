const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    'lucide-react',
    '@civictrace/digipin',
    '@civictrace/crypto-nullifier',
    '@civictrace/sanitization-worker'
  ],
  webpack: (config) => {
    config.resolve.alias['@civictrace/digipin'] = path.resolve(__dirname, '../../packages/digipin/src/index.ts');
    config.resolve.alias['@civictrace/crypto-nullifier'] = path.resolve(__dirname, '../../packages/crypto-nullifier/src/index.ts');
    config.resolve.alias['@civictrace/sanitization-worker'] = path.resolve(__dirname, '../../packages/sanitization-worker/src/index.ts');
    return config;
  },
  async rewrites() {
    const apiTarget = process.env.INTERNAL_API_URL || `http://127.0.0.1:${process.env.API_PORT || 8000}`;
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
