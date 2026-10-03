import { syncSystemBars } from '@/platform/systemBars';

export type Theme = 'dark' | 'light' | 'tty1';

/** Every theme the app ships, in the order Settings lists them. */
export const THEMES: readonly Theme[] = ['dark', 'light', 'tty1'];

export const THEME_STORAGE_KEY = 'fittrack:theme';

/**
 * Kept in sync with --surface-0 in index.css and styles/tty1.css, and with the table of the
 * blocking script in index.html (`themeBootScript.test.ts` holds the two together). Drives the
 * Android system bar.
 */
const SYSTEM_BAR_COLOR: Record<Theme, string> = {
  dark: '#12110f',
  light: '#f7f8f6',
  tty1: '#000000',
};

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  // An unknown value, from an older build or a hand-edited store, must not leave
  // the document with a `data-theme` that no stylesheet knows.
  return THEMES.find((theme) => theme === stored) ?? 'dark';
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);

  // Without this the status bar keeps the colour baked into index.html and the
  // app reads as a web page with a mismatched header.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = SYSTEM_BAR_COLOR[theme];
  void syncSystemBars(theme);
}
