import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const skin = readFileSync('src/styles/tty1.css', 'utf8');
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

const tty1 = tokens(ruleBody(skin, ":root[data-theme='tty1']"));
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
  const value = tty1.get(name);
  if (value === undefined || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${name} doit être une couleur à six chiffres, trouvé : ${String(value)}`);
  }
  return value;
}

describe('TTY1 tokens', () => {
  it('redefines every token the light theme redefines', () => {
    // A token left out would not fail anywhere visible: it falls back to the dark
    // theme's value — an orange fill in a green screen.
    expect([...light.keys()].filter((name) => !tty1.has(name))).toEqual([]);
  });

  it.each([
    ['--text-1', '--surface-0', 4.5],
    ['--text-2', '--surface-0', 4.5],
    ['--text-2', '--surface-2', 4.5],
    ['--text-2', '--accent-soft', 4.5],
    ['--accent-ink', '--surface-0', 4.5],
    ['--accent-on-fill', '--accent-fill', 4.5],
    ['--danger-ink', '--surface-0', 4.5],
    ['--accent-data', '--surface-0', 3],
    ['--axis', '--surface-0', 3],
  ])('%s on %s reaches %s:1', (foreground, background, minimum) => {
    expect(contrast(color(foreground), color(background))).toBeGreaterThanOrEqual(minimum);
  });

  it('keeps the page and its windows on the same black', () => {
    expect(color('--surface-1')).toBe(color('--surface-0'));
  });
});
