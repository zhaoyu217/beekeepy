import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Development bundle id. Replace with the final brand id before store release.
  appId: 'app.hivefield.mobile',
  appName: 'Hive',
  webDir: 'mobile/dist',
  bundledWebRuntime: false,
  // Android 15+ system bars overlap the WebView. Capacitor handles old WebViews
  // natively and exposes CSS env(safe-area-inset-*) on modern WebViews.
  plugins: {
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
      hidden: false
    }
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
