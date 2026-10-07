import type { CapacitorConfig } from '@capacitor/cli'
import pkg from './package.json' with { type: 'json' }

const config: CapacitorConfig = {
  appId: 'ee.forgr.bewise',
  appName: 'BeWise',
  webDir: 'dist',
  backgroundColor: '#0b1016',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      autoSplashscreen: true,
      directUpdate: 'atInstall',
      version: pkg.version,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0b1016',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_bewise',
      iconColor: '#00c0ff',
    },
  },
}

export default config
