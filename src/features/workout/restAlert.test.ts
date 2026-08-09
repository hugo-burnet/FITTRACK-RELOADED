import { describe, expect, it, vi } from 'vitest';
import { signalRestFinished } from './restAlert';

describe('signalRestFinished', () => {
  it('uses Web Audio and vibration when no native alert is armed', () => {
    const play = vi.fn();
    const buzz = vi.fn();

    signalRestFinished(() => false, play, buzz);

    expect(play).toHaveBeenCalledOnce();
    expect(buzz).toHaveBeenCalledOnce();
  });

  it('does not duplicate a successfully armed native alert', () => {
    const play = vi.fn();
    const buzz = vi.fn();

    signalRestFinished(() => true, play, buzz);

    expect(play).not.toHaveBeenCalled();
    expect(buzz).not.toHaveBeenCalled();
  });
});
