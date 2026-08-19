import { describe, expect, it } from 'vitest';
import type { SetType, WorkoutSet } from '@/data/types';
import { nextPaceTarget } from './paceTarget';

function set(
  id: string,
  isCompleted: 0 | 1,
  // `null` et non `undefined` : passer `undefined` réveillerait la valeur par
  // défaut, et le test « sans cible » testerait une série à huit répétitions.
  targetReps: number | null = 8,
  setType: SetType = 'normal',
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

  it('ne propose rien sans cible de répétitions', () => {
    expect(nextPaceTarget([set('a', 0, null)], 0)).toBeNull();
    expect(nextPaceTarget([set('a', 0, 0)], 0)).toBeNull();
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
