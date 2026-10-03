import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, THEMES, THEME_STORAGE_KEY, type Theme } from './theme';

vi.mock('@/platform/systemBars', () => ({ syncSystemBars: vi.fn().mockResolvedValue(undefined) }));

/** The synchronous script of index.html, as the browser runs it before first paint. */
function bootScript(): string {
  const html = readFileSync('index.html', 'utf8');
  const match = html.match(/<script>\s*\(function \(\) \{([\s\S]*?)\}\)\(\);\s*<\/script>/);
  if (match === null) throw new Error('le script de thème est introuvable dans index.html');
  return match[1] ?? '';
}

function resetDocument(): void {
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#12110f" />';
}

function painted() {
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    color: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content,
  };
}

describe('index.html theme script', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDocument();
  });

  it.each(THEMES)('paints %s exactly as applyTheme does', (theme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    new Function(bootScript())();
    const fromScript = painted();

    resetDocument();
    applyTheme(theme);

    expect(fromScript).toEqual(painted());
  });

  it('falls back to the dark theme for an unknown stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'solarized');
    new Function(bootScript())();

    expect(painted()).toEqual({ theme: 'dark', color: '#12110f' });
  });

  it('falls back to the dark theme when nothing is stored', () => {
    new Function(bootScript())();

    expect(painted()).toEqual({ theme: 'dark', color: '#12110f' });
  });

  it('does not take an inherited property name for a theme', () => {
    // `colors['toString']` is a function, not a colour: a stored value must be a theme the
    // script knows, not merely a key that exists on any object.
    localStorage.setItem(THEME_STORAGE_KEY, 'toString');
    new Function(bootScript())();

    expect(painted()).toEqual({ theme: 'dark', color: '#12110f' });
  });
});
