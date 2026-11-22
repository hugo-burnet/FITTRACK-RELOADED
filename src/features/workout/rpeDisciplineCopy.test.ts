import { describe, expect, it } from 'vitest';
import { rpeDisciplineTraceLines } from './rpeDisciplineCopy';

describe('rpeDisciplineTraceLines', () => {
  it('relit chaque événement, avec les deux valeurs d’une correction', () => {
    const lines = rpeDisciplineTraceLines(
      [
        { kind: 'triggered', at: 1, setId: 's', rpe: 9, ceiling: 8 },
        { kind: 'corrected', at: 2, setId: 's', previousRpe: 9, rpe: 7.5, ceiling: 8 },
        { kind: 'corrected', at: 3, setId: 's', previousRpe: 7.5, ceiling: 8 },
        { kind: 'override', at: 4, setId: 's', ceiling: 8 },
      ],
      (at) => `T${at}`,
    );
    expect(lines).toEqual([
      'T1 — dépassement : RPE 9 pour un plafond de 8',
      'T2 — correction : RPE 9 → 7,5',
      'T3 — correction : RPE 7,5 → aucun',
      'T4 — déverrouillage exceptionnel',
    ]);
  });

  it('ne rend rien sans journal', () => {
    expect(rpeDisciplineTraceLines(undefined)).toEqual([]);
  });
});
