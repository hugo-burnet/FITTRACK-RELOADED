import { describe, expect, it } from 'vitest';
import type { CoachSignal } from '@/lib/coach';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';
import { coachSignalMessage } from './coachCopy';

function rangeCeiling(
  currentKg: number | undefined,
  nextKg: number,
  code: 'range_ceiling_reached' | 'range_completed' = 'range_ceiling_reached',
  extraEvidence: { label: string; value: number }[] = [],
): CoachSignal {
  return {
    exerciseId: 'bench',
    code,
    severity: 40,
    nextLoadKg: nextKg,
    evidence: [
      { label: 'working_sets', value: 3 },
      { label: 'target_reps_max', value: 12 },
      ...(currentKg === undefined ? [] : [{ label: 'current_load_kg', value: currentKg }]),
      { label: 'next_load_kg', value: nextKg },
      ...extraEvidence,
    ],
  };
}

describe('coachSignalMessage — range ceiling', () => {
  it('reads as a step between two loads, never as a bare plus sign', () => {
    const message = coachSignalMessage(rangeCeiling(47.5, 50));
    expect(message).toContain('47,5 → 50 kg');
    // The bug this guards: `+50 kg` to mean "go up to 50", which reads as
    // "add fifty kilos".
    expect(message).not.toContain('+');
  });

  it('keeps the arrow when assistance goes down', () => {
    const message = coachSignalMessage(rangeCeiling(50, 45));
    expect(message).toContain('Assistance 50 → 45 kg');
  });

  it('falls back to the target alone when the current load is unknown', () => {
    const message = coachSignalMessage(rangeCeiling(undefined, 50));
    expect(message).toContain('50 kg');
    expect(message).not.toContain('→');
  });

  it('reads a stored range_completed journal row with the same ceiling copy', () => {
    const message = coachSignalMessage(rangeCeiling(47.5, 50, 'range_completed'));
    expect(message).toContain('47,5 → 50 kg');
    expect(message).toContain('haut de la fourchette');
  });
});

describe('coachSignalMessage — range satisfied', () => {
  it('states the floor was met without claiming a load change', () => {
    const message = coachSignalMessage({
      code: 'range_satisfied',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps', value: 8 },
        { label: 'target_reps_max', value: 12 },
      ],
    });
    expect(message).toContain('Fourchette respectée');
    expect(message).toContain('3 séries');
    expect(message).not.toContain('→');
  });
});

function rangeMissed(currentKg: number, nextKg: number): CoachSignal {
  return {
    exerciseId: 'bench',
    code: 'range_missed',
    severity: 50,
    nextLoadKg: nextKg,
    evidence: [
      { label: 'sessions', value: 2 },
      { label: 'target_reps', value: 8 },
      { label: 'low_reps', value: 6 },
      { label: 'current_load_kg', value: currentKg },
      { label: 'next_load_kg', value: nextKg },
    ],
  };
}

describe('coachSignalMessage — range missed', () => {
  it('says how far down and why, with the numbers that produced it', () => {
    const message = coachSignalMessage(rangeMissed(80, 77.5));
    expect(message).toContain('80 → 77,5 kg');
    expect(message).toContain('bas de fourchette (8)');
    expect(message).toContain('2 séances');
  });

  it('reads as more assistance when the number goes up', () => {
    expect(coachSignalMessage(rangeMissed(40, 45))).toContain('Assistance 40 → 45 kg');
  });

  it('states the miss without inventing a zero when no load is proposed', () => {
    const message = coachSignalMessage({
      code: 'range_missed',
      evidence: [
        { label: 'sessions', value: 2 },
        { label: 'target_reps', value: 12 },
        { label: 'low_reps', value: 11 },
        { label: 'current_load_kg', value: 3.5 },
      ],
    });
    expect(message).toContain('bas de fourchette (12)');
    expect(message).not.toContain('0 kg');
    expect(message).not.toContain('→');
  });
});

