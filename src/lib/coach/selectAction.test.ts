import { describe, expect, it } from 'vitest';
import { selectProgramAction } from './selectAction';

describe('selectProgramAction', () => {
  it('prefers increase_load over add_set in construction (never selects add_set)', () => {
    expect(
      selectProgramAction(['maintain', 'increase_load', 'add_set'], {
        phase: 'construction',
        loadIndex: 100,
      }),
    ).toBe('increase_load');
  });

  it('prefers add_set in overload when authorized', () => {
    expect(
      selectProgramAction(['maintain', 'increase_load', 'add_set'], {
        phase: 'overload',
        loadIndex: 110,
      }),
    ).toBe('add_set');
  });

  it('prefers maintain in return even when increase_load is allowed', () => {
    expect(
      selectProgramAction(['maintain', 'increase_load'], {
        phase: 'return',
        loadIndex: 100,
      }),
    ).toBe('maintain');
  });

  it('falls back to maintain when nothing ranked is allowed', () => {
    expect(
      selectProgramAction(['maintain'], {
        phase: 'progression',
        loadIndex: 105,
      }),
    ).toBe('maintain');
  });

  it('uses construction ranking when target is undefined (hors bloc)', () => {
    expect(selectProgramAction(['maintain', 'increase_load', 'add_set'], undefined)).toBe(
      'increase_load',
    );
    expect(selectProgramAction(['maintain', 'increase_reps', 'add_set'], undefined)).toBe(
      'increase_reps',
    );
    expect(selectProgramAction(['maintain', 'add_set'], undefined)).toBe('maintain');
  });

  it('only selects maintain for a deload target (no add_set / increases)', () => {
    expect(
      selectProgramAction(['maintain', 'increase_load', 'add_set'], {
        phase: 'deload',
        loadIndex: 60,
      }),
    ).toBe('maintain');
  });

  it('returns maintain when allowed is empty', () => {
    expect(selectProgramAction([], { phase: 'overload', loadIndex: 110 })).toBe('maintain');
  });
});
