import { describe, expect, it } from 'vitest';
import type { CoachSignal } from '@/lib/coach';
import { coachSignalMessage } from './coachCopy';

function rangeCompleted(currentKg: number | undefined, nextKg: number): CoachSignal {
  return {
    exerciseId: 'bench',
    code: 'range_completed',
    severity: 1,
    nextLoadKg: nextKg,
    evidence: [
      { label: 'working_sets', value: 3 },
      { label: 'target_reps_max', value: 12 },
      ...(currentKg === undefined ? [] : [{ label: 'current_load_kg', value: currentKg }]),
      { label: 'next_load_kg', value: nextKg },
    ],
  };
}

describe('coachSignalMessage — range completed', () => {
  it('reads as a step between two loads, never as a bare plus sign', () => {
    const message = coachSignalMessage(rangeCompleted(47.5, 50));
    expect(message).toContain('47,5 → 50 kg');
    // The bug this guards: `+50 kg` to mean "go up to 50", which reads as
    // "add fifty kilos".
    expect(message).not.toContain('+');
  });

  it('keeps the arrow when assistance goes down', () => {
    const message = coachSignalMessage(rangeCompleted(50, 45));
    expect(message).toContain('Assistance 50 → 45 kg');
  });

  it('falls back to the target alone when the current load is unknown', () => {
    const message = coachSignalMessage(rangeCompleted(undefined, 50));
    expect(message).toContain('50 kg');
    expect(message).not.toContain('→');
  });
});
