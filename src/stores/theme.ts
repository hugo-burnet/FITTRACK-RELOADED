export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'fittrack:theme';

/** Kept in sync with --surface-0 in index.css. Drives the Android system bar. */
const SYSTEM_BAR_COLOR: Record<Theme, string> = {
  dark: '#0a0a0b',
  light: '#ffffff',
};

export function loadTheme(): Theme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);

  // Without this the status bar keeps the colour baked into index.html and the
  // app reads as a web page with a mismatched header.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = SYSTEM_BAR_COLOR[theme];
}
