import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Development bundle id. Replace with the final brand id before store release.
  appId: 'app.hivefield.mobile',
  appName: 'Hive',
  webDir: 'mobile/dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
