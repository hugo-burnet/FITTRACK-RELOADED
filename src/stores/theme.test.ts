import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, loadTheme, THEME_STORAGE_KEY } from './theme';

const syncSystemBars = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/platform/systemBars', () => ({ syncSystemBars }));

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  it('utilise le thème sombre par défaut', () => {
    expect(loadTheme()).toBe('dark');
  });

  it('mémorise le thème choisi', () => {
    applyTheme('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(loadTheme()).toBe('light');
  });

  it("pose l'attribut data-theme sur la racine du document", () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('met à jour la couleur de la barre système', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#12110f';
    document.head.append(meta);

    applyTheme('light');
    expect(meta.content).toBe('#f7f8f6');
    applyTheme('dark');
    expect(meta.content).toBe('#12110f');

    meta.remove();
  });

  it('synchronise le thème avec les barres système natives', () => {
    applyTheme('light');
    applyTheme('dark');

    expect(syncSystemBars).toHaveBeenNthCalledWith(1, 'light');
    expect(syncSystemBars).toHaveBeenNthCalledWith(2, 'dark');
  });
});