describe('coachSignalMessage — phase intention copy', () => {
  it('progression without increase_* reads as deferred maintain', () => {
    // Load proposal stripped by shaping; flag stamped for UI.
    const message = coachSignalMessage({
      code: 'range_ceiling_reached',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps_max', value: 12 },
        { label: 'progression_deferred', value: 1 },
      ],
    });
    expect(message).toBe(t('coach.progressionDeferred'));
    expect(message).toBe('Maintien — progression différée');
    expect(message).not.toContain('→');
  });

  it('shaped ceiling without next load is constat-only — no arrow, no 0 kg', () => {
    // Overload / return / plateau+construction: nextLoadKg stripped, leftover
    // current_load_kg must not invent « 100 → 0 kg ».
    const message = coachSignalMessage({
      code: 'range_ceiling_reached',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps_max', value: 12 },
        { label: 'current_load_kg', value: 100 },
      ],
    });
    expect(message).toBe(t('coach.range_ceiling_reached_constat', { sets: 3, reps: 12 }));
    expect(message).toContain('3 × 12');
    expect(message).toContain('haut de la fourchette');
    expect(message).not.toContain('→');
    expect(message).not.toContain('0 kg');
  });

  it('does not let progression_deferred erase plateau prose', () => {
    const message = coachSignalMessage({
      code: 'plateau',
      evidence: [
        { label: 'sessions', value: 3 },
        { label: 'best_1rm_kg', value: 116.7 },
        { label: 'progression_deferred', value: 1 },
      ],
    });
    expect(message).toBe(
      t('coach.plateau', { sessions: 3, value: formatNumber(116.7) }),
    );
    expect(message).toContain('Plateau détecté');
    expect(message).not.toBe(t('coach.progressionDeferred'));
  });

  it('overload add_set reads as a volume constat, not a stripped ceiling', () => {
    const message = coachSignalMessage({
      code: 'range_ceiling_reached',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps_max', value: 12 },
        { label: 'add_set', value: 1 },
      ],
    });
    expect(message).toBe(t('coach.addSet', { sets: 3, reps: 12 }));
    expect(message).toContain('Ajouter une série');
    expect(message).not.toContain('→');
    expect(message).not.toContain('0 kg');
  });

  it('test + authorized increase_load keeps the step and marks a controlled attempt', () => {
    const signal = rangeCeiling(47.5, 50, 'range_ceiling_reached', [
      { label: 'controlled_attempt', value: 1 },
    ]);
    const message = coachSignalMessage(signal);
    expect(message).toContain('Tentative contrôlée');
    expect(message).toContain('47,5 → 50 kg');
    expect(message).toContain('haut de la fourchette');
    // Same nextLoadKg the card figure will show — copy must not invent another.
    expect(signal.nextLoadKg).toBe(50);
  });

  it('test + authorized increase_reps marks a controlled attempt on the satisfied constat', () => {
    const message = coachSignalMessage({
      code: 'range_satisfied',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps', value: 8 },
        { label: 'target_reps_max', value: 12 },
        { label: 'controlled_attempt', value: 1 },
      ],
    });
    expect(message).toContain('Tentative contrôlée');
    expect(message).toContain('Fourchette respectée');
  });
});

describe('coachSignalMessage — notes du coach v2', () => {
  it('signale la marge d’une série à l’échec sans toucher au constat', () => {
    const plain = coachSignalMessage(rangeCeiling(10, 12.5));
    const withMargin = coachSignalMessage(
      rangeCeiling(10, 12.5, 'range_ceiling_reached', [{ label: 'failure_reps_over_ceiling', value: 3 }]),
    );
    expect(withMargin.startsWith(plain)).toBe(true);
    expect(withMargin).toContain(t('coach.failureMargin', { reps: 3 }));
  });

  it('dit pourquoi aucune série n’est proposée : le plus que la personne a tenu, avec ce qui a été lu', () => {
    const plain = coachSignalMessage(rangeCeiling(100, 102.5));
    const capped = coachSignalMessage(
      rangeCeiling(100, 102.5, 'range_ceiling_reached', [
        { label: 'volume_at_ceiling', value: 1 },
        { label: 'weekly_sets', value: 12 },
        { label: 'weekly_ceiling', value: 10 },
      ]),
    );

    expect(capped).toBe(`${plain} ${t('coach.volumeAtCeiling', { sets: 12, ceiling: 10 })}`);
    expect(capped).toContain('12 séries sur sept jours');
    expect(capped).toContain('le plus que tu aies tenu');
  });

  it('dit que le plafond est le sien quand c’est la personne qui l’a posé', () => {
    const message = coachSignalMessage(
      rangeCeiling(100, 102.5, 'range_ceiling_reached', [
        { label: 'volume_at_ceiling', value: 1 },
        { label: 'weekly_sets', value: 12 },
        { label: 'weekly_ceiling', value: 10 },
        { label: 'ceiling_set', value: 1 },
      ]),
    );

    expect(message).toContain(t('coach.volumeAtCeilingSet', { sets: 12, ceiling: 10 }));
    expect(message).toContain('ton plafond');
    expect(message).not.toContain('le plus que tu aies tenu');
  });

  it('ne parle pas de volume sans la preuve : les chiffres seuls ne suffisent pas', () => {
    const message = coachSignalMessage(
      rangeCeiling(100, 102.5, 'range_ceiling_reached', [
        { label: 'weekly_sets', value: 12 },
        { label: 'weekly_ceiling', value: 10 },
      ]),
    );

    expect(message).toBe(coachSignalMessage(rangeCeiling(100, 102.5)));
  });

  it('n’ajoute rien quand aucune de ces preuves n’est là', () => {
    expect(coachSignalMessage(rangeCeiling(47.5, 50))).toBe(
      t('coach.range_ceiling_reached', { current: '47,5', weight: '50', sets: 3, reps: 12 }),
    );
  });
});

