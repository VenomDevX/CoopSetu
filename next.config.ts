import type {NextConfig} from 'next';

const isDev = process.env.NODE_ENV === 'development';
// In production: no unsafe-eval (removes XSS eval vector).
// In dev: Next.js fast-refresh requires unsafe-eval and unsafe-inline.
const scriptSrc = isDev
  ? "'self' 'unsafe-eval' 'unsafe-inline'"
  : "'self' 'unsafe-inline'";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
const supabaseWsOrigin = supabaseOrigin
  ? supabaseOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
  : '';
const connectSrc = [
  "'self'",
  supabaseOrigin,
  supabaseWsOrigin,
  'http://127.0.0.1:54321',
  'ws://127.0.0.1:54321',
  'http://localhost:54321',
  'ws://localhost:54321',
  'https://*.supabase.co',
  'wss://*.supabase.co',
  ...(isDev ? ['ws://localhost:3000', 'ws://127.0.0.1:3000'] : []),
].filter(Boolean).join(' ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc};` },
        ],
      },
    ];
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
