import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skin = readFileSync('src/styles/cyber.css', 'utf8');
const base = readFileSync('src/index.css', 'utf8');

/** The declarations of the first rule that opens with exactly `selector {`. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`règle introuvable : ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('\n}', open));
}

function tokens(body: string): Map<string, string> {
  const found = [...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)];
  return new Map(found.map((match) => [match[1] ?? '', (match[2] ?? '').trim()]));
}

const cyber = tokens(ruleBody(skin, ":root[data-theme='cyber']"));
const light = tokens(ruleBody(base, ":root[data-theme='light']"));

const channel = (value: number): number => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
}

function contrast(first: string, second: string): number {
  const [high = 0, low = 0] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

function color(name: string): string {
  const value = cyber.get(name);
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${name} doit être une couleur à six chiffres, trouvé : ${String(value)}`);
  }
  return value;
}

describe('Cyber tokens', () => {
  it('redefines every token the light theme redefines', () => {
    // A token left out falls back to the dark theme's value: an orange fill on a yellow skin.
    expect([...light.keys()].filter((name) => !cyber.has(name))).toEqual([]);
  });

  it.each([
    ['--text-1', '--surface-0', 4.5],
    ['--text-2', '--surface-0', 4.5],
    ['--text-2', '--surface-1', 4.5],
    ['--text-2', '--surface-2', 4.5],
    ['--text-2', '--accent-soft', 4.5],
    ['--accent-ink', '--surface-0', 4.5],
    ['--accent-ink', '--surface-2', 4.5],
    ['--accent-on-fill', '--accent-fill', 4.5],
    ['--danger-ink', '--surface-1', 4.5],
    ['--accent-data', '--surface-1', 3],
    ['--axis', '--surface-1', 3],
  ])('%s on %s reaches %s:1', (foreground, background, minimum) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(minimum);
  });
});

describe('Cyber font', () => {
  it('ships the four weights the app uses', () => {
    for (const weight of [400, 500, 600, 700]) {
      expect(existsSync(`src/assets/fonts/cyber/cyber-${weight}.woff2`)).toBe(true);
      expect(skin).toContain(`cyber-${weight}.woff2`);
    }
  });

  it('keeps its licence next to the derived files', () => {
    expect(existsSync('licenses/rajdhani/LICENSE')).toBe(true);
    expect(existsSync('licenses/rajdhani/ATTRIBUTION.md')).toBe(true);
  });

  it('precaches the fonts, or the first offline start would run without them', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/globPatterns:\s*\[[^\]]*woff2/);
  });

  it('is imported by index.css', () => {
    expect(base).toContain("@import './styles/cyber.css';");
  });
});

describe('Cyber translucent plates', () => {
  type Rgb = [number, number, number];
  const over = (top: Rgb, alpha: number, under: Rgb): Rgb =>
    top.map((channel, index) => channel * alpha + (under[index] ?? 0) * (1 - alpha)) as Rgb;
  const hex = ([r, g, b]: Rgb) =>
    `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

  it('keep the secondary text above 4.5:1 over the brightest thing that can sit under them', () => {
    const plate = /--cyber-plate:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/.exec(skin);
    if (plate === null) throw new Error('--cyber-plate introuvable');
    const [, r, g, b, a] = plate.map(Number) as [number, number, number, number, number];
    // Pire cas : le halo rouge du fond (16 %), puis un trait du filigrane (42 %), puis la plaque.
    const page: Rgb = [11, 12, 18];
    const halo = over([255, 60, 70], 0.16, page);
    const stroke = over([255, 107, 99], 0.42, halo);
    const under = over([r, g, b], a, stroke);

    expect(contrast(color('--text-2'), hex(under))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('--text-1'), hex(under))).toBeGreaterThanOrEqual(7);
  });
});
