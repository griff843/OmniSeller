import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(appDir, '../..', '.env');

if (existsSync(rootEnvPath)) {
  const rootEnv = readFileSync(rootEnvPath, 'utf8');

  for (const line of rootEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = (match[2] ?? '').replace(/^['"]|['"]$/g, '');
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@omniseller/ui', '@omniseller/db'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  async headers() {
    const production = process.env.NODE_ENV === 'production';
    const auth0Origin = process.env.AUTH0_ISSUER ? new URL(process.env.AUTH0_ISSUER).origin : '';
    const connectSources = ["'self'", auth0Origin, process.env.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean).join(' ');
    const headers = [
      { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' ${auth0Origin}; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${production ? '' : " 'unsafe-eval'"}; connect-src ${connectSources}` },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    if (production) headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    return [{ source: '/(.*)', headers }];
  },
};

export default nextConfig;
