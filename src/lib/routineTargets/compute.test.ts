import { describe, expect, it } from 'vitest';
import { computeRoutineUpdates } from './compute';
import type {
  PerformedSessionInput,
  PerformedSetInput,
  RoutineTargetLineInput,
  RoutineTargetSetInput,
  RoutineUpdateInput,
} from './types';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 8, 15, 10);

function plannedSet(
  partial: Partial<RoutineTargetSetInput> & Pick<RoutineTargetSetInput, 'id' | 'order'>,
): RoutineTargetSetInput {
  return {
    setType: 'normal',
    targetReps: 8,
    targetRepsMax: 12,
    targetWeight: 57.5,
    ...partial,
  };
}

function routineLine(
  partial: Partial<RoutineTargetLineInput> & Pick<RoutineTargetLineInput, 'exerciseId'>,
): RoutineTargetLineInput {
  return {
    routineExerciseId: `re-${partial.exerciseId}`,
    order: 0,
    exerciseName: 'Rowing à la poulie',
    measurementType: 'weight_reps',
    equipment: 'cable',
    sets: [
      plannedSet({ id: 's1', order: 0 }),
      plannedSet({ id: 's2', order: 1 }),
      plannedSet({ id: 's3', order: 2 }),
    ],
    ...partial,
  };
}

function performedSet(
  partial: Partial<PerformedSetInput> & Pick<PerformedSetInput, 'order'>,
): PerformedSetInput {
  return { setType: 'normal', weight: 57.5, reps: 12, ...partial };
}

function session(
  partial: Partial<PerformedSessionInput> & Pick<PerformedSessionInput, 'workoutId' | 'sets'>,
): PerformedSessionInput {
  return {
    workoutExerciseId: `we-${partial.workoutId}`,
    exerciseId: 'row',
    performedAt: t0,
    measurementType: 'weight_reps',
    fromRoutineId: 'r1',
    ...partial,
  };
}

/** Trois séries de travail identiques — la forme écrasante d'une séance réelle. */
function threeWorkingSets(partial: Partial<PerformedSetInput> = {}): PerformedSetInput[] {
  return [0, 1, 2].map((order) => performedSet({ order, ...partial }));
}

function input(partial: Partial<RoutineUpdateInput> = {}): RoutineUpdateInput {
  return {
    routineId: 'r1',
    lines: [routineLine({ exerciseId: 'row' })],
    sessions: [],
    ...partial,
  };
}

const reasonOf = (
  review: ReturnType<typeof computeRoutineUpdates>,
  routineExerciseId = 're-row',
): string | undefined =>
  review.unchanged.find((line) => line.routineExerciseId === routineExerciseId)?.reason;

// ---------------------------------------------------------------------------
// Règle 3 — la hausse de charge, et ce qui l'interdit
// ---------------------------------------------------------------------------

