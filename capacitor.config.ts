import type { CapacitorConfig } from '@capacitor/cli';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// This is a full Next.js SSR app (API routes, middleware, server components),
// not a statically-exportable site — so the Android WebView can't bundle a
// local copy of it. It always points `server.url` at a real running instance:
// each developer's own reachable dev-server address for local testing, or the
// real deployed domain for a release build.
//
// Deliberately a SEPARATE var from NEXT_PUBLIC_APP_URL, not a reuse of it:
// that one is also used by the web app itself (invite links, OAuth callback
// URLs — see app/api/v1/members/invite/route.ts) to build links a real
// browser will open, so it correctly stays `http://localhost:3000` for local
// dev. The Android emulator can't resolve its host's `localhost` at all — it
// needs the special `10.0.2.2` alias — and a physical device needs the
// host's real LAN IP, neither of which a browser-facing link should ever
// point at. Set CAPACITOR_DEV_SERVER_URL in `.env.local` (see .env.example)
// to whichever of those applies; never hardcode a personal machine's IP here.
const appUrl = process.env.CAPACITOR_DEV_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

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
