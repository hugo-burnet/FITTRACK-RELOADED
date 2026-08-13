import { describe, expect, it } from 'vitest';
import type { CoachSignal } from '@/lib/coach';
import { coachSignalMessage } from './coachCopy';

function rangeCeiling(
  currentKg: number | undefined,
  nextKg: number,
  code: 'range_ceiling_reached' | 'range_completed' = 'range_ceiling_reached',
): CoachSignal {
  return {
    exerciseId: 'bench',
    code,
    severity: 40,
    nextLoadKg: nextKg,
    evidence: [
      { label: 'working_sets', value: 3 },
      { label: 'target_reps_max', value: 12 },
      ...(currentKg === undefined ? [] : [{ label: 'current_load_kg', value: currentKg }]),
      { label: 'next_load_kg', value: nextKg },
    ],
  };
}

describe('coachSignalMessage — range ceiling', () => {
  it('reads as a step between two loads, never as a bare plus sign', () => {
    const message = coachSignalMessage(rangeCeiling(47.5, 50));
    expect(message).toContain('47,5 → 50 kg');
    // The bug this guards: `+50 kg` to mean "go up to 50", which reads as
    // "add fifty kilos".
    expect(message).not.toContain('+');
  });

  it('keeps the arrow when assistance goes down', () => {
    const message = coachSignalMessage(rangeCeiling(50, 45));
    expect(message).toContain('Assistance 50 → 45 kg');
  });

  it('falls back to the target alone when the current load is unknown', () => {
    const message = coachSignalMessage(rangeCeiling(undefined, 50));
    expect(message).toContain('50 kg');
    expect(message).not.toContain('→');
  });

  it('reads a stored range_completed journal row with the same ceiling copy', () => {
    const message = coachSignalMessage(rangeCeiling(47.5, 50, 'range_completed'));
    expect(message).toContain('47,5 → 50 kg');
    expect(message).toContain('haut de la fourchette');
  });
});

describe('coachSignalMessage — range satisfied', () => {
  it('states the floor was met without claiming a load change', () => {
    const message = coachSignalMessage({
      code: 'range_satisfied',
      evidence: [
        { label: 'working_sets', value: 3 },
        { label: 'target_reps', value: 8 },
        { label: 'target_reps_max', value: 12 },
      ],
    });
    expect(message).toContain('Fourchette respectée');
    expect(message).toContain('3 séries');
    expect(message).not.toContain('→');
  });
});

function rangeMissed(currentKg: number, nextKg: number): CoachSignal {
  return {
    exerciseId: 'bench',
    code: 'range_missed',
    severity: 50,
    nextLoadKg: nextKg,
    evidence: [
      { label: 'sessions', value: 2 },
      { label: 'target_reps', value: 8 },
      { label: 'low_reps', value: 6 },
      { label: 'current_load_kg', value: currentKg },
      { label: 'next_load_kg', value: nextKg },
    ],
  };
}

describe('coachSignalMessage — range missed', () => {
  it('says how far down and why, with the numbers that produced it', () => {
    const message = coachSignalMessage(rangeMissed(80, 77.5));
    expect(message).toContain('80 → 77,5 kg');
    expect(message).toContain('bas de fourchette (8)');
    expect(message).toContain('2 séances');
  });

  it('reads as more assistance when the number goes up', () => {
    expect(coachSignalMessage(rangeMissed(40, 45))).toContain('Assistance 40 → 45 kg');
  });
});
