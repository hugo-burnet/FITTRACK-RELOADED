import { describe, expect, it } from 'vitest';
import { BASE_REP_SECONDS, MAX_REP_SECONDS, repSecondsFor } from './tempo';

const fresh = { workingSetsDone: 0, isLastWorkingSet: false, sessionElapsedMs: 0 };

describe('repSecondsFor', () => {
  it('part du tempo de base sur la première série', () => {
    expect(repSecondsFor(fresh)).toBe(BASE_REP_SECONDS);
  });

  it('allonge un quart de seconde par série déjà faite', () => {
    expect(repSecondsFor({ ...fresh, workingSetsDone: 2 })).toBe(3.5);
  });

  it('plafonne ce que les séries seules peuvent coûter', () => {
    expect(repSecondsFor({ ...fresh, workingSetsDone: 12 })).toBe(4);
  });

  it('donne une demi-seconde de plus sur la dernière série', () => {
    expect(repSecondsFor({ ...fresh, isLastWorkingSet: true })).toBe(3.5);
  });

  it('donne une demi-seconde de plus après trois quarts d’heure', () => {
    expect(repSecondsFor({ ...fresh, sessionElapsedMs: 46 * 60_000 })).toBe(3.5);
  });

  it('cumule les trois, sans jamais dépasser le plafond', () => {
    expect(
      repSecondsFor({
        workingSetsDone: 12,
        isLastWorkingSet: true,
        sessionElapsedMs: 90 * 60_000,
      }),
    ).toBe(MAX_REP_SECONDS);
  });

  it('ignore un compte de séries négatif', () => {
    expect(repSecondsFor({ ...fresh, workingSetsDone: -3 })).toBe(BASE_REP_SECONDS);
  });
});
