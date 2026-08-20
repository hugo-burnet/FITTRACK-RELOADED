import { describe, expect, it, vi } from 'vitest';
import type { AudioBus } from './context';
import { createImpactPack } from './impactPack';

function createBus() {
  const start = vi.fn();
  const connect = vi.fn();
  const bus = {
    context: {
      currentTime: 4,
      decodeAudioData: vi.fn().mockResolvedValue({} as AudioBuffer),
      createBufferSource: vi.fn(() => ({ buffer: null, connect, start })),
    },
    master: {},
    voice: {},
  } as unknown as AudioBus;
  return { bus, connect, start };
}

describe('impactPack', () => {
  it('charge et décode le sample une seule fois', async () => {
    const load = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const pack = createImpactPack(load);
    const { bus } = createBus();

    await pack.warmUp(bus);
    await pack.warmUp(bus);

    expect(load).toHaveBeenCalledOnce();
  });

  it('joue sur le bus principal à l’instant demandé', async () => {
    const pack = createImpactPack(vi.fn().mockResolvedValue(new ArrayBuffer(8)));
    const { bus, connect, start } = createBus();
    await pack.warmUp(bus);

    expect(pack.play(bus, 1.5)).toBe(true);
    expect(connect).toHaveBeenCalledWith(bus.master);
    expect(start).toHaveBeenCalledWith(5.5);
  });

  it('garde le premier battement synchrone si le fichier n’est pas encore prêt', () => {
    const load = vi.fn().mockResolvedValue(new ArrayBuffer(8));
    const pack = createImpactPack(load);
    const { bus, start } = createBus();

    expect(pack.play(bus)).toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();
  });
});