describe('computeRoutineUpdates — hausse de charge', () => {
  it('propose un pas de plus quand la fourchette est tenue sur toutes les séries', () => {
    const review = computeRoutineUpdates(
      input({ sessions: [session({ workoutId: 'w1', sets: threeWorkingSets() })] }),
    );

    expect(review.proposals).toHaveLength(1);
    expect(review.proposals[0]).toMatchObject({
      kind: 'increase_weight',
      currentWeight: 57.5,
      performedWeight: 57.5,
      performedReps: 12,
      proposedWeight: 60,
      incrementKg: 2.5,
      deltaKg: 2.5,
    });
    expect(review.proposals[0]?.targetSetIds).toEqual(['s1', 's2', 's3']);
  });

  it("ne propose aucune hausse si une série de la référence porte un RPE supérieur à 8", () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({
            workoutId: 'w1',
            sets: [
              performedSet({ order: 0, rpe: 7 }),
              performedSet({ order: 1, rpe: 8 }),
              performedSet({ order: 2, rpe: 9.5 }),
            ],
          }),
        ],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review)).toBe('effort_too_high');
  });

  it('propose la hausse quand le RPE est noté et reste à 8', () => {
    const review = computeRoutineUpdates(
      input({ sessions: [session({ workoutId: 'w1', sets: threeWorkingSets({ rpe: 8 }) })] }),
    );

    expect(review.proposals[0]).toMatchObject({ kind: 'increase_weight', proposedWeight: 60 });
    expect(review.proposals[0]?.reference.maxRpe).toBe(8);
  });

  it("ne bloque pas la hausse quand aucun RPE n'a été noté", () => {
    const review = computeRoutineUpdates(
      input({ sessions: [session({ workoutId: 'w1', sets: threeWorkingSets() })] }),
    );

    expect(review.proposals[0]?.kind).toBe('increase_weight');
    expect(review.proposals[0]?.reference.maxRpe).toBeUndefined();
  });

  it("ne propose rien si une série de travail reste sous targetRepsMax", () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({
            workoutId: 'w1',
            sets: [
              performedSet({ order: 0, reps: 12 }),
              performedSet({ order: 1, reps: 12 }),
              performedSet({ order: 2, reps: 10 }),
            ],
          }),
        ],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review)).toBe('range_not_completed');
  });

  it("ne propose rien si la référence compte moins de séries de travail que la routine", () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({
            workoutId: 'w1',
            sets: [performedSet({ order: 0 }), performedSet({ order: 1 })],
          }),
        ],
      }),
    );

    expect(reasonOf(review)).toBe('range_not_completed');
  });

  it('exclut les séries d’échauffement du calcul', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({
            workoutId: 'w1',
            sets: [
              // Une montée en charge légère, à 5 reps : comptée, elle ferait
              // échouer la fourchette et manquerait une série de travail.
              performedSet({ order: 0, setType: 'warmup', weight: 20, reps: 5 }),
              performedSet({ order: 1, setType: 'warmup', weight: 40, reps: 5 }),
              performedSet({ order: 2 }),
              performedSet({ order: 3 }),
              performedSet({ order: 4 }),
            ],
          }),
        ],
      }),
    );

    expect(review.proposals[0]).toMatchObject({ kind: 'increase_weight', performedWeight: 57.5 });
    expect(review.proposals[0]?.reference.workingSetCount).toBe(3);
  });

  it('respecte le pas des haltères', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [
          routineLine({
            exerciseId: 'row',
            equipment: 'dumbbell',
            sets: [plannedSet({ id: 's1', order: 0, targetWeight: 22 })],
          }),
        ],
        sessions: [session({ workoutId: 'w1', sets: [performedSet({ order: 0, weight: 22 })] })],
      }),
    );

    expect(review.proposals[0]).toMatchObject({ proposedWeight: 24, incrementKg: 2 });
  });

  it('préfère le pas déclaré sur l’exercice à celui de l’équipement', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [
          routineLine({
            exerciseId: 'row',
            equipment: 'machine',
            loadIncrementKg: 1.25,
            sets: [plannedSet({ id: 's1', order: 0, targetWeight: 40 })],
          }),
        ],
        sessions: [session({ workoutId: 'w1', sets: [performedSet({ order: 0, weight: 40 })] })],
      }),
    );

    expect(review.proposals[0]).toMatchObject({ proposedWeight: 41.25, incrementKg: 1.25 });
  });

  it('décale toute la pyramide du même pas, sans l’aplatir', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [
          routineLine({
            exerciseId: 'row',
            sets: [
              plannedSet({ id: 's1', order: 0, targetWeight: 50 }),
              plannedSet({ id: 's2', order: 1, targetWeight: 55 }),
              plannedSet({ id: 's3', order: 2, targetWeight: 60 }),
            ],
          }),
        ],
        sessions: [
          session({
            workoutId: 'w1',
            sets: [
              performedSet({ order: 0, weight: 50 }),
              performedSet({ order: 1, weight: 55 }),
              performedSet({ order: 2, weight: 60 }),
            ],
          }),
        ],
      }),
    );

    // La cible de la ligne est sa série la plus dure ; le pas s'applique à toutes.
    expect(review.proposals[0]).toMatchObject({
      currentWeight: 60,
      proposedWeight: 62.5,
      deltaKg: 2.5,
    });
  });
});

// ---------------------------------------------------------------------------
// Règles 1 et 4 — l'alignement, et la baisse qui n'arrive jamais
// ---------------------------------------------------------------------------

