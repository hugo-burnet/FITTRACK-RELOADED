/**
 * Measuring a take, so that a machine can reject it before a human hears it.
 *
 * A text-to-speech model asked for three isolated words does not produce three
 * comparable takes: it invents a melody for each, and a different one every
 * time. Listening to twenty of them to find the one that does not limp is not
 * a workflow. Everything here exists so `generate-voice.mjs` can decide on its
 * own whether to keep a take or ask for another.
 *
 * Two things turned out to matter, and only two:
 *
 * 1. **where the words are** — a generation carries a throwaway lead-in and,
 *    for a countdown, three words in one file. `soundBlocks` finds them;
 * 2. **the shape of the melody inside each word** — not its average pitch,
 *    which is remarkably stable, but whether the note holds a direction.
 *    A word that dips and climbs back reads as a wobble, and three words that
 *    each do something different read as a limp.
 *
 * Pure on purpose, and separate from every byte of network and file I/O: this
 * is the part that can be checked without an audio device, a key, or a credit.
 */

const FULL_SCALE = 32_768;

/**
 * Runs of sound, separated by silence.
 *
 * `gapMs` is what makes this useful rather than arbitrary: a stop consonant is
 * a real silence inside a word, so the tolerance has to be longer than a /t/
 * closure and shorter than the pause between two spoken lines. `minDurationMs`
 * throws away the click or breath that would otherwise count as a word and
 * shift every index after it.
 */
export function soundBlocks(samples, sampleRate, options = {}) {
  const { threshold = 0.02, gapMs = 50, minDurationMs = 40 } = options;
  const limit = threshold * FULL_SCALE;
  const gap = (gapMs / 1000) * sampleRate;
  const minimum = (minDurationMs / 1000) * sampleRate;

  const blocks = [];
  let start = -1;
  let lastLoud = -1;

  const close = () => {
    if (start >= 0 && lastLoud - start >= minimum) {
      blocks.push({
        startSample: start,
        endSample: lastLoud,
        startMs: (start / sampleRate) * 1000,
        durationMs: ((lastLoud - start) / sampleRate) * 1000,
      });
    }
    start = -1;
  };

  for (let index = 0; index < samples.length; index += 1) {
    if (Math.abs(samples[index]) > limit) {
      if (start < 0) start = index;
      lastLoud = index;
    } else if (start >= 0 && index - lastLoud > gap) {
      close();
    }
  }
  close();

  return blocks;
}

/**
 * The fundamental frequency, sampled every few milliseconds.
 *
 * Autocorrelation rather than anything cleverer: a voice is periodic, the
 * period is what we want, and the search range 70–350 Hz covers any human
 * speaker while excluding the octave errors a wider range invites. Frames too
 * quiet or too aperiodic to have a pitch are dropped rather than guessed —
 * a fabricated value here would become a fabricated verdict downstream.
 */
export function pitchTrack(samples, sampleRate, from = 0, to = samples.length, options = {}) {
  const { windowMs = 30, hopMs = 5, minHz = 70, maxHz = 350, confidence = 0.5 } = options;
  const window = Math.floor((windowMs / 1000) * sampleRate);
  const hop = Math.floor((hopMs / 1000) * sampleRate);
  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  const track = [];
  for (let at = from; at + window < to; at += hop) {
    let energy = 0;
    for (let i = 0; i < window; i += 1) energy += samples[at + i] * samples[at + i];
    if (energy < 1e6) continue;

    let best = 0;
    let bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      for (let i = 0; i + lag < window; i += 1) sum += samples[at + i] * samples[at + i + lag];
      const normalised = sum / energy;
      if (normalised > best) {
        best = normalised;
        bestLag = lag;
      }
    }
    if (best > confidence && bestLag > 0) track.push(sampleRate / bestLag);
  }

  return track;
}

/**
 * What the melody does, in the two numbers that decide whether a take is kept.
 *
 * `reversals` is the one that matters. A word whose pitch holds one direction
 * sounds spoken; a word that changes its mind sounds like a wobble, and that
 * is what a listener calls "robotic" without being able to name it. The 0.08
 * semitone deadband is the estimator's own noise — without it, a perfectly
 * flat note counts a dozen reversals and every take is rejected.
 *
 * `netSemitones` compares words to each other: three words that all fall are a
 * countdown, three words that disagree about which way to go are a limp.
 */
export function contourShape(track, options = {}) {
  const { deadbandSemitones = 0.08 } = options;
  if (!Array.isArray(track) || track.length < 4) return null;

  const semitones = track.map((hz) => 12 * Math.log2(hz / track[0]));

  let reversals = 0;
  let direction = 0;
  for (let i = 1; i < semitones.length; i += 1) {
    const step = semitones[i] - semitones[i - 1];
    if (Math.abs(step) < deadbandSemitones) continue;
    const next = step > 0 ? 1 : -1;
    if (direction !== 0 && next !== direction) reversals += 1;
    direction = next;
  }

  return {
    netSemitones: semitones[semitones.length - 1],
    spanSemitones: Math.max(...semitones) - Math.min(...semitones),
    reversals,
  };
}

/**
 * One clip, cut out of a longer take.
 *
 * The lead is generous and, above all, **constant**: every clip carries the
 * same amount of silence before its first sound, which is what stops a
 * countdown from limping when one word happens to start faster than another.
 * The fades are not cosmetic — a cut through a non-zero sample is a step, and
 * a step is a click, which on a phone speaker is louder than the word.
 */
export function trimWithFades(samples, sampleRate, options) {
  const { fromSample, toSample, leadMs = 80, tailMs = 120, fadeMs = 6 } = options;
  const lead = Math.floor((leadMs / 1000) * sampleRate);
  const tail = Math.floor((tailMs / 1000) * sampleRate);

  const start = Math.max(0, fromSample - lead);
  const end = Math.min(samples.length, toSample + tail);
  const cut = Int16Array.from(samples.subarray(start, end));

  const fade = Math.min(Math.floor((fadeMs / 1000) * sampleRate), Math.floor(cut.length / 2));
  for (let i = 0; i < fade; i += 1) {
    const gain = i / fade;
    cut[i] = Math.round(cut[i] * gain);
    cut[cut.length - 1 - i] = Math.round(cut[cut.length - 1 - i] * gain);
  }

  return cut;
}

/**
 * One clip, brought to a common peak level.
 *
 * Three words of a countdown came out at −1.2, −5.9 and −6.0 dBFS from the
 * same take: nearly five decibels between the first word and its neighbours,
 * which is heard not as a louder recording but as a word being *leaned on* —
 * the one thing the script's own direction forbids.
 *
 * The target sits below full scale on purpose. `publicAddress` sums the dry
 * voice with two wet returns, so a clip normalised to 0 dBFS clips the bus,
 * and a clipped voice on a phone speaker spits rather than sounds loud.
 *
 * `maxGainDb` is the safety rail: a take that needs more than this to reach
 * the target is a quiet take, and lifting it that far lifts its noise floor
 * with it. Better a clip slightly under than a clip that hisses.
 */
export function normalisePeak(samples, options = {}) {
  const { targetDb = -3, maxGainDb = 24 } = options;

  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak === 0) return samples;

  const target = 10 ** (targetDb / 20) * FULL_SCALE;
  const gain = Math.min(target / peak, 10 ** (maxGainDb / 20));

  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = Math.max(-32_768, Math.min(32_767, Math.round(samples[i] * gain)));
  }
  return out;
}
