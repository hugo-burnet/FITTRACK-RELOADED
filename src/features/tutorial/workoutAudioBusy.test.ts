import { describe, expect, it } from 'vitest';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

const idlePacer = { setId: null, reps: 0, repSeconds: 0, startedAt: 0 };
const idleRest = { setId: null, endsAt: 0 };
const idleHold = { setId: null };

describe('isWorkoutAudioBusy', () => {
  it('ignore un repos expiré resté dans le store', () => {
    expect(
      isWorkoutAudioBusy(idlePacer, { setId: 'set-1', endsAt: 9_999 }, idleHold, 10_000),
    ).toBe(false);
  });

  it('protège la voix pendant un vrai repos', () => {
    expect(
      isWorkoutAudioBusy(idlePacer, { setId: 'set-1', endsAt: 10_001 }, idleHold, 10_000),
    ).toBe(true);
  });

  it('ignore une cadence terminée restée dans le store', () => {
    const pacer = { setId: 'set-1', reps: 10, repSeconds: 3, startedAt: 20_000 };
    expect(isWorkoutAudioBusy(pacer, idleRest, idleHold, 50_000)).toBe(false);
  });

  it('protège la voix pendant la préparation et les répétitions', () => {
    const pacer = { setId: 'set-1', reps: 10, repSeconds: 3, startedAt: 20_000 };
    expect(isWorkoutAudioBusy(pacer, idleRest, idleHold, 19_000)).toBe(true);
    expect(isWorkoutAudioBusy(pacer, idleRest, idleHold, 49_999)).toBe(true);
  });

  /*
   * Un maintien n'a pas d'échéance : il s'arrête quand celui qui tient relâche.
   * Il n'y a donc rien à comparer à l'horloge, et la présence du set est le seul
   * signal disponible — l'écran de séance le nettoie quand sa série disparaît.
   */
  it('protège la voix pendant un maintien, qui n’a pas de fin annoncée', () => {
    expect(isWorkoutAudioBusy(idlePacer, idleRest, { setId: 'set-1' }, 10_000)).toBe(true);
    expect(isWorkoutAudioBusy(idlePacer, idleRest, idleHold, 10_000)).toBe(false);
  });
});
