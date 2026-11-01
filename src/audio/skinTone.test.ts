import { describe, expect, it } from 'vitest';
import { skinTone } from './skinTone';

describe('skinTone', () => {
  it('takes the tone off every set validation in the Cyber theme: the impact plays on its own', () => {
    // The impact must sound on every validation, and these cues have cooldowns (20 s for the last
    // two) during which the plan is silent: it is played apart (`announceSetValidation`).
    for (const cue of ['set-validated', 'last-set-ahead', 'exercise-cleared'] as const) {
      expect(skinTone(cue, 'validate', 'cyber')).toBeNull();
    }
  });

  it('leaves every other theme with its quiet acknowledgement', () => {
    for (const theme of ['dark', 'light', 'tty1', null]) {
      expect(skinTone('set-validated', 'validate', theme)).toBe('validate');
      expect(skinTone('exercise-cleared', 'validate', theme)).toBe('validate');
    }
  });

  it('touches no other cue, even in Cyber', () => {
    expect(skinTone('rest-10', 'tick', 'cyber')).toBe('tick');
    expect(skinTone('record-beaten', 'record', 'cyber')).toBe('record');
  });

  it('never makes a sound where the plan had none', () => {
    expect(skinTone('rest-10', null, 'cyber')).toBeNull();
  });
});
