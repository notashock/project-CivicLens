const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@civictrace/digipin'] = path.resolve(__dirname, '../../packages/digipin/src/index.ts');
    config.resolve.alias['@civictrace/crypto-nullifier'] = path.resolve(__dirname, '../../packages/crypto-nullifier/src/index.ts');
    config.resolve.alias['@civictrace/sanitization-worker'] = path.resolve(__dirname, '../../packages/sanitization-worker/src/index.ts');
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
