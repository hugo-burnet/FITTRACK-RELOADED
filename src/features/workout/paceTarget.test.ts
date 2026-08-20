import { describe, expect, it } from 'vitest';
import type { SetType, WorkoutSet } from '@/data/types';
import {
  nextPaceTarget,
  prepareFollowingExercisePace,
  prepareNextPace,
} from './paceTarget';

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

describe('nextPaceTarget', () => {
  it('vise la première série de travail à faire', () => {
    const target = nextPaceTarget([set('a', 1), set('b', 0), set('c', 0)], 0);
    expect(target?.setId).toBe('b');
    expect(target?.reps).toBe(8);
  });

  it('saute les échauffements', () => {
    const target = nextPaceTarget([set('w', 0, 8, 'warmup'), set('a', 0)], 0);
    expect(target?.setId).toBe('a');
  });

  it('lit les répétitions saisies et non la prescription', () => {
    expect(nextPaceTarget([set('a', 0, 12, 'normal', 7)], 0)?.reps).toBe(7);
  });

  it('distingue une prochaine série vide d’une séance terminée', () => {
    expect(prepareNextPace([{ ...set('a', 0, 8), reps: undefined }], 0)).toEqual({
      kind: 'missing-reps',
      setId: 'a',
    });
    expect(prepareNextPace([set('a', 1)], 0)).toEqual({ kind: 'done' });
  });

  it('regarde après la série dont le repos vient de finir', () => {
    const justCompleted = set('a', 0, 8, 'normal', 8);
    const next = { ...set('b', 0, 8), reps: undefined };

    expect(prepareNextPace([justCompleted, next], 0, justCompleted.id)).toEqual({
      kind: 'missing-reps',
      setId: next.id,
    });
  });

  it('ne propose rien quand tout est fait', () => {
    expect(nextPaceTarget([set('a', 1), set('b', 1)], 0)).toBeNull();
  });

  it('allonge le tempo à mesure que les séries s’accumulent', () => {
    const early = nextPaceTarget([set('a', 0), set('b', 0), set('c', 0)], 0);
    const late = nextPaceTarget([set('a', 1), set('b', 1), set('c', 0)], 0);

    expect(early?.repSeconds).toBe(3);
    // Deux séries faites, et c'est la dernière : 3 + 0,5 + 0,5.
    expect(late?.repSeconds).toBe(4);
  });

  it('tient compte de l’heure passée en salle', () => {
    const target = nextPaceTarget([set('a', 0), set('b', 0)], 50 * 60_000);
    expect(target?.repSeconds).toBe(3.5);
  });

  it('ignore une série supprimée', () => {
    const deleted = { ...set('z', 0), deletedAt: 5 };
    const target = nextPaceTarget([deleted, set('a', 0)], 0);
    expect(target?.setId).toBe('a');
  });
});

describe('prepareFollowingExercisePace', () => {
  it('prend la première série renseignée de l’exercice suivant', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)] },
        { rowId: 'row-b', sets: [set('b', 0, 10, 'normal', 12)] },
      ],
      'row-a',
      0,
    );

    expect(result?.rowId).toBe('row-b');
    expect(result?.preparation).toMatchObject({
      kind: 'ready',
      target: { setId: 'b', reps: 12 },
    });
  });

  it('saute un exercice déjà terminé', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)] },
        { rowId: 'row-b', sets: [set('b', 1)] },
        { rowId: 'row-c', sets: [{ ...set('c', 0), reps: undefined }] },
      ],
      'row-a',
      0,
    );

    expect(result).toEqual({
      rowId: 'row-c',
      preparation: { kind: 'missing-reps', setId: 'c' },
    });
  });
});
