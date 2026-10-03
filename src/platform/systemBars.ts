import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Theme } from '@/stores/theme';
import { isNativeAndroid } from './nativeEnvironment';

export async function syncSystemBars(theme: Theme): Promise<void> {
  if (!isNativeAndroid()) return;

  try {
    await SystemBars.setStyle({
      // `Dark` is the style for a dark background: light icons. TTY1 is black, so it takes it
      // too — only the light theme wants the other one. Written as "not light" so that a
      // theme added later starts on the dark bar, the app's default, rather than on the one
      // that makes its icons vanish.
      style: theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark,
    });
  } catch (error) {
    console.error(error);
  }
}
