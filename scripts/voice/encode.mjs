/**
 * Sixteen-bit samples in, one mp3 out.
 *
 * The generator asks ElevenLabs for raw PCM rather than mp3 and encodes here,
 * at the very end. That ordering is the whole point: cutting a clip out of an
 * mp3 means cutting between frames that share a bit reservoir, and the first
 * frames after such a cut decode to noise — a burst of it, landing exactly on
 * the consonant the clip starts with. Cutting in the signal and encoding once
 * afterwards costs one encoding pass in total, where the obvious order costs
 * two and a click.
 */
import lame from '@breezystack/lamejs';

const Mp3Encoder = lame.Mp3Encoder ?? lame.default?.Mp3Encoder;

/** MPEG granule size. Feeding the encoder in this unit keeps it happy. */
const FRAME_SAMPLES = 1152;

export function encodeMp3(samples, sampleRate, kbps = 128) {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks = [];

  for (let at = 0; at < samples.length; at += FRAME_SAMPLES) {
    const chunk = encoder.encodeBuffer(samples.subarray(at, at + FRAME_SAMPLES));
    if (chunk.length > 0) chunks.push(Buffer.from(chunk));
  }
  const rest = encoder.flush();
  if (rest.length > 0) chunks.push(Buffer.from(rest));

  return Buffer.concat(chunks);
}
