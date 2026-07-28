import { describe, expect, it } from 'vitest';
import { PERIOD_KEYS, periodBounds } from './periods';

/** Lundi 27 juillet 2026, 14 h locale. */
const monday = new Date(2026, 6, 27, 14, 0, 0).getTime();
/** Dimanche 2 août 2026, 23 h locale — la fin de cette même semaine. */
const sunday = new Date(2026, 7, 2, 23, 0, 0).getTime();

const day = (at: number | undefined): string =>
  at === undefined ? 'toute' : new Date(at).toLocaleDateString('fr-FR');

describe('periodBounds', () => {
  it('borne les quatre périodes finies sur un début de semaine locale', () => {
    for (const key of PERIOD_KEYS) {
      if (key === 'all') continue;
      const { from } = periodBounds(key, monday);
      expect(from).toBeDefined();
      // 1 = lundi, en JS.
      expect(new Date(from!).getDay()).toBe(1);
      expect(new Date(from!).getHours()).toBe(0);
    }
  });

  it('compte les semaines demandées, la semaine courante comprise', () => {
    // 4 semaines depuis le lundi 27 juillet : 6, 13, 20, 27 juillet.
    expect(day(periodBounds('4w', monday).from)).toBe('06/07/2026');
    expect(day(periodBounds('12w', monday).from)).toBe('11/05/2026');
  });

  it('ne dépend pas du jour où on ouvre l’écran', () => {
    // Le même début de semaine, qu’on regarde lundi à 14 h ou dimanche à 23 h.
    expect(periodBounds('4w', monday).from).toBe(periodBounds('4w', sunday).from);
    expect(periodBounds('4w', monday).to).toBe(periodBounds('4w', sunday).to);
  });

  it('termine après la semaine courante, pas à l’instant présent', () => {
    const { to } = periodBounds('4w', monday);
    expect(to).toBeGreaterThan(sunday);
    expect(new Date(to).getDay()).toBe(1);
  });

  it('laisse « tout » sans borne basse plutôt que d’inventer une date', () => {
    expect(periodBounds('all', monday).from).toBeUndefined();
  });
});
