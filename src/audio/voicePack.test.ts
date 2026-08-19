import { describe, expect, it, vi } from 'vitest';
import type { AudioBus } from './context';
import { createVoicePack } from './voicePack';

function createBus() {
  const start = vi.fn();
  const bus = {
    context: {
      currentTime: 0,
      decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start,
      })),
    },
    master: {},
  } as unknown as AudioBus;
  return { bus, start };
}

describe('voicePack', () => {
  it('ne télécharge chaque clip qu’une fois', async () => {
    const load = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const pack = createVoicePack(load);
    const { bus } = createBus();

    await pack.warmUp(bus, ['rest-over-1', 'rest-over-1']);
    await pack.warmUp(bus, ['rest-over-1']);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('joue un clip décodé', async () => {
    const pack = createVoicePack(vi.fn().mockResolvedValue(new ArrayBuffer(8)));
    const { bus, start } = createBus();

    await pack.warmUp(bus, ['rest-over-1']);

    expect(pack.play(bus, 'rest-over-1')).toBe(true);
    expect(start).toHaveBeenCalledOnce();
    expect(pack.readyCount()).toBe(1);
  });

  it('reste muet, et ne redemande pas, un clip absent', async () => {
    const load = vi.fn().mockRejectedValue(new Error('404'));
    const pack = createVoicePack(load);
    const { bus, start } = createBus();

    await pack.warmUp(bus, ['rest-over-1']);

    expect(pack.play(bus, 'rest-over-1')).toBe(false);
    expect(pack.play(bus, 'rest-over-1')).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(pack.readyCount()).toBe(0);
  });

  it('ne parle pas en retard : un clip pas encore prêt passe son tour', () => {
    const load = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const pack = createVoicePack(load);
    const { bus, start } = createBus();

    expect(pack.play(bus, 'rest-over-1')).toBe(false);
    expect(start).not.toHaveBeenCalled();
    // Mais il se met en file pour la prochaine fois.
    expect(load).toHaveBeenCalledOnce();
  });
});
