import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
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
  output: 'standalone',
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        // Responses now differ by user-agent: the Capacitor sentinel selects
        // the native UI (see middleware.ts + lib/native/is-native.ts), so any
        // shared cache must key on it.
        //
        // Scope note, verified against the running server rather than assumed:
        // Next overwrites Vary on RSC *document* responses with its own values
        // (rsc, next-router-state-tree, ...), discarding whatever middleware or
        // this config sets. Those responses are all `Cache-Control: no-store,
        // must-revalidate` though — because the root layout reads headers() —
        // so no shared cache stores them in the first place, and no-store is a
        // stronger guarantee than Vary would be. This entry covers everything
        // Next does not override (redirects, /manifest.json and other assets)
        // and keeps the app correct if that cache policy ever loosens.
        source: '/:path*',
        headers: [{ key: 'Vary', value: 'User-Agent' }],
      },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
