/**
 * The room the announcer speaks in.
 *
 * **The character is not in the voice, it is in the loudspeaker.** What makes a
 * public-address announcement recognisable at one word is never the timbre of
 * the person reading — it is the hall it echoes through, and the small cheap
 * speaker it comes out of. A dry, close-mic'd voice saying "Repos terminé" is
 * a voice memo; the same take through this chain is an announcement.
 *
 * **A TTS cannot give you that**, and neither can a phone recording: reverb is
 * post-processing, not synthesis. Baking it into the clips would also freeze
 * it — one wrong decision and all twenty-three files are to redo. So the
 * colouring happens here, at play time, over whatever clips exist.
 *
 * **Which is why the clips must be recorded dry.** Reverb recorded into a file
 * and reverb added on top do not cancel out, they stack, and two halls make
 * mush. `public/voice/README.md` says so where someone about to record will
 * read it.
 *
 * **The room got smaller, on purpose.** This chain first imitated a station
 * concourse: band-limited to 170 Hz – 5.2 kHz like a PA horn, a wall repeat,
 * and 1.4 s of hall. It read as an announcement because that band-limiting is
 * what a cheap driver does. But the character moved — she is not calling across
 * a concourse any more, she is a system reporting from inside your head — and
 * that top cut was the whole illusion of the horn. Keeping it meant paying for
 * a fiction no longer in use, in the one currency that matters here: the
 * consonants that carry the words.
 *
 * So the low-pass is gone, the presence bump moved up to where French stops
 * actually live, and a shelf gives back the air. Two consequences, and the
 * second is why the space shrank in the same move: an open top makes the tail
 * far more audible than a dark one does at the same mix, so 1.4 s of hall that
 * sat politely under the old filter would now sound like a cathedral.
 *
 * The chain, in order:
 *
 * 1. **the tone** — a high-pass that takes the chest out, a presence bump at
 *    3.2 kHz where /t/ and /k/ are decided, and a high shelf that keeps the
 *    voice close rather than reproduced;
 * 2. **the slapback** — one quiet repeat, enough to say the voice is somewhere
 *    rather than pressed against the ear;
 * 3. **the room** — a short synthetic tail, procedural rather than a recorded
 *    impulse: an impulse response is a `.wav` to ship, to license and to
 *    precache, for something a decaying noise burst does convincingly.
 *
 * Nothing here is subtle by accident. The wet mix stays under a quarter: this
 * is meant to be heard in a gym over music, and intelligibility outranks
 * atmosphere every time.
 */

/** Everything the caller needs to route into, and toggle, the effect. */
export interface PublicAddress {
  /** Voices — and the announcement chime — connect here. */
  input: GainNode;
  /** Off routes the input straight through, dry. Applied immediately. */
  setEnabled: (enabled: boolean) => void;
}

const TONE = {
  /** Below this a voice carries nothing but rumble and handling noise. */
  highPassHz: 170,
  /**
   * Where French stops are decided. Measured on the clips: at 2.6 kHz a /t/
   * before a cluster reads as a /k/ — "trois" heard as "croix" — and moving the
   * bump up here is what separates them again.
   */
  presenceHz: 3_200,
  presenceGainDb: 4,
  /** The air a low-pass used to remove. Present, not sibilant. */
  shelfHz: 5_000,
  shelfGainDb: 4,
} as const;

const SLAPBACK = { seconds: 0.11, feedback: 0.17, mix: 0.18 } as const;
const HALL = { seconds: 0.6, decay: 2.6, mix: 0.22 } as const;

/**
 * Headroom on the coloured bus. The direct sound plus its two returns add up to
 * more energy than what came in, and a normalised clip pushed past 1 clips —
 * which on a phone speaker is heard as a voice that spits, not as a loud voice.
 */
const WET_TRIM = 0.8;

/**
 * The reverb tail's envelope: one at the impulse, silence at the end, and a
 * curve between the two. Exponential rather than linear — a room that fades in
 * a straight line sounds like a fade-out, not like a room.
 *
 * Pure, and separated from the noise it shapes, because this is the only part
 * of the effect that can be checked without an audio device.
 */
export function reverbEnvelope(samples: number, decay: number): Float32Array {
  const envelope = new Float32Array(Math.max(0, samples));
  for (let index = 0; index < envelope.length; index += 1) {
    envelope[index] = (1 - index / envelope.length) ** decay;
  }
  return envelope;
}

/** Decaying noise, two channels, which is a room as far as an ear is concerned. */
function hallImpulse(context: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const samples = Math.floor(context.sampleRate * seconds);
  const impulse = context.createBuffer(2, samples, context.sampleRate);
  const envelope = reverbEnvelope(samples, decay);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < samples; index += 1) {
      // Independent noise per channel: identical channels would collapse the
      // tail to the middle of the head, which is a mono delay, not a hall.
      data[index] = (Math.random() * 2 - 1) * (envelope[index] ?? 0);
    }
  }
  return impulse;
}

/**
 * Builds the chain between `input` and `destination`, and returns the switch.
 *
 * Never throws: a browser missing a node type gets a plain gain that passes the
 * voice through untouched. An announcer without its hall is a plainer
 * announcer, not a broken one.
 */
export function createPublicAddress(context: AudioContext, destination: AudioNode): PublicAddress {
  const input = context.createGain();

  try {
    const dry = context.createGain();
    const coloured = context.createGain();

    const highPass = context.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = TONE.highPassHz;

    const presence = context.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = TONE.presenceHz;
    presence.Q.value = 1;
    presence.gain.value = TONE.presenceGainDb;

    const air = context.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = TONE.shelfHz;
    air.gain.value = TONE.shelfGainDb;

    const speaker = context.createGain();
    input.connect(highPass).connect(presence).connect(air).connect(speaker);
    speaker.connect(coloured);

    const slap = context.createDelay(1);
    slap.delayTime.value = SLAPBACK.seconds;
    const slapFeedback = context.createGain();
    slapFeedback.gain.value = SLAPBACK.feedback;
    const slapMix = context.createGain();
    slapMix.gain.value = SLAPBACK.mix;
    speaker.connect(slap);
    // The one repeat feeds a quieter copy of itself: two or three returns, then
    // nothing. A wall, not a canyon.
    slap.connect(slapFeedback).connect(slap);
    slap.connect(slapMix).connect(coloured);

    const hall = context.createConvolver();
    hall.buffer = hallImpulse(context, HALL.seconds, HALL.decay);
    const hallMix = context.createGain();
    hallMix.gain.value = HALL.mix;
    speaker.connect(hall);
    hall.connect(hallMix).connect(coloured);

    // Both ends joined last, so a browser that throws halfway through leaves an
    // orphan chain connected to nothing rather than a second path to the
    // speakers on top of the fallback's.
    input.connect(dry).connect(destination);
    coloured.connect(destination);

    // Both paths exist at all times and only their gains move: rebuilding the
    // graph under a clip that is already playing cuts it off mid-word.
    const apply = (enabled: boolean): void => {
      dry.gain.value = enabled ? 0 : 1;
      coloured.gain.value = enabled ? WET_TRIM : 0;
    };
    apply(true);

    return { input, setEnabled: apply };
  } catch {
    input.connect(destination);
    return { input, setEnabled: () => undefined };
  }
}
