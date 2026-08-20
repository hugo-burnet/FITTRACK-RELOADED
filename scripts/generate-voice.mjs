/**
 * Renders the announcer's script into `public/voice/*.mp3`.
 *
 * Runs **by hand, on your machine, never in CI and never in the app.** The key
 * it needs is a real secret, and non-negotiable rule n°3 says a secret has no
 * business in a bundle deployed to a public static site. So the flow is: you
 * run this once, you listen, you commit the mp3 files. The app only ever knows
 * about files.
 *
 *     node --env-file=.env scripts/generate-voice.mjs             # everything
 *     node --env-file=.env scripts/generate-voice.mjs rest-count  # one unit
 *     node --env-file=.env scripts/generate-voice.mjs --force rest-count
 *
 * `voiceScript.json` is the source of truth for both sides — the app reads it
 * to know which clips can exist, this script reads it to make them. A line
 * whose text changes is a file to re-render; that is why the text lives with
 * the settings that produced it rather than in `src/i18n/fr.ts`.
 *
 * Three things here are not obvious, and each was paid for in credits.
 *
 * **Every generation carries a lead-in that is thrown away.** The first word a
 * model speaks is reliably its worst — it settles during it. A one-word
 * lead-in takes that hit, and doubles as the cutting landmark: the first sound
 * block is the lead-in, everything after it is the line.
 *
 * **A countdown is one generation, not three.** Three words asked for
 * separately come back with three unrelated melodies; asked for together they
 * share one. `groups` in the script describes that, and the take is cut apart
 * here.
 *
 * **A take is measured before it is kept.** v3 speaks a short isolated word
 * differently every time, and roughly one attempt in six holds a straight
 * melodic line. Rather than make you listen to the other five, the acceptance
 * rules in the script are checked and the take asked for again — see
 * `scripts/voice/analysis.mjs` for what is measured, and why those two numbers
 * and no others.
 *
 * Existing files are skipped unless `--force` is passed: re-rendering a line
 * you were happy with costs credits and, worse, gives you a slightly different
 * take of a sentence that sat next to fifteen others.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  contourShape,
  normalisePeak,
  pitchTrack,
  soundBlocks,
  trimWithFades,
} from './voice/analysis.mjs';
import { encodeMp3 } from './voice/encode.mjs';
import { SAMPLE_RATE, SpeechError, settingsFor, speak } from './voice/speech.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('../src/audio/voiceScript.json', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/voice/', import.meta.url));
const CACHE_DIR = fileURLToPath(new URL('../.voice-cache/', import.meta.url));

const API_KEY = process.env.VOICE_API_KEY;
const VOICE_ID = process.env.VOICE_ID;

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((argument) => !argument.startsWith('--')));

if (!API_KEY || !VOICE_ID) {
  console.error(
    'VOICE_API_KEY et VOICE_ID sont requis.\n' +
      '  Mets-les dans .env (ignoré par git), puis lance :\n' +
      '    node --env-file=.env scripts/generate-voice.mjs\n' +
      'Aucune de ces valeurs ne doit finir dans le dépôt.',
  );
  process.exit(1);
}

function argValue(flag) {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
}

const script = JSON.parse(await readFile(SCRIPT_PATH, 'utf8'));
const MODEL_ID = process.env.VOICE_MODEL ?? script.generation?.model ?? 'eleven_multilingual_v2';
const LEAD_IN = script.generation?.leadIn ?? 'Initialisation.';
const ATTEMPTS = Number(argValue('--attempts') ?? script.generation?.attempts ?? 12);

/**
 * What one generation produces: a single line, or a group cut into several.
 *
 * Both shapes go through the same loop below, which is why a group is not a
 * special case there — only its acceptance rules are stricter.
 */
