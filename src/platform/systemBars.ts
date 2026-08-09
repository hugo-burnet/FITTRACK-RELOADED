import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Theme } from '@/stores/theme';
import { isNativeAndroid } from './nativeEnvironment';

export async function syncSystemBars(theme: Theme): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    await SystemBars.setStyle({
      style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    });
  } catch (error) {
    console.error(error);
  }
}
