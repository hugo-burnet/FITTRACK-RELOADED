/**
 * Renders the announcer's script into `public/voice/*.mp3`.
 *
 * Runs **by hand, on your machine, never in CI and never in the app.** The key
 * it needs is a real secret, and non-negotiable rule n°3 says a secret has no
 * business in a bundle deployed to a public static site. So the flow is: you
 * run this once, you listen, you commit the mp3 files. The app only ever knows
 * about files.
 *
 *     export VOICE_API_KEY="..."     # ElevenLabs
 *     export VOICE_ID="..."          # the voice you picked, from your library
 *     node scripts/generate-voice.mjs                    # the whole script
 *     node scripts/generate-voice.mjs rest-over-1        # one line, re-cut
 *
 * Existing files are skipped unless `--force` is passed: re-rendering a line
 * you were happy with costs credits and, worse, gives you a slightly different
 * take of a sentence that sat next to fifteen others.
 *
 * `voiceScript.json` is the source of truth for both sides — the app reads it
 * to know which clips can exist, this script reads it to make them. A line
 * whose text changes is a file to re-render; that is why the text lives with
 * the settings that produced it rather than in `src/i18n/fr.ts`.
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('../src/audio/voiceScript.json', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../public/voice/', import.meta.url));

const API_KEY = process.env.VOICE_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const MODEL_ID = process.env.VOICE_MODEL ?? 'eleven_multilingual_v2';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((argument) => !argument.startsWith('--')));

if (!API_KEY || !VOICE_ID) {
  console.error(
    'VOICE_API_KEY et VOICE_ID sont requis.\n' +
      '  export VOICE_API_KEY="..." && export VOICE_ID="..."\n' +
      'Aucune de ces valeurs ne doit finir dans le dépôt.',
  );
  process.exit(1);
}

const { lines } = JSON.parse(await readFile(SCRIPT_PATH, 'utf8'));
const wanted = lines.filter((line) => only.size === 0 || only.has(line.id));

if (wanted.length === 0) {
  console.error(`Aucune ligne ne correspond à : ${[...only].join(', ')}`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

let written = 0;
let skipped = 0;

for (const line of wanted) {
  const file = join(OUT_DIR, `${line.id}.mp3`);

  if (!force && (await exists(file))) {
    skipped += 1;
    console.log(`· ${line.id} — déjà là`);
    continue;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: line.text,
        model_id: MODEL_ID,
        // The per-line settings are the whole point of keeping them in the
        // script: a countdown wants maximum stability, a record can afford
        // some colour. L'intonation fait tout.
        voice_settings: {
          stability: line.settings?.stability ?? 0.8,
          similarity_boost: line.settings?.similarity ?? 0.8,
          style: line.settings?.style ?? 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    console.error(`✗ ${line.id} — ${response.status} ${await response.text()}`);
    process.exitCode = 1;
    continue;
  }

  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  written += 1;
  console.log(`✓ ${line.id} — « ${line.text} »`);
  // L'indication de jeu ne sert à rien au moteur TTS ; elle sert à toi, au
  // moment où tu réécoutes et où tu décides de refaire la prise avec --force.
  if (line.direction) console.log(`    ${line.direction}`);
}

console.log(`\n${written} clip(s) écrit(s), ${skipped} conservé(s), dans public/voice/.`);
console.log('Écoute-les avant de commiter : un blanc en tête retarde tout le décompte.');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