function units() {
  const grouped = new Set((script.groups ?? []).flatMap((group) => group.clips));

  const fromGroups = (script.groups ?? []).map((group) => ({
    id: group.id,
    text: group.text,
    clips: group.clips,
    accept: group.accept ?? {},
    line: script.lines.find((entry) => entry.id === group.clips[0]),
  }));

  const fromLines = script.lines
    .filter((line) => !grouped.has(line.id))
    .map((line) => ({
      id: line.id,
      text: line.tag ? `${line.tag} ${line.text}` : line.text,
      clips: [line.id],
      accept: {},
      line,
    }));

  return [...fromGroups, ...fromLines];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Turn one take into clips, or explain why it is not usable.
 *
 * The lead-in is dropped by position, never by threshold: whatever it did, the
 * clips are the blocks that follow it. For a group the count has to be exact —
 * one block too many means the model spoke a tag or took a breath, and the
 * mapping of words to files can no longer be trusted.
 */
function clipsFromTake(samples, unit) {
  const blocks = soundBlocks(samples, SAMPLE_RATE);
  const wanted = unit.clips.length;

  if (blocks.length < 2) return { error: "aucune parole après l'amorce" };

  if (wanted === 1) {
    // A single line keeps its internal pauses: everything after the lead-in is
    // one clip, however many blocks the sentence happens to break into.
    const spoken = blocks.slice(1);
    const first = spoken[0];
    const last = spoken[spoken.length - 1];
    return {
      clips: [
        {
          id: unit.clips[0],
          startSample: first.startSample,
          endSample: last.endSample,
          durationMs: ((last.endSample - first.startSample) / SAMPLE_RATE) * 1000,
        },
      ],
    };
  }

  if (blocks.length !== wanted + 1) {
    return { error: `${blocks.length - 1} bloc(s) après l'amorce, ${wanted} attendus` };
  }

  const words = blocks.slice(-wanted);
  const {
    minMs = 0,
    maxMs = Infinity,
    maxReversals = Infinity,
    sameDirection = false,
  } = unit.accept;
  const shapes = words.map((word) =>
    contourShape(pitchTrack(samples, SAMPLE_RATE, word.startSample, word.endSample)),
  );

  for (const [index, word] of words.entries()) {
    const id = unit.clips[index];
    if (word.durationMs < minMs || word.durationMs > maxMs) {
      return { error: `« ${id} » dure ${Math.round(word.durationMs)} ms` };
    }
    if (!shapes[index]) return { error: `« ${id} » n'a pas de hauteur mesurable` };
    if (shapes[index].reversals > maxReversals) {
      return { error: `« ${id} » ondule (${shapes[index].reversals} inversions)` };
    }
  }

  if (sameDirection && new Set(shapes.map((shape) => Math.sign(shape.netSemitones))).size > 1) {
    return { error: 'les mots ne vont pas tous dans le même sens' };
  }

  return {
    clips: words.map((word, index) => ({
      id: unit.clips[index],
      startSample: word.startSample,
      endSample: word.endSample,
      durationMs: word.durationMs,
    })),
  };
}

/** Was this unit asked for, by its own name or by one of its clips? */
function askedFor(unit) {
  if (only.size === 0) return true;
  return only.has(unit.id) || unit.clips.some((id) => only.has(id));
}

await mkdir(OUT_DIR, { recursive: true });

let written = 0;
let skipped = 0;
let failed = 0;

for (const unit of units()) {
  if (!askedFor(unit)) continue;

  const targets = unit.clips.map((id) => join(OUT_DIR, `${id}.mp3`));
  if (!force && (await Promise.all(targets.map(exists))).every(Boolean)) {
    skipped += unit.clips.length;
    console.log(`· ${unit.id} — déjà là`);
    continue;
  }

  let kept = null;
  const refusals = [];

  for (let attempt = 0; attempt < ATTEMPTS && !kept; attempt += 1) {
    let samples;
    try {
      samples = await speak({
        apiKey: API_KEY,
        voiceId: VOICE_ID,
        modelId: MODEL_ID,
        text: `${LEAD_IN}\n\n${unit.text}`,
        settings: settingsFor(MODEL_ID, unit.line),
        attempt,
        cacheDir: CACHE_DIR,
      });
    } catch (error) {
      if (!(error instanceof SpeechError)) throw error;
      console.error(`✗ ${unit.id} — ${error.message}`);
      process.exitCode = 1;
      break;
    }

    const outcome = clipsFromTake(samples, unit);
    if (outcome.error) {
      refusals.push(outcome.error);
      continue;
    }
    kept = { samples, clips: outcome.clips };
  }

  if (!kept) {
    failed += unit.clips.length;
    console.error(`✗ ${unit.id} — aucune prise retenue`);
    for (const reason of refusals.slice(0, 4)) console.error(`    ${reason}`);
    process.exitCode = 1;
    continue;
  }

  for (const clip of kept.clips) {
    const cut = trimWithFades(kept.samples, SAMPLE_RATE, {
      fromSample: clip.startSample,
      toSample: clip.endSample,
    });
    const levelled = normalisePeak(cut, { targetDb: -3, maxGainDb: 12 });
    await writeFile(join(OUT_DIR, `${clip.id}.mp3`), encodeMp3(levelled, SAMPLE_RATE));
    written += 1;

    const line = script.lines.find((entry) => entry.id === clip.id);
    console.log(`✓ ${clip.id} — « ${line?.text ?? ''} » (${Math.round(clip.durationMs)} ms)`);
    // The direction is no use to the engine; it is for you, at the moment you
    // listen back and decide whether to ask for another take with --force.
    if (line?.direction) console.log(`    ${line.direction}`);
  }
  if (refusals.length > 0) {
    console.log(`    ${refusals.length} prise(s) refusée(s) avant celle-ci`);
  }
}

console.log(`\n${written} clip(s) écrit(s), ${skipped} conservé(s), ${failed} en échec.`);
console.log('Écoute-les avant de commiter : le script mesure la mélodie, pas le sens.');
