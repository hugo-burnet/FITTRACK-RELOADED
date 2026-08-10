import { beforeEach, describe, expect, it } from 'vitest';
import { useExerciseOrderLock } from './exerciseOrderLock';

describe('exerciseOrderLock', () => {
  beforeEach(() => useExerciseOrderLock.getState().reset());

  it('verrouille les deux surfaces par défaut', () => {
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: false,
    });
  });

  it('bascule la routine et la séance indépendamment', () => {
    useExerciseOrderLock.getState().toggle('routine');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: false,
    });

    useExerciseOrderLock.getState().toggle('workout');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: true,
    });

    useExerciseOrderLock.getState().toggle('routine');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: true,
    });
  });

  it('revient aux deux verrous fermés lors de la réinitialisation', () => {
    useExerciseOrderLock.getState().toggle('routine');
    useExerciseOrderLock.getState().toggle('workout');
    useExerciseOrderLock.getState().reset();

    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: false,
    });
  });
});
