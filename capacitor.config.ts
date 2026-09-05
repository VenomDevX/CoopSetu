import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coopsetu.app',
  appName: 'Coopsetu',
  webDir: 'public',
  server: {
    url: 'http://192.168.29.124:3000',
    cleartext: true
  }
};

export default config;
