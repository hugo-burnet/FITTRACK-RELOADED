import { describe, expect, it, vi } from 'vitest';
import { P1_MISSIONS } from '@/features/tutorial/tutorialMissions';
import type { AudioBus } from './context';
import { createVoicePack } from './voicePack';

function createBus() {
  const start = vi.fn();
  const sourceConnect = vi.fn();
  const gainConnect = vi.fn();
  const gain = { value: 1 };
  const bus = {
    context: {
      currentTime: 0,
      decodeAudioData: vi.fn().mockResolvedValue({ duration: 1.25 } as AudioBuffer),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: sourceConnect,
        start,
      })),
      createGain: vi.fn(() => ({ gain, connect: gainConnect })),
    },
    master: {},
    voice: {},
  } as unknown as AudioBus;
  return { bus, gain, gainConnect, sourceConnect, start };
}

describe('voicePack', () => {
  // Les missions ont désormais leur voix. Ce qui reste à garantir est qu'aucune
  // ne partage son clip avec une autre : deux étapes sur le même enregistrement,
  // et l'une des deux dirait la consigne de sa voisine.
  it('donne à chaque mission son propre clip', () => {
    const clips = P1_MISSIONS.flatMap((mission) => mission.steps).map((step) => step.clipId);

    expect(clips.every((clip) => clip !== undefined)).toBe(true);
    expect(new Set(clips).size).toBe(clips.length);
  });

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
    const { bus, gain, gainConnect, sourceConnect, start } = createBus();

    await pack.warmUp(bus, ['rest-over-1']);

    expect(pack.play(bus, 'rest-over-1')).toBe(true);
    expect(gain.value).toBe(3.2);
    expect(sourceConnect).toHaveBeenCalledOnce();
    expect(gainConnect).toHaveBeenCalledWith(bus.voice);
    expect(start).toHaveBeenCalledOnce();
    expect(pack.readyCount()).toBe(1);
  });

  it('sépare toujours deux phrases par une seconde de silence', async () => {
    const pack = createVoicePack(vi.fn().mockResolvedValue(new ArrayBuffer(8)));
    const { bus, start } = createBus();
    await pack.warmUp(bus, ['first', 'second']);

    expect(pack.play(bus, 'first')).toBe(true);
    expect(pack.play(bus, 'second')).toBe(true);

    expect(start.mock.calls).toEqual([[0], [2.25]]);
    expect(pack.queuedMs(bus)).toBe(4_500);
  });

  it('garde les mots d’un même décompte rapprochés sans les superposer', async () => {
    const pack = createVoicePack(vi.fn().mockResolvedValue(new ArrayBuffer(8)));
    const { bus, start } = createBus();
    await pack.warmUp(bus, ['rest-3-1', 'rest-2-1']);

    expect(pack.play(bus, 'rest-3-1')).toBe(true);
    expect(pack.play(bus, 'rest-2-1', 1)).toBe(true);

    expect(start.mock.calls).toEqual([[0], [1.25]]);
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
