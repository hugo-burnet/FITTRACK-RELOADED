import { describe, expect, it } from 'vitest';
import { skinTone } from './skinTone';

describe('skinTone', () => {
  it('gives a validated set the cadence impact in the Cyber theme', () => {
    expect(skinTone('set-validated', 'validate', 'cyber')).toBe('repTap');
  });

  it('leaves every other theme with its quiet acknowledgement', () => {
    for (const theme of ['dark', 'light', 'tty1', null]) {
      expect(skinTone('set-validated', 'validate', theme)).toBe('validate');
    }
  });

  it('touches no other cue, even in Cyber', () => {
    expect(skinTone('exercise-cleared', 'validate', 'cyber')).toBe('validate');
    expect(skinTone('rest-10', 'tick', 'cyber')).toBe('tick');
  });

  it('never makes a sound where the plan had none (voice only, silence)', () => {
    expect(skinTone('set-validated', null, 'cyber')).toBeNull();
  });
});
