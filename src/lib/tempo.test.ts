import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REP_SECONDS,
  MAX_REP_SECONDS,
  MIN_REP_SECONDS,
  clampRepSeconds,
  normalizeRepSeconds,
  resolveRepSeconds,
  stepRepSeconds,
} from './tempo';

describe('clampRepSeconds', () => {
  it('cale la valeur sur le quart de seconde', () => {
    expect(clampRepSeconds(3.1)).toBe(3);
    expect(clampRepSeconds(3.2)).toBe(3.25);
  });

  it('reste entre le plancher et le plafond', () => {
    expect(clampRepSeconds(0.2)).toBe(MIN_REP_SECONDS);
    expect(clampRepSeconds(42)).toBe(MAX_REP_SECONDS);
  });

  it('répond le tempo par défaut à ce qui n’est pas un nombre utilisable', () => {
    expect(clampRepSeconds(Number.NaN)).toBe(DEFAULT_REP_SECONDS);
  });
});

describe('stepRepSeconds', () => {
  it('avance et recule d’un quart de seconde', () => {
    expect(stepRepSeconds(3, 1)).toBe(3.25);
    expect(stepRepSeconds(3, -1)).toBe(2.75);
  });

  it('ne franchit pas les bornes', () => {
    expect(stepRepSeconds(MIN_REP_SECONDS, -1)).toBe(MIN_REP_SECONDS);
    expect(stepRepSeconds(MAX_REP_SECONDS, 1)).toBe(MAX_REP_SECONDS);
  });
});

describe('normalizeRepSeconds', () => {
  it('refuse ce qui n’est pas un tempo', () => {
    expect(normalizeRepSeconds(undefined)).toBeUndefined();
    expect(normalizeRepSeconds('3')).toBeUndefined();
    expect(normalizeRepSeconds(0)).toBeUndefined();
    expect(normalizeRepSeconds(60)).toBeUndefined();
  });

  it('accepte un tempo en le calant sur la grille', () => {
    expect(normalizeRepSeconds(3.4)).toBe(3.5);
  });
});

describe('resolveRepSeconds', () => {
  it('prend la source la plus précise qui ait une valeur', () => {
    expect(resolveRepSeconds(4, 2)).toBe(4);
    expect(resolveRepSeconds(undefined, 2)).toBe(2);
  });

  it('retombe sur trois secondes quand personne ne dit rien', () => {
    expect(resolveRepSeconds(undefined, undefined)).toBe(DEFAULT_REP_SECONDS);
  });
});