describe('computeRoutineUpdates — alignement et sens unique', () => {
  it('propose d’aligner la cible sur une charge réalisée plus lourde', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [session({ workoutId: 'w1', sets: threeWorkingSets({ weight: 70 }) })],
      }),
    );

    expect(review.proposals[0]).toMatchObject({
      kind: 'align_weight',
      currentWeight: 57.5,
      performedWeight: 70,
      proposedWeight: 70,
      deltaKg: 12.5,
    });
    // Aligner, et pas aligner puis incrémenter : rien au-dessus du soulevé.
    expect(review.proposals[0]?.incrementKg).toBeUndefined();
  });

  it('ne propose jamais de baisse quand le réalisé est sous la cible', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [session({ workoutId: 'w1', sets: threeWorkingSets({ weight: 45 }) })],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review)).toBe('below_target');
  });

  it('ne propose jamais de baisse, même si la fourchette est tenue à la charge légère', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w1', sets: threeWorkingSets({ weight: 45, reps: 12, rpe: 6 }) }),
        ],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review)).toBe('below_target');
  });

  it('écrit la charge réalisée sur une ligne qui n’en portait aucune', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [
          routineLine({
            exerciseId: 'row',
            sets: [plannedSet({ id: 's1', order: 0, targetWeight: undefined })],
          }),
        ],
        sessions: [session({ workoutId: 'w1', sets: [performedSet({ order: 0, weight: 62.5 })] })],
      }),
    );

    expect(review.proposals[0]).toMatchObject({
      kind: 'align_weight',
      proposedWeight: 62.5,
      currentWeight: undefined,
      deltaKg: undefined,
    });
  });

  it('lit l’assistance à l’envers : moins d’aide est une hausse', () => {
    const line = routineLine({
      exerciseId: 'pullup',
      exerciseName: 'Traction assistée',
      measurementType: 'assisted_weight_reps',
      equipment: 'machine',
      sets: [plannedSet({ id: 's1', order: 0, targetWeight: 30 })],
    });

    const lighter = computeRoutineUpdates(
      input({
        lines: [line],
        sessions: [
          session({
            workoutId: 'w1',
            exerciseId: 'pullup',
            measurementType: 'assisted_weight_reps',
            sets: [performedSet({ order: 0, weight: 25, reps: 12 })],
          }),
        ],
      }),
    );
    // 25 kg d'assistance pour 30 prescrits : plus dur, donc un alignement.
    expect(lighter.proposals[0]).toMatchObject({ kind: 'align_weight', proposedWeight: 25 });

    const heavier = computeRoutineUpdates(
      input({
        lines: [line],
        sessions: [
          session({
            workoutId: 'w1',
            exerciseId: 'pullup',
            measurementType: 'assisted_weight_reps',
            sets: [performedSet({ order: 0, weight: 35, reps: 12 })],
          }),
        ],
      }),
    );
    expect(heavier.proposals).toEqual([]);
    expect(reasonOf(heavier, 're-pullup')).toBe('below_target');

    const equal = computeRoutineUpdates(
      input({
        lines: [line],
        sessions: [
          session({
            workoutId: 'w1',
            exerciseId: 'pullup',
            measurementType: 'assisted_weight_reps',
            sets: [performedSet({ order: 0, weight: 30, reps: 12 })],
          }),
        ],
      }),
    );
    // Une hausse retire de l'assistance : 30 → 25 sur un pas machine de 5 kg.
    expect(equal.proposals[0]).toMatchObject({ kind: 'increase_weight', proposedWeight: 25 });
  });
});

// ---------------------------------------------------------------------------
// Règle 2 — la meilleure des trois dernières, pas la dernière seule
// ---------------------------------------------------------------------------

