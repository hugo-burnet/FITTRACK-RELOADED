import type { AudioBus } from './context';

/**
 * The recorded half of the announcer: short mp3 clips, decoded once, played
 * through the same bus as the tones.
 *
 * **A missing clip is silence, never an error.** The pack is optional by
 * design — the repository ships the script, not necessarily the recordings —
 * so an app with no `public/voice` folder must behave exactly like an app with
 * the voice turned off. A failed fetch is remembered as a miss and never
 * retried: thirty rests a session times four dead requests each is a lot of
 * noise in a log for a feature nobody is missing.
 *
 * **A late word is worse than no word.** `play` only plays what is already
 * decoded; a clip that is not ready starts loading for next time and the cue
 * passes with its tone alone. Nothing is ever spoken two seconds after the
 * event it describes.
 */
export interface VoicePack {
  /** Fetches and decodes what is not known yet. Safe to call repeatedly. */
  warmUp: (bus: AudioBus, clips: readonly string[]) => Promise<void>;
  /** `true` when a sound was actually started. */
  play: (bus: AudioBus, clip: string, when?: number) => boolean;
  /** Milliseconds until every queued phrase and its final breathing room end. */
  queuedMs: (bus: AudioBus) => number;
  /** How many clips are decoded and ready — the settings screen reads this. */
  readyCount: () => number;
}

export type ClipLoader = (clip: string) => Promise<ArrayBuffer>;

/** Roughly +10 dB: speech must remain foreground information over gym music. */
export const VOICE_GAIN = 3.2;
/** Two spoken messages are information, never a crossfade. */
const VOICE_GAP_SECONDS = 1;

/** Three, two, one is one announcement split into files, not three messages. */
function isCountdownWord(clip: string): boolean {
  return /^(?:rest|rep)-[123]-/.test(clip);
}

export function createVoicePack(load: ClipLoader): VoicePack {
  /** `null` marks a clip known to be absent — the miss is cached too. */
  const decoded = new Map<string, AudioBuffer | null>();
  const pending = new Map<string, Promise<void>>();
  /** Audio-clock end of the last queued phrase, including its breathing room. */
  let availableAt = 0;

  function fetchClip(bus: AudioBus, clip: string): Promise<void> {
    const existing = pending.get(clip);
    if (existing !== undefined) return existing;

    const run = load(clip)
      .then((bytes) => bus.context.decodeAudioData(bytes))
      .then((buffer) => {
        decoded.set(clip, buffer);
      })
      .catch(() => {
        decoded.set(clip, null);
      })
      .finally(() => {
        pending.delete(clip);
      });

    pending.set(clip, run);
    return run;
  }

  return {
    async warmUp(bus, clips) {
      await Promise.all(
        clips.filter((clip) => !decoded.has(clip)).map((clip) => fetchClip(bus, clip)),
      );
    },

    play(bus, clip, when = 0) {
      const buffer = decoded.get(clip);
      if (buffer === undefined) {
        void fetchClip(bus, clip);
        return false;
      }
      if (buffer === null) return false;

      try {
        const source = bus.context.createBufferSource();
        const gain = bus.context.createGain();
        source.buffer = buffer;
        // The announcement bus, never the master: a voice that skips the
        // loudspeaker colouring is a voice memo played in a gym.
        gain.gain.value = VOICE_GAIN;
        source.connect(gain);
        gain.connect(bus.voice);
        const requestedAt = bus.context.currentTime + Math.max(0, when);
        const startsAt = Math.max(requestedAt, availableAt);
        source.start(startsAt);
        const duration = Number.isFinite(buffer.duration) ? buffer.duration : 0;
        availableAt = startsAt + duration + (isCountdownWord(clip) ? 0 : VOICE_GAP_SECONDS);
        return true;
      } catch {
        return false;
      }
    },

    queuedMs(bus) {
      return Math.max(0, availableAt - bus.context.currentTime) * 1_000;
    },

    readyCount() {
      let ready = 0;
      for (const buffer of decoded.values()) if (buffer !== null) ready += 1;
      return ready;
    },
  };
}

/**
 * Where the clips live once built. `BASE_URL` carries the GitHub Pages prefix
 * on the web and `./` under Capacitor, which is exactly the difference between
 * a voice that works in the APK and one that 404s.
 */
export function clipUrl(clip: string): string {
  return `${import.meta.env.BASE_URL}voice/${clip}.mp3`;
}

async function fetchClipBytes(clip: string): Promise<ArrayBuffer> {
  const response = await fetch(clipUrl(clip));
  if (!response.ok) throw new Error(`voice clip ${clip}: ${String(response.status)}`);
  return response.arrayBuffer();
}

export const voicePack = createVoicePack(fetchClipBytes);

/**
 * Is a voice pack installed at all?
 *
 * One clip is fetched rather than sixteen: the folder is written by one
 * generation run, so the first line answers for the whole script, and the
 * settings screen has no business pulling three hundred kilobytes to render a
 * sentence. Decoding is not involved — this runs with no user gesture, hence
 * no audio context.
 */
export async function probeVoicePack(clip: string): Promise<boolean> {
  try {
    const response = await fetch(clipUrl(clip));
    return response.ok;
  } catch {
    return false;
  }
}
