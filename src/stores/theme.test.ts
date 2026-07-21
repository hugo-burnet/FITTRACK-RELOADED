import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, loadTheme, THEME_STORAGE_KEY } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
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
    meta.content = '#0a0a0b';
    document.head.append(meta);

    applyTheme('light');
    expect(meta.content).toBe('#ffffff');
    applyTheme('dark');
    expect(meta.content).toBe('#0a0a0b');

    meta.remove();
  });
});
