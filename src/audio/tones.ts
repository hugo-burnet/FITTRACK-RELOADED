import type { AudioBus } from './context';

/**
 * The synthesised half of the announcer.
 *
 * **Synthesised, not files.** Oscillator tones cost zero bytes, raise no
 * licence question on a public repository, and work with no network — which is
 * the point of an app used in a basement. The recorded voice carries the
 * character; these carry the timing, and timing is what has to be exact.
 *
 * Every envelope is ramped, never switched: a gain that jumps to zero clicks,
 * and a click is the one thing that makes a synthesised sound read as a bug.
 */
export type ToneId = 'tick' | 'chime' | 'validate' | 'record';

interface Partial_ {
  frequency: number;
  /** Seconds after the tone's own start. */
  delay: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
}

const TONES: Record<ToneId, readonly Partial_[]> = {
  /** The cadence of the last three seconds. Dry, short, unmistakably a count. */
  tick: [{ frequency: 1046.5, delay: 0, duration: 0.06, gain: 0.22, type: 'square' }],

  /** Rest is over. A4 then E5 — the interval carries further than one beep. */
  chime: [
    { frequency: 880, delay: 0, duration: 0.16, gain: 0.3 },
    { frequency: 1318.5, delay: 0.18, duration: 0.16, gain: 0.3 },
  ],

  /**
   * A set went into the database. Deliberately the quietest thing here: it
   * fires thirty times a session, and anything more than an acknowledgement
   * becomes the sound you turn the feature off to escape.
   */
  validate: [{ frequency: 659.3, delay: 0, duration: 0.07, gain: 0.14 }],

  /** A record fell. Three rising tones, the only fanfare the app allows itself. */
  record: [
    { frequency: 659.3, delay: 0, duration: 0.1, gain: 0.26 },
    { frequency: 880, delay: 0.1, duration: 0.1, gain: 0.26 },
    { frequency: 1318.5, delay: 0.2, duration: 0.26, gain: 0.3 },
  ],
};

/**
 * Plays a tone, optionally `when` seconds from now. The offset is scheduled on
 * the audio clock rather than with `setTimeout`: a countdown whose ticks drift
 * by 30 ms each is heard as sloppy long before it is heard as wrong.
 */
export function playTone(bus: AudioBus, tone: ToneId, when = 0): void {
  try {
    const start = bus.context.currentTime + Math.max(0, when);
    for (const partial of TONES[tone]) voice(bus, partial, start);
  } catch {
    // A tone that will not start is a degraded timer, never a broken screen.
  }
}

function voice(bus: AudioBus, partial: Partial_, base: number): void {
  const start = base + partial.delay;
  const oscillator = bus.context.createOscillator();
  const gain = bus.context.createGain();

  oscillator.type = partial.type ?? 'sine';
  oscillator.frequency.value = partial.frequency;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(partial.gain, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.duration);

  oscillator.connect(gain).connect(bus.master);
  oscillator.start(start);
  oscillator.stop(start + partial.duration + 0.04);
}
