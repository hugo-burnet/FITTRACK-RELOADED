import { describe, expect, it } from 'vitest';
import { decodeFrame, DECODE_GLYPHS } from './decode';

describe('decodeFrame', () => {
  it('shows only noise at the start, in the same length', () => {
    const frame = decodeFrame('Accueil', 0, () => 0);
    expect(frame).toHaveLength('Accueil'.length);
    expect(frame).toBe(DECODE_GLYPHS[0]!.repeat(7));
  });

  it('reveals the title from the left as it progresses', () => {
    expect(decodeFrame('Accueil', 3 / 7, () => 0).startsWith('Acc')).toBe(true);
    expect(decodeFrame('Accueil', 1, () => 0)).toBe('Accueil');
  });

  it('never scrambles spaces and separators, so the shape of the title holds', () => {
    expect(decodeFrame('5×5 — A', 0, () => 0)).toBe(`${DECODE_GLYPHS[0]}×${DECODE_GLYPHS[0]} — ${DECODE_GLYPHS[0]}`);
  });
});
