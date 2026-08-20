import type { AudioBus } from './context';

export type ImpactLoader = () => Promise<ArrayBuffer>;

export interface ImpactPack {
  /** Fetches and decodes the cadence impact once. Safe to call repeatedly. */
  warmUp: (bus: AudioBus) => Promise<void>;
  /** Starts the decoded impact on the dry master bus. */
  play: (bus: AudioBus, when?: number) => boolean;
}

/**
 * The one recorded beat in the tone system.
 *
 * It deliberately targets `master`, not the public-address chain used by the
 * announcer. Reverb would blur a one-second impact across the next movement;
 * an impact already designed with its own space must stay exactly as authored.
 */
export function createImpactPack(load: ImpactLoader): ImpactPack {
  let decoded: AudioBuffer | null | undefined;
  let pending: Promise<void> | null = null;

  const fetchImpact = (bus: AudioBus): Promise<void> => {
    if (pending !== null) return pending;
    pending = load()
      .then((bytes) => bus.context.decodeAudioData(bytes))
      .then((buffer) => {
        decoded = buffer;
      })
      .catch(() => {
        decoded = null;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };

  return {
    async warmUp(bus) {
      if (decoded !== undefined) return;
      await fetchImpact(bus);
    },

    play(bus, when = 0) {
      if (decoded === undefined) {
        void fetchImpact(bus);
        return false;
      }
      if (decoded === null) return false;

      try {
        const source = bus.context.createBufferSource();
        source.buffer = decoded;
        source.connect(bus.master);
        source.start(bus.context.currentTime + Math.max(0, when));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function impactUrl(): string {
  return `${import.meta.env.BASE_URL}audio/rep-impact.wav`;
}

async function fetchImpactBytes(): Promise<ArrayBuffer> {
  const response = await fetch(impactUrl());
  if (!response.ok) throw new Error(`rep impact: ${String(response.status)}`);
  return response.arrayBuffer();
}

export const impactPack = createImpactPack(fetchImpactBytes);
