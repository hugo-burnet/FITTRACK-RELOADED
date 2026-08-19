import { describe, expect, it } from 'vitest';
import { restBonusSecondsFor } from './restBonus';

describe('restBonusSecondsFor', () => {
  it('ne donne rien à une série qui est passée toute seule', () => {
    expect(restBonusSecondsFor(6)).toBe(0);
    expect(restBonusSecondsFor(7)).toBe(0);
  });

  it('donne un quart de minute à une série qui a coûté', () => {
    expect(restBonusSecondsFor(7.5)).toBe(15);
    expect(restBonusSecondsFor(8.5)).toBe(15);
  });

  it('donne une demi-minute à une série dure', () => {
    expect(restBonusSecondsFor(9)).toBe(30);
    expect(restBonusSecondsFor(9.5)).toBe(30);
  });

  it('donne trois quarts de minute à une série à la limite', () => {
    expect(restBonusSecondsFor(10)).toBe(45);
  });

  it('ne donne rien sans réponse', () => {
    expect(restBonusSecondsFor(undefined)).toBe(0);
    expect(restBonusSecondsFor(Number.NaN)).toBe(0);
  });
});
