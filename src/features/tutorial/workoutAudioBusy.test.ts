import { describe, expect, it } from 'vitest';
import { isWorkoutAudioBusy } from './workoutAudioBusy';

const idlePacer = { setId: null, reps: 0, repSeconds: 0, startedAt: 0 };
const idleRest = { setId: null, endsAt: 0 };

describe('isWorkoutAudioBusy', () => {
  it('ignore un repos expiré resté dans le store', () => {
    expect(
      isWorkoutAudioBusy(idlePacer, { setId: 'set-1', endsAt: 9_999 }, 10_000),
    ).toBe(false);
  });

  it('protège la voix pendant un vrai repos', () => {
    expect(
      isWorkoutAudioBusy(idlePacer, { setId: 'set-1', endsAt: 10_001 }, 10_000),
    ).toBe(true);
  });

  it('ignore une cadence terminée restée dans le store', () => {
    const pacer = { setId: 'set-1', reps: 10, repSeconds: 3, startedAt: 20_000 };
    expect(isWorkoutAudioBusy(pacer, idleRest, 50_000)).toBe(false);
  });

  it('protège la voix pendant la préparation et les répétitions', () => {
    const pacer = { setId: 'set-1', reps: 10, repSeconds: 3, startedAt: 20_000 };
    expect(isWorkoutAudioBusy(pacer, idleRest, 19_000)).toBe(true);
    expect(isWorkoutAudioBusy(pacer, idleRest, 49_999)).toBe(true);
  });
});
