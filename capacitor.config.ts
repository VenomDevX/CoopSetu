import type { CapacitorConfig } from '@capacitor/cli';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// This is a full Next.js SSR app (API routes, middleware, server components),
// not a statically-exportable site — so the Android WebView can't bundle a
// local copy of it. It always points `server.url` at a real running instance:
// each developer's own reachable dev-server address (LAN IP or tunnel URL) for
// local testing, or the real deployed domain for a release build. Never
// hardcode a personal machine's IP here — set NEXT_PUBLIC_APP_URL in
// `.env.local` instead (see .env.example), which every developer already
// configures for their own environment.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const config: CapacitorConfig = {
  appId: 'com.coopsetu.app',
  appName: 'Coopsetu',
  webDir: 'public',
  server: {
    url: appUrl,
    // Only allow plaintext HTTP for local dev addresses; a real deployment
    // must be served over HTTPS.
    cleartext: appUrl.startsWith('http://'),
  },
};

export default config;
