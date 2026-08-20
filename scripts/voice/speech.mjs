/**
 * The one place that talks to ElevenLabs.
 *
 * Every take is written to `.voice-cache/` before anything looks at it. That
 * is not an optimisation, it is a rule learned the hard way: a bug in the
 * *analysis* must never cost a second generation. The cache is keyed by what
 * was asked for, so re-running after fixing a measurement re-reads the disk
 * and spends nothing.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 24 kHz because 44.1 is a Pro-tier feature, and 12 kHz of bandwidth is more than a voice needs. */
export const SAMPLE_RATE = 24_000;

export class SpeechError extends Error {
  constructor(status, detail) {
    super(`${status} ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

function keyOf(request) {
  return createHash('sha1').update(JSON.stringify(request)).digest('hex').slice(0, 16);
}

/**
 * One take, as signed 16-bit mono samples.
 *
 * `attempt` is part of the cache key on purpose: asking for the same line
 * twice is how a bad take gets replaced, so two attempts must not collapse
 * into one cached file.
 */
export async function speak({ apiKey, voiceId, modelId, text, settings, attempt = 0, cacheDir }) {
  const request = { voiceId, modelId, text, settings, attempt };
  const cached = cacheDir ? join(cacheDir, `${keyOf(request)}.pcm`) : null;

  if (cached) {
    try {
      const bytes = await readFile(cached);
      return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
    } catch {
      // Not cached yet — fall through and pay for it.
    }
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_${SAMPLE_RATE}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: settings }),
    },
  );

  if (!response.ok) throw new SpeechError(response.status, (await response.text()).slice(0, 300));

  const bytes = Buffer.from(await response.arrayBuffer());
  if (cached) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cached, bytes);
  }
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
}

/**
 * Settings for the model in use.
 *
 * v3 documents `stability` as three discrete choices rather than a slider, and
 * has no `style` at all. The API accepts anything and silently reinterprets
 * it, which is worse than refusing — hence this explicit mapping rather than
 * passing the script's numbers through and hoping.
 */
export function settingsFor(modelId, line) {
  const stability = line?.settings?.stability ?? 0.8;
  const similarity = line?.settings?.similarity ?? 0.8;

  if (modelId.startsWith('eleven_v3')) {
    // Creative 0.0 · Natural 0.5 · Robust 1.0. Anything above 0.7 wants Robust.
    const snapped = stability >= 0.7 ? 1 : stability >= 0.3 ? 0.5 : 0;
    return { stability: snapped, similarity_boost: similarity };
  }

  return {
    stability,
    similarity_boost: similarity,
    style: line?.settings?.style ?? 0,
    use_speaker_boost: true,
  };
}
