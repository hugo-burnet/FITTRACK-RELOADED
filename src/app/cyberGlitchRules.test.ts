import { describe, expect, it } from 'vitest';
import { AMBIENT_PACE, mayGlitch, nextAmbientDelay, TOUCH_QUIET_MS } from './cyberGlitchRules';

describe('nextAmbientDelay', () => {
  it('keeps the screen tears rare: thirty to sixty seconds apart', () => {
    expect(nextAmbientDelay('tear', 0)).toBe(AMBIENT_PACE.tear[0]);
    expect(nextAmbientDelay('tear', 0.999)).toBeLessThan(AMBIENT_PACE.tear[1]);
    expect(AMBIENT_PACE.tear).toEqual([30_000, 60_000]);
  });

  it('lets the small ones come every ten to twenty seconds', () => {
    expect(AMBIENT_PACE.micro).toEqual([10_000, 20_000]);
    expect(nextAmbientDelay('micro', 0.5)).toBe(15_000);
  });
});

describe('mayGlitch', () => {
  const calm = {
    now: 100_000,
    lastTouchAt: 0,
    typing: false,
    reducedMotion: false,
    hidden: false,
  };

  it('glitches a calm, visible screen', () => {
    expect(mayGlitch(calm)).toBe(true);
  });

  it('never under a finger, while typing, hidden, or for someone who asked for less motion', () => {
    expect(mayGlitch({ ...calm, lastTouchAt: calm.now - TOUCH_QUIET_MS + 1 })).toBe(false);
    expect(mayGlitch({ ...calm, typing: true })).toBe(false);
    expect(mayGlitch({ ...calm, hidden: true })).toBe(false);
    expect(mayGlitch({ ...calm, reducedMotion: true })).toBe(false);
  });

  it('comes back once the finger has been gone long enough', () => {
    expect(mayGlitch({ ...calm, lastTouchAt: calm.now - TOUCH_QUIET_MS })).toBe(true);
  });
});
