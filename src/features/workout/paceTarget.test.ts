import { describe, expect, it } from 'vitest';
import type { SetType, WorkoutSet } from '@/data/types';
import { cadenceFor, prepareFollowingExercisePace, prepareNextPace } from './paceTarget';

const REPS = { kind: 'reps', repSeconds: 3 } as const;
const HOLD = { kind: 'hold' } as const;

function set(
  id: string,
  isCompleted: 0 | 1,
  // `null` et non `undefined` : passer `undefined` réveillerait la valeur par
  // défaut, et le test « sans cible » testerait une série à huit répétitions.
  targetReps: number | null = 8,
  setType: SetType = 'normal',
  reps: number | undefined = targetReps ?? undefined,
): WorkoutSet {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    workoutExerciseId: 'row-1',
    exerciseId: 'ex-1',
    workoutId: 'w-1',
    order: 0,
    setType,
    side: 'both',
    isCompleted,
    performedAt: 0,
    targetReps: targetReps ?? undefined,
    reps,
  };
}

describe('cadenceFor', () => {
  it('bat les répétitions des exercices comptés', () => {
    expect(cadenceFor('weight_reps', 3)).toEqual({ kind: 'reps', repSeconds: 3 });
    expect(cadenceFor('reps_only', 2.5)).toEqual({ kind: 'reps', repSeconds: 2.5 });
    expect(cadenceFor('assisted_weight_reps', 3)).toEqual({ kind: 'reps', repSeconds: 3 });
  });

  it('chronomètre les exercices mesurés à la montre', () => {
    expect(cadenceFor('time_only', 3)).toEqual({ kind: 'hold' });
    expect(cadenceFor('weight_time', 3)).toEqual({ kind: 'hold' });
    expect(cadenceFor('distance_time', 3)).toEqual({ kind: 'hold' });
  });
});

describe('prepareNextPace, en répétitions', () => {
  it('vise la première série de travail à faire', () => {
    expect(prepareNextPace([set('a', 1), set('b', 0), set('c', 0)], REPS)).toEqual({
      kind: 'ready',
      target: { kind: 'reps', setId: 'b', reps: 8, repSeconds: 3 },
    });
  });

  it('saute les échauffements', () => {
    expect(prepareNextPace([set('w', 0, 8, 'warmup'), set('a', 0)], REPS)).toMatchObject({
      target: { setId: 'a' },
    });
  });

  it('lit les répétitions saisies et non la prescription', () => {
    expect(prepareNextPace([set('a', 0, 12, 'normal', 7)], REPS)).toEqual({
      kind: 'ready',
      target: { kind: 'reps', setId: 'a', reps: 7, repSeconds: 3 },
    });
  });

  it('distingue une prochaine série vide d’une séance terminée', () => {
    expect(prepareNextPace([{ ...set('a', 0, 8), reps: undefined }], REPS)).toEqual({
      kind: 'missing-reps',
      setId: 'a',
    });
    expect(prepareNextPace([set('a', 1)], REPS)).toEqual({ kind: 'done' });
  });

  it('regarde après la série dont le repos vient de finir', () => {
    const justCompleted = set('a', 0, 8, 'normal', 8);
    const next = { ...set('b', 0, 8), reps: undefined };

    expect(prepareNextPace([justCompleted, next], REPS, justCompleted.id)).toEqual({
      kind: 'missing-reps',
      setId: next.id,
    });
  });

  it('ne propose rien quand tout est fait', () => {
    expect(prepareNextPace([set('a', 1), set('b', 1)], REPS)).toEqual({ kind: 'done' });
  });

  it('rend le tempo qu’on lui donne, le même pour toutes les séries', () => {
    // Plus de bonus de fatigue : le tempo est celui de l'exercice, choisi dans
    // sa carte, et il ne bouge pas tout seul entre la première série et la
    // dernière.
    const cadence = { kind: 'reps', repSeconds: 4.5 } as const;
    const early = prepareNextPace([set('a', 0), set('b', 0), set('c', 0)], cadence);
    const late = prepareNextPace([set('a', 1), set('b', 1), set('c', 0)], cadence);

    expect(early).toMatchObject({ target: { repSeconds: 4.5 } });
    expect(late).toMatchObject({ target: { repSeconds: 4.5 } });
  });

  it('ignore une série supprimée', () => {
    const deleted = { ...set('z', 0), deletedAt: 5 };
    expect(prepareNextPace([deleted, set('a', 0)], REPS)).toMatchObject({
      target: { setId: 'a' },
    });
  });
});

describe('prepareNextPace, en maintien', () => {
  // La différence structurante : il n'y a rien à taper avant de tenir. Un
  // gainage à l'usure part sans savoir combien de temps il va durer.
  it('est prête sans aucune valeur saisie', () => {
    expect(prepareNextPace([{ ...set('a', 0, 8), reps: undefined }], HOLD)).toEqual({
      kind: 'ready',
      target: { kind: 'hold', setId: 'a' },
    });
  });

  it('saute les échauffements comme la cadence', () => {
    expect(prepareNextPace([set('w', 0, 8, 'warmup'), set('a', 0)], HOLD)).toEqual({
      kind: 'ready',
      target: { kind: 'hold', setId: 'a' },
    });
  });

  it('n’a plus rien à tenir quand tout est validé', () => {
    expect(prepareNextPace([set('a', 1)], HOLD)).toEqual({ kind: 'done' });
  });
});

describe('prepareFollowingExercisePace', () => {
  it('prend la première série renseignée de l’exercice suivant', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)], cadence: REPS },
        {
          rowId: 'row-b',
          sets: [set('b', 0, 10, 'normal', 12)],
          cadence: { kind: 'reps', repSeconds: 4 },
        },
      ],
      'row-a',
    );

    expect(result?.rowId).toBe('row-b');
    expect(result?.preparation).toMatchObject({
      kind: 'ready',
      target: { kind: 'reps', setId: 'b', reps: 12, repSeconds: 4 },
    });
  });

  it('saute un exercice déjà terminé', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)], cadence: REPS },
        { rowId: 'row-b', sets: [set('b', 1)], cadence: REPS },
        { rowId: 'row-c', sets: [{ ...set('c', 0), reps: undefined }], cadence: REPS },
      ],
      'row-a',
    );

    expect(result).toEqual({
      rowId: 'row-c',
      preparation: { kind: 'missing-reps', setId: 'c' },
    });
  });

  // Le passage d'un exercice compté à un exercice tenu n'a rien à réclamer.
  it('enchaîne sur un exercice chronométré sans demander de valeur', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)], cadence: REPS },
        { rowId: 'row-b', sets: [{ ...set('b', 0), reps: undefined }], cadence: HOLD },
      ],
      'row-a',
    );

    expect(result).toEqual({
      rowId: 'row-b',
      preparation: { kind: 'ready', target: { kind: 'hold', setId: 'b' } },
    });
  });
});
