import { describe, expect, it } from 'vitest';
import type { ProgramPhase } from '@/data/types';
import { coachReadingKeys } from './coachReading';

describe('coachReadingKeys', () => {
  it('says that overload proposes a set before the load', () => {
    expect(coachReadingKeys('overload', undefined)).toEqual(['program.detailCoachOverload']);
  });

  it('says that a deload only maintains, and never reads as a plateau', () => {
    expect(coachReadingKeys('deload', undefined)).toEqual(['program.detailCoachDeload']);
  });

  it('gives the load-first reading to construction, progression and test', () => {
    for (const phase of ['construction', 'progression', 'test'] as ProgramPhase[]) {
      expect(coachReadingKeys(phase, undefined)).toEqual(['program.detailCoachBuild']);
    }
  });

  it('prefers maintaining on a return week', () => {
    expect(coachReadingKeys('return', undefined)).toEqual(['program.detailCoachReturn']);
  });

  it('announces a deload next week, except when this week already is one', () => {
    expect(coachReadingKeys('overload', 'deload')).toEqual([
      'program.detailCoachOverload',
      'program.detailCoachNextDeload',
    ]);
    expect(coachReadingKeys('deload', 'deload')).toEqual(['program.detailCoachDeload']);
  });
});