describe('computeRoutineUpdates — séance de référence', () => {
  it('retient la meilleure des trois dernières séances, pas la plus récente', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({
            workoutId: 'w3',
            performedAt: t0,
            sets: threeWorkingSets({ weight: 60 }),
          }),
          session({
            workoutId: 'w2',
            performedAt: t0 - DAY,
            sets: threeWorkingSets({ weight: 70 }),
          }),
          session({
            workoutId: 'w1',
            performedAt: t0 - 2 * DAY,
            sets: threeWorkingSets({ weight: 65 }),
          }),
        ],
      }),
    );

    expect(review.proposals[0]).toMatchObject({ performedWeight: 70 });
    expect(review.proposals[0]?.reference.workoutId).toBe('w2');
  });

  it('ne regarde pas au-delà des trois dernières séances', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w4', performedAt: t0, sets: threeWorkingSets({ weight: 60 }) }),
          session({
            workoutId: 'w3',
            performedAt: t0 - DAY,
            sets: threeWorkingSets({ weight: 60 }),
          }),
          session({
            workoutId: 'w2',
            performedAt: t0 - 2 * DAY,
            sets: threeWorkingSets({ weight: 60 }),
          }),
          // La séance à 80 kg est la quatrième : hors fenêtre.
          session({
            workoutId: 'w1',
            performedAt: t0 - 3 * DAY,
            sets: threeWorkingSets({ weight: 80 }),
          }),
        ],
      }),
    );

    // 60 kg pour 57,5 prescrits : c'est un alignement. Ce que la fenêtre
    // décide ici, c'est qu'elle s'arrête à 60 et non à 80.
    expect(review.proposals[0]).toMatchObject({
      kind: 'align_weight',
      performedWeight: 60,
      proposedWeight: 60,
    });
  });

  it('départage deux séances de même charge par la plus récente', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w2', performedAt: t0, sets: threeWorkingSets() }),
          session({ workoutId: 'w1', performedAt: t0 - DAY, sets: threeWorkingSets() }),
        ],
      }),
    );

    expect(review.proposals[0]?.reference.workoutId).toBe('w2');
  });

  it("écarte un bloc dont la mesure a changé depuis", () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w1', measurementType: 'reps_only', sets: threeWorkingSets() }),
        ],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review)).toBe('no_history');
  });

  it('ignore un exercice sans historique', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [routineLine({ exerciseId: 'row' }), routineLine({ exerciseId: 'curl' })],
        sessions: [session({ workoutId: 'w1', sets: threeWorkingSets() })],
      }),
    );

    expect(review.proposals).toHaveLength(1);
    expect(review.proposals[0]?.exerciseId).toBe('row');
    expect(reasonOf(review, 're-curl')).toBe('no_history');
  });

  it('ignore une mesure sans charge', () => {
    const review = computeRoutineUpdates(
      input({
        lines: [
          routineLine({
            exerciseId: 'plank',
            measurementType: 'time_only',
            sets: [plannedSet({ id: 's1', order: 0, targetWeight: undefined })],
          }),
        ],
        sessions: [
          session({
            workoutId: 'w1',
            exerciseId: 'plank',
            measurementType: 'time_only',
            sets: [performedSet({ order: 0, weight: undefined, reps: undefined })],
          }),
        ],
      }),
    );

    expect(review.proposals).toEqual([]);
    expect(reasonOf(review, 're-plank')).toBe('no_weight_target');
  });
});

// ---------------------------------------------------------------------------
// Règle 6 — l'exercice fait hors routine
// ---------------------------------------------------------------------------

describe('computeRoutineUpdates — exercices hors routine', () => {
  it('liste à part un exercice réalisé dans les séances de la routine', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w1', sets: threeWorkingSets() }),
          session({
            workoutId: 'w1',
            workoutExerciseId: 'we-face-pull',
            exerciseId: 'face-pull',
            exerciseName: 'Face pull',
            sets: [
              performedSet({ order: 0, setType: 'warmup', weight: 10 }),
              performedSet({ order: 1, weight: 25 }),
              performedSet({ order: 2, weight: 27.5 }),
            ],
          }),
        ],
      }),
    );

    expect(review.missingExercises).toHaveLength(1);
    expect(review.missingExercises[0]).toMatchObject({
      exerciseId: 'face-pull',
      exerciseName: 'Face pull',
      sessionCount: 1,
      workingSetCount: 2,
      bestWeight: 27.5,
    });
    // Signalé, jamais appliqué : rien n'entre dans les propositions.
    expect(review.proposals.every((proposal) => proposal.exerciseId !== 'face-pull')).toBe(true);
  });

  it('ne signale pas un exercice fait dans une séance venue d’ailleurs', () => {
    const review = computeRoutineUpdates(
      input({
        sessions: [
          session({ workoutId: 'w1', sets: threeWorkingSets() }),
          session({
            workoutId: 'w9',
            workoutExerciseId: 'we-curl',
            exerciseId: 'curl',
            fromRoutineId: 'autre-routine',
            sets: threeWorkingSets({ weight: 15 }),
          }),
        ],
      }),
    );

    expect(review.missingExercises).toEqual([]);
  });

  it('ne signale pas un exercice que la routine contient déjà', () => {
    const review = computeRoutineUpdates(
      input({ sessions: [session({ workoutId: 'w1', sets: threeWorkingSets() })] }),
    );

    expect(review.missingExercises).toEqual([]);
  });
});

describe('computeRoutineUpdates — absence d’effet de bord', () => {
  it('ne touche ni aux lignes ni aux séances reçues', () => {
    const given = input({ sessions: [session({ workoutId: 'w1', sets: threeWorkingSets() })] });
    const snapshot = structuredClone(given);

    computeRoutineUpdates(given);

    expect(given).toEqual(snapshot);
  });
});
