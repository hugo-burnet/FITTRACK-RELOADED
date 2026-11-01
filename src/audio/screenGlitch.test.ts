import { describe, expect, it, vi } from 'vitest';

const play = vi.hoisted(() => vi.fn(() => true));
vi.mock('./context', () => ({ audioBus: () => ({}) }));
vi.mock('./impactPack', () => ({
  createImpactPack: () => ({ play, warmUp: vi.fn() }),
  impactPack: { warmUp: vi.fn(), play: vi.fn(() => false) },
}));
vi.mock('./tones', () => ({ playTone: vi.fn() }));

const { playScreenGlitch } = await import('./screenGlitch');

describe('playScreenGlitch', () => {
  it('plays when the app is allowed sounds', () => {
    expect(playScreenGlitch('sounds')).toBe(true);
    expect(playScreenGlitch('voice')).toBe(true);
  });

  it('stays quiet in silence, and when only the voice is wanted', () => {
    play.mockClear();
    expect(playScreenGlitch('silence')).toBe(false);
    expect(playScreenGlitch('voice-only')).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('playSetImpact', () => {
  it('strikes unless the app is silent', async () => {
    const { playSetImpact } = await import('./screenGlitch');
    expect(playSetImpact('silence')).toBe(false);
    expect(playSetImpact('sounds')).toBe(true);
    expect(playSetImpact('voice-only')).toBe(true);
  });
});
