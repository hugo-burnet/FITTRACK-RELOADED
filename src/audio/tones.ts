import type { AudioBus } from './context';
import { impactPack } from './impactPack';

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
export type ToneId = 'tick' | 'repTap' | 'chime' | 'validate' | 'record';

interface Partial_ {
  frequency: number;
  /** Optional downward movement gives an impact a body without adding a sample. */
  endFrequency?: number;
  /** Seconds after the tone's own start. */
  delay: number;
  duration: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
}

/**
 * Which tones are *announcements* and go through the loudspeaker colouring.
 *
 * Only the chime. It is the two-note bell that introduces a sentence — an
 * airport, a station, a corridor — so it belongs to the same room as the words
 * that follow it, and hearing them in two different acoustics is worse than
 * hearing neither. Everything else stays dry: a tick smeared by a hall stops
 * being a beat, and the whole point of the countdown is that its beats land.
 */
const ANNOUNCED: Record<ToneId, boolean> = {
  tick: false,
  repTap: false,
  chime: true,
  validate: false,
  record: false,
};

const TONES: Record<ToneId, readonly Partial_[]> = {
  /** The cadence of the last three seconds. Dry, short, unmistakably a count. */
  tick: [{ frequency: 1046.5, delay: 0, duration: 0.06, gain: 0.22, type: 'square' }],

  /**
   * The repetition beat: a compact hangar latch, not a polite metronome.
   *
   * The falling triangle is the mass of the door, the saw and square are its
   * metal strike, and the delayed low sine is the bay answering just after the
   * lock lands. It is deliberately louder and wider than the old wooden tap,
   * but all four layers die inside 220 ms so twelve reps never turn into a
   * continuous drone over the music.
   */
  repTap: [
    {
      frequency: 150,
      endFrequency: 72,
      delay: 0,
      duration: 0.16,
      gain: 0.3,
      type: 'triangle',
      attack: 0.002,
    },
    {
      frequency: 680,
      endFrequency: 260,
      delay: 0,
      duration: 0.09,
      gain: 0.16,
      type: 'sawtooth',
      attack: 0.001,
    },
    {
      frequency: 1_620,
      endFrequency: 900,
      delay: 0.003,
      duration: 0.038,
      gain: 0.07,
      type: 'square',
      attack: 0.001,
    },
    {
      frequency: 240,
      endFrequency: 180,
      delay: 0.028,
      duration: 0.19,
      gain: 0.12,
      type: 'sine',
      attack: 0.004,
    },
  ],

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
    if (tone === 'repTap' && impactPack.play(bus, when)) return;
    const start = bus.context.currentTime + Math.max(0, when);
    const destination = ANNOUNCED[tone] ? bus.voice : bus.master;
    for (const partial of TONES[tone]) voice(bus, destination, partial, start);
  } catch {
    // A tone that will not start is a degraded timer, never a broken screen.
  }
}

function voice(bus: AudioBus, destination: AudioNode, partial: Partial_, base: number): void {
  const start = base + partial.delay;
  const oscillator = bus.context.createOscillator();
  const gain = bus.context.createGain();

  oscillator.type = partial.type ?? 'sine';
  oscillator.frequency.value = partial.frequency;
  if (partial.endFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      partial.endFrequency,
      start + partial.duration,
    );
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(partial.gain, start + (partial.attack ?? 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.duration);

  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + partial.duration + 0.04);
}
