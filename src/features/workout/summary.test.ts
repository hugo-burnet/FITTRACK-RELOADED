import { describe, expect, it } from 'vitest';
import { finishSetSummary } from './summary';

describe('finishSetSummary', () => {
  it('écrit une série au singulier', () => {
    expect(finishSetSummary(1, '6 reps · 30 kg')).toBe('1 série · dernière : 6 reps · 30 kg');
  });

  it('écrit plusieurs séries au pluriel, sans « (s) »', () => {
    expect(finishSetSummary(2, '6 reps · 30 kg')).toBe('2 séries · dernière : 6 reps · 30 kg');
  });
});
