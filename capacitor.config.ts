import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fittrack.app',
  appName: 'FitTrack',
  webDir: 'dist',
  backgroundColor: '#12110f',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_fittrack',
      iconColor: '#ff8a3d',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
    },
  },
};

export default config;
