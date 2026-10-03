import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FONT_DIR = 'src/assets/fonts/tty1';

/** Every non-test source file whose text can reach the screen. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (/\.test\.tsx?$/.test(name) || name.endsWith('.d.ts')) return [];
    return /\.(ts|tsx|json)$/.test(name) ? [path] : [];
  });
}

/** Comments are developer prose, never UI text: drop them before reading characters. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('TTY1 font', () => {
  it('ships every native size in both weights', () => {
    for (const size of [12, 16, 24, 32]) {
      for (const style of ['regular', 'bold']) {
        expect(existsSync(`${FONT_DIR}/tty1-${size}-${style}.woff2`)).toBe(true);
      }
    }
  });

  it('covers every character the app can print', () => {
    const { codePoints } = JSON.parse(readFileSync(`${FONT_DIR}/glyphs.json`, 'utf8')) as {
      codePoints: number[];
    };
    const covered = new Set(codePoints);
    const missing = new Map<string, string>();

    for (const file of sourceFiles('src')) {
      for (const char of withoutComments(readFileSync(file, 'utf8'))) {
        const code = char.codePointAt(0) ?? 0;
        if (code > 127 && !covered.has(code) && !missing.has(char)) missing.set(char, file);
      }
    }

    // A missing character would fall back to the system monospace, silently. Add it
    // to `wanted()` in scripts/tty1-font/build_tty1_font.py and regenerate.
    expect(
      [...missing].map(
        ([char, file]) =>
          `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')} ${char} (${file})`,
      ),
    ).toEqual([]);
  });

  it('precaches the fonts, or the first offline start would run without them', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/globPatterns:\s*\[[^\]]*woff2/);
  });
});
