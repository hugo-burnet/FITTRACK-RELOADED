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
    const target = nextPaceTarget([set('a', 1), set('b', 0), set('c', 0)], 3);
    expect(target?.setId).toBe('b');
    expect(target?.reps).toBe(8);
  });

  it('saute les échauffements', () => {
    const target = nextPaceTarget([set('w', 0, 8, 'warmup'), set('a', 0)], 3);
    expect(target?.setId).toBe('a');
  });

  it('lit les répétitions saisies et non la prescription', () => {
    expect(nextPaceTarget([set('a', 0, 12, 'normal', 7)], 3)?.reps).toBe(7);
  });

  it('distingue une prochaine série vide d’une séance terminée', () => {
    expect(prepareNextPace([{ ...set('a', 0, 8), reps: undefined }], 3)).toEqual({
      kind: 'missing-reps',
      setId: 'a',
    });
    expect(prepareNextPace([set('a', 1)], 3)).toEqual({ kind: 'done' });
  });

  it('regarde après la série dont le repos vient de finir', () => {
    const justCompleted = set('a', 0, 8, 'normal', 8);
    const next = { ...set('b', 0, 8), reps: undefined };

    expect(prepareNextPace([justCompleted, next], 3, justCompleted.id)).toEqual({
      kind: 'missing-reps',
      setId: next.id,
    });
  });

  it('ne propose rien quand tout est fait', () => {
    expect(nextPaceTarget([set('a', 1), set('b', 1)], 3)).toBeNull();
  });

  it('rend le tempo qu’on lui donne, le même pour toutes les séries', () => {
    // Plus de bonus de fatigue : le tempo est celui de l'exercice, choisi dans
    // sa carte, et il ne bouge pas tout seul entre la première série et la
    // dernière.
    const early = nextPaceTarget([set('a', 0), set('b', 0), set('c', 0)], 4.5);
    const late = nextPaceTarget([set('a', 1), set('b', 1), set('c', 0)], 4.5);

    expect(early?.repSeconds).toBe(4.5);
    expect(late?.repSeconds).toBe(4.5);
  });

  it('ignore une série supprimée', () => {
    const deleted = { ...set('z', 0), deletedAt: 5 };
    const target = nextPaceTarget([deleted, set('a', 0)], 3);
    expect(target?.setId).toBe('a');
  });
});

describe('prepareFollowingExercisePace', () => {
  it('prend la première série renseignée de l’exercice suivant', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)], repSeconds: 3 },
        { rowId: 'row-b', sets: [set('b', 0, 10, 'normal', 12)], repSeconds: 4 },
      ],
      'row-a',
    );

    expect(result?.rowId).toBe('row-b');
    expect(result?.preparation).toMatchObject({
      kind: 'ready',
      target: { setId: 'b', reps: 12, repSeconds: 4 },
    });
  });

  it('saute un exercice déjà terminé', () => {
    const result = prepareFollowingExercisePace(
      [
        { rowId: 'row-a', sets: [set('a', 1)], repSeconds: 3 },
        { rowId: 'row-b', sets: [set('b', 1)], repSeconds: 3 },
        { rowId: 'row-c', sets: [{ ...set('c', 0), reps: undefined }], repSeconds: 3 },
      ],
      'row-a',
    );

    expect(result).toEqual({
      rowId: 'row-c',
      preparation: { kind: 'missing-reps', setId: 'c' },
    });
  });
});
