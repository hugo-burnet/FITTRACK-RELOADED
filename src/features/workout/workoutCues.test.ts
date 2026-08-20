import { beforeEach, describe, expect, it } from 'vitest';
import type { SetType, WorkoutSet } from '@/data/types';
import { claimWorkoutGreeting, forgetWorkoutGreetings, setValidationCue } from './workoutCues';

function set(id: string, isCompleted: 0 | 1, setType: SetType = 'normal'): WorkoutSet {
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
  };
}

describe('setValidationCue', () => {
  it('annonce la dernière série une série à l’avance', () => {
    const sets = [set('a', 1), set('b', 0), set('c', 0)];
    expect(setValidationCue(sets, 'b')).toBe('last-set-ahead');
  });

  it('annonce l’exercice terminé sur la dernière', () => {
    const sets = [set('a', 1), set('b', 1), set('c', 0)];
    expect(setValidationCue(sets, 'c')).toBe('exercise-cleared');
  });

  it('se contente du son au milieu de l’exercice', () => {
    const sets = [set('a', 0), set('b', 0), set('c', 0)];
    expect(setValidationCue(sets, 'a')).toBe('set-validated');
  });

  it('ne compte pas les échauffements dans ce qui reste', () => {
    const sets = [set('a', 0), set('b', 0, 'warmup'), set('c', 0)];
    expect(setValidationCue(sets, 'a')).toBe('last-set-ahead');
  });

  it('ne commente pas un échauffement validé', () => {
    const sets = [set('w', 0, 'warmup'), set('a', 0)];
    expect(setValidationCue(sets, 'w')).toBe('set-validated');
  });

  it('ignore une série supprimée', () => {
    const deleted = { ...set('z', 0), deletedAt: 1 };
    const sets = [set('a', 1), set('b', 0), deleted];
    expect(setValidationCue(sets, 'b')).toBe('exercise-cleared');
  });
});

describe('claimWorkoutGreeting', () => {
  beforeEach(forgetWorkoutGreetings);

  it('salue une séance prête, une seule fois', () => {
    expect(claimWorkoutGreeting('w1', 0, 4)).toBe(true);
    expect(claimWorkoutGreeting('w1', 0, 4)).toBe(false);
  });

  it('ne salue pas une séance déjà entamée', () => {
    expect(claimWorkoutGreeting('w2', 3, 4)).toBe(false);
  });

  it('ne parle pas sur une séance sans aucune série', () => {
    expect(claimWorkoutGreeting('w-empty', 0, 0)).toBe(false);
  });

  it('salue chaque séance pour elle-même', () => {
    expect(claimWorkoutGreeting('w1', 0, 4)).toBe(true);
    expect(claimWorkoutGreeting('w2', 0, 4)).toBe(true);
  });
});
