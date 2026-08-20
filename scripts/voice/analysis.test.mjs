import { describe, expect, it } from 'vitest';

import {
  contourShape,
  normalisePeak,
  pitchTrack,
  soundBlocks,
  trimWithFades,
} from './analysis.mjs';

const RATE = 24_000;

/** A sine of `hz`, `seconds` long, at `amplitude` of full scale. */
function tone(hz, seconds, amplitude = 0.5) {
  const samples = new Int16Array(Math.round(seconds * RATE));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.round(Math.sin((2 * Math.PI * hz * i) / RATE) * amplitude * 32767);
  }
  return samples;
}

function silence(seconds) {
  return new Int16Array(Math.round(seconds * RATE));
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Int16Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

describe('soundBlocks', () => {
  it('finds one block per burst of sound', () => {
    const samples = concat(silence(0.2), tone(200, 0.3), silence(0.4), tone(200, 0.25));
    const blocks = soundBlocks(samples, RATE);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].startMs).toBeCloseTo(200, -1);
    expect(blocks[0].durationMs).toBeCloseTo(300, -1);
    expect(blocks[1].durationMs).toBeCloseTo(250, -1);
  });

  it('does not split on a gap shorter than the tolerance', () => {
    // 20 ms of silence inside a word is a stop consonant, not a word boundary.
    const samples = concat(tone(200, 0.15), silence(0.02), tone(200, 0.15));

    expect(soundBlocks(samples, RATE, { gapMs: 50 })).toHaveLength(1);
  });

  it('ignores a blip too short to be a word', () => {
    const samples = concat(tone(200, 0.3), silence(0.3), tone(200, 0.01));

    expect(soundBlocks(samples, RATE, { minDurationMs: 40 })).toHaveLength(1);
  });

  it('returns nothing for silence', () => {
    expect(soundBlocks(silence(1), RATE)).toEqual([]);
  });
});

describe('pitchTrack', () => {
  it('recovers the frequency of a steady tone', () => {
    const samples = tone(180, 0.4);
    const track = pitchTrack(samples, RATE, 0, samples.length);

    expect(track.length).toBeGreaterThan(10);
    for (const hz of track) expect(hz).toBeCloseTo(180, -1);
  });

  it('follows a tone that changes pitch', () => {
    const samples = concat(tone(160, 0.25), tone(240, 0.25));
    const track = pitchTrack(samples, RATE, 0, samples.length);

    expect(track[0]).toBeCloseTo(160, -1);
    expect(track[track.length - 1]).toBeCloseTo(240, -1);
  });
});

describe('contourShape', () => {
  it('reports a steady fall as one direction and no reversal', () => {
    const shape = contourShape([220, 215, 210, 205, 200, 195]);

    expect(shape.reversals).toBe(0);
    expect(shape.netSemitones).toBeLessThan(0);
  });

  it('counts a fall then a rise as one reversal', () => {
    const shape = contourShape([220, 210, 200, 210, 220]);

    expect(shape.reversals).toBe(1);
  });

  it('ignores wobble below the noise floor of the estimator', () => {
    // Half a hertz either way is measurement noise, not a change of direction.
    const shape = contourShape([200, 199.8, 200.1, 199.9, 200.2, 200]);

    expect(shape.reversals).toBe(0);
  });

  it('has no shape to report for too few points', () => {
    expect(contourShape([200, 210])).toBeNull();
  });
});

describe('trimWithFades', () => {
  it('keeps the requested span plus its padding', () => {
    const samples = tone(200, 1);
    const cut = trimWithFades(samples, RATE, {
      fromSample: Math.round(0.4 * RATE),
      toSample: Math.round(0.6 * RATE),
      leadMs: 80,
      tailMs: 120,
      fadeMs: 6,
    });

    expect(cut.length).toBeCloseTo(Math.round(0.4 * RATE), -3);
  });

  it('starts and ends at zero, so a cut cannot click', () => {
    const samples = tone(200, 1);
    const cut = trimWithFades(samples, RATE, {
      fromSample: Math.round(0.4 * RATE),
      toSample: Math.round(0.6 * RATE),
      leadMs: 0,
      tailMs: 0,
      fadeMs: 6,
    });

    expect(cut[0]).toBe(0);
    expect(cut[cut.length - 1]).toBe(0);
  });

  it('does not read past the ends of the source', () => {
    const samples = tone(200, 0.2);
    const cut = trimWithFades(samples, RATE, {
      fromSample: 0,
      toSample: samples.length,
      leadMs: 500,
      tailMs: 500,
      fadeMs: 6,
    });

    expect(cut.length).toBe(samples.length);
  });
});

describe('normalisePeak', () => {
  it('brings a quiet clip up to the target', () => {
    const quiet = Int16Array.from({ length: 100 }, (_, i) => (i === 50 ? 3276 : 0)); // −20 dBFS
    const loud = normalisePeak(quiet, { targetDb: -3 });

    expect(20 * Math.log10(Math.max(...loud.map(Math.abs)) / 32768)).toBeCloseTo(-3, 1);
  });

  it('brings a hot clip down to the target', () => {
    const hot = Int16Array.from({ length: 100 }, (_, i) => (i === 50 ? 32767 : 0)); // 0 dBFS
    const tamed = normalisePeak(hot, { targetDb: -3 });

    expect(20 * Math.log10(Math.max(...tamed.map(Math.abs)) / 32768)).toBeCloseTo(-3, 1);
  });

  it('leaves silence alone rather than amplifying nothing', () => {
    const nothing = new Int16Array(100);

    expect(Array.from(normalisePeak(nothing))).toEqual(Array.from(nothing));
  });

  it('refuses to lift a clip by more than the ceiling, which would raise its noise', () => {
    const veryQuiet = Int16Array.from({ length: 100 }, (_, i) => (i === 50 ? 32 : 0)); // −60 dBFS
    const lifted = normalisePeak(veryQuiet, { targetDb: -3, maxGainDb: 12 });
    const gainDb = 20 * Math.log10(Math.max(...lifted.map(Math.abs)) / 32);

    expect(gainDb).toBeCloseTo(12, 1);
  });
});
