import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  agentRules: false,
  logging: { incomingRequests: false },
  output: 'standalone',
  // Mutable local PostgreSQL and source ZIP must never enter a deployable bundle.
  outputFileTracingExcludes: { '*': ['./data/**/*', './archive/**/*', './test-results/**/*', './playwright-report/**/*', './releases/**/*', './private/**/*', './credentials/**/*', './secrets/**/*', './.env*'] },
  webpack(config, { dev }) {
    if (dev) {
      const previous = config.watchOptions?.ignored;
      config.watchOptions = { ...config.watchOptions, ignored: previous instanceof RegExp ? new RegExp(`${previous.source}|[/\\\\]data[/\\\\](db|raw)([/\\\\]|$)`, previous.flags) : [...(Array.isArray(previous) ? previous : typeof previous === 'string' ? [previous] : []), '**/data/db/**', '**/data/raw/**'] };
    }
    return config;
  },
};
export default config;