describe('coachSignalMessage — effort (R1)', () => {
  it('raconte une consolidation avec la charge et les deux RPE', () => {
    const message = coachSignalMessage({
      code: 'consolidating',
      evidence: [
        { label: 'current_load_kg', value: 70 },
        { label: 'rpe_before', value: 9 },
        { label: 'rpe_after', value: 8.5 },
      ],
    });
    expect(message).toBe(t('coach.consolidating', { weight: '70', before: '9', after: '8,5' }));
    // Une observation ne porte pas de flèche : « → » veut dire « fais ça ».
    expect(message).not.toContain('→');
  });

  it('dit pourquoi un plafond arraché ne fait pas monter', () => {
    const message = coachSignalMessage({
      code: 'range_ceiling_reached',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps_max', value: 12 },
        { label: 'ceiling_grinding', value: 1 },
        { label: 'session_rpe', value: 9.8 },
        { label: 'current_load_kg', value: 100 },
      ],
    });
    expect(message).toBe(t('coach.ceilingGrinding', { sets: 3, reps: 12, rpe: '9,8' }));
  });

  it('ajoute au plateau à l’échec la piste de la décharge', () => {
    const plateau: CoachSignal = {
      exerciseId: 'fly',
      code: 'plateau',
      severity: 30,
      evidence: [
        { label: 'sessions', value: 3 },
        { label: 'best_1rm_kg', value: 14 },
      ],
    };
    const plain = coachSignalMessage(plateau);
    const atFailure = coachSignalMessage({
      ...plateau,
      evidence: [...plateau.evidence, { label: 'at_failure', value: 1 }],
    });
    expect(atFailure).toBe(`${plain} ${t('coach.plateauAtFailure')}`);
  });
});

describe('coachSignalMessage — reprise (R5)', () => {
  it('dit depuis combien de jours, et pourquoi on ne monte pas', () => {
    const message = coachSignalMessage({
      code: 'returning',
      evidence: [{ label: 'gap_days', value: 21 }],
    });
    expect(message).toBe(t('coach.returning', { days: 21 }));
  });
});

describe('coachSignalMessage — cran à absorber (R3.2)', () => {
  it('dit combien de répétitions viser avant le cran, et ce qu’il pèse', () => {
    const message = coachSignalMessage({
      code: 'range_ceiling_reached',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps_max', value: 12 },
        { label: 'current_load_kg', value: 10 },
        { label: 'step_needs_reps', value: 18 },
        { label: 'next_step_kg', value: 12 },
        { label: 'target_reps', value: 10 },
      ],
    });
    expect(message).toBe(
      t('coach.stepNeedsReps', {
        sets: 3,
        reps: 12,
        weight: '12',
        percent: 20,
        needed: 18,
        current: '10',
        floor: 10,
      }),
    );
    // Une consigne de répétitions, pas de charge : pas de flèche.
    expect(message).not.toContain('→');
  });
});

describe('coachSignalMessage — benchmark', () => {
  const calibrated = (range: [number, number]): CoachSignal => ({
    exerciseId: 'bench',
    code: 'benchmark_calibrated',
    severity: 36,
    nextLoadKg: 77.5,
    evidence: [
      { label: 'tested_load_kg', value: 80 },
      { label: 'tested_reps', value: 9 },
      { label: 'one_rep_max_kg', value: 104 },
      { label: 'target_reps', value: range[0] },
      { label: 'target_reps_max', value: range[1] },
      { label: 'reference_reps', value: range[0] + 2 },
    ],
  });

  it('dit ce qui a été mesuré, et la charge pour la fourchette de l’exercice', () => {
    expect(coachSignalMessage(calibrated([8, 12]))).toBe(
      'Benchmark : 9 répétitions à 80 kg, soit un max d’environ 104 kg. Pour ta fourchette (8 – 12 reps), démarre à 77,5 kg.',
    );
  });

  it('écrit une cible unique comme telle, et une fourchette haute sans la tronquer', () => {
    expect(coachSignalMessage(calibrated([20, 20]))).toContain('ta fourchette (20 reps)');
    expect(coachSignalMessage(calibrated([15, 20]))).toContain('ta fourchette (15 – 20 reps)');
  });
});
