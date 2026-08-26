#!/usr/bin/env node
// Extraction de production des 61 fragments de prose de F1.
//
// POURQUOI PAS run-e5-llm-benchmark.mjs : ce runner passe par
// `loadBenchmarkInputs`, qui vérifie les hachages d'un manifeste gelé, impose
// une répartition F2/F3 et plafonne à 100 fragments. Ce sont des garde-fous de
// *banc*, faits pour qu'une mesure reste comparable — les desserrer pour faire
// passer F1 abîmerait ce qu'ils protègent.
//
// Ce script réutilise en revanche `extractProseFragment`, donc exactement la
// même chaîne que le banc : prompt versionné, assertion anti-fuite du GOLD,
// validation canonique, matérialisation des spans UTF-8 et réparation d'ancres.
// Seule la sélection des fragments change.
//
// Sortie additive : `candidates/e5-corpus-f1.json`. On ne touche pas à
// `e5-corpus.json`, dont l'empreinte est vérifiée par les tests du contrat.
//
// Reprise : relancer saute les fragments déjà acceptés. Un run d'une heure ne
// doit pas repartir de zéro parce qu'un jeton a expiré au milieu.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrokCliAdapter } from './e5-llm/adapters.mjs';
import { extractProseFragment } from './e5-llm/extractor.mjs';
import { createE5ProviderPredictionSchema } from './e5-llm/provider-dto.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');
const outputPath = join(root, 'candidates/e5-corpus-f1.json');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const concurrency = Number(option('concurrency', 2));
const limit = Number(option('limit', Infinity));

const readJson = (relative) => JSON.parse(readFileSync(join(root, relative), 'utf8'));

const fragments = readJson('candidates/e5-prose-fragments-f1.json').fragments.slice(0, limit);
const predictionSchema = readJson('benchmark/e5/v0/prediction.schema.json');
const providerPredictionSchema = createE5ProviderPredictionSchema(predictionSchema);
const runConfig = JSON.parse(readFileSync(join(benchmarkRoot, 'config.grok.json'), 'utf8'));

const citationDocument = readJson('candidates/e5-prose-citation-occurrences.json');
const citationsByFragment = new Map();
for (const citation of citationDocument.candidates) {
  if (!citationsByFragment.has(citation.fragmentRef)) citationsByFragment.set(citation.fragmentRef, []);
  citationsByFragment.get(citation.fragmentRef).push(citation);
}

const VOCABULARY_NAMES = [
  'knowledge-type',
  'epistemic-status',
  'confidence-aspect',
  'confidence-level',
  'directness',
  'evidence-type',
  'clinical-evidence-level',
  'domain',
];
const vocabularies = Object.fromEntries(
  VOCABULARY_NAMES.map((name) => [
    name,
    readJson(`vocabularies/${name}.vocab.json`).terms.map((item) => item.term),
  ]),
);

const previous = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
const done = new Map((previous?.results ?? []).map((result) => [result.fragmentId, result]));
const pending = fragments.filter((fragment) => !done.has(fragment.fragmentId));

console.log(
  `F1 prose : ${fragments.length} fragments, ${done.size} deja faits, ${pending.length} a extraire ` +
    `(concurrence ${concurrency}, modele ${runConfig.model ?? 'defaut de la CLI'})`,
);

const adapter = createGrokCliAdapter({ binaryPath: process.env.GROK_BIN ?? 'grok' });
const results = [...done.values()];
let completed = 0;
let costUsd = 0;

function persist() {
  const accepted = results.filter((result) => result.status !== 'REJECTED');
  const claims = accepted.flatMap((result) => result.prediction?.claims ?? []);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: '1.0.0-e5-corpus-f1',
        corpusFileId: 'corpus.f1.programmation-hypertrophie',
        promptVersion: runConfig.promptVersion,
        provider: runConfig.provider,
        model: runConfig.model,
        fragmentCount: fragments.length,
        extractedCount: results.length,
        acceptedCount: accepted.length,
        rejectedCount: results.length - accepted.length,
        claimCount: claims.length,
        costUsd: Number(costUsd.toFixed(6)),
        results,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function worker(queue) {
  for (;;) {
    const fragment = queue.shift();
    if (fragment === undefined) return;
    try {
      const result = await extractProseFragment(
        {
          fragment,
          citationCatalog: citationsByFragment.get(fragment.fragmentId) ?? [],
          vocabularies,
          predictionSchema,
          providerPredictionSchema,
          runConfig,
        },
        { modelAdapter: adapter },
      );
      results.push(result);
      costUsd += result.usageByCallType?.total?.costUsd ?? 0;
      completed += 1;
      const claims = result.prediction?.claims?.length ?? 0;
      console.log(
        `[${completed}/${pending.length}] ${fragment.fragmentId} ${result.status} ` +
          `${claims} claims  cumul $${costUsd.toFixed(4)}`,
      );
    } catch (error) {
      // Un fragment qui explose ne doit pas emporter le run : on le consigne et
      // on continue. La reprise le retentera puisqu'il n'est pas dans done.
      completed += 1;
      console.log(`[${completed}/${pending.length}] ${fragment.fragmentId} ERREUR ${error.message}`);
    }
    // Écriture après chaque fragment : un run d'une heure ne perd jamais plus
    // d'un fragment, quelle que soit la façon dont il s'arrête.
    persist();
  }
}

const queue = [...pending];
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker(queue)));
persist();

const accepted = results.filter((result) => result.status !== 'REJECTED').length;
const claims = results.flatMap((result) => result.prediction?.claims ?? []).length;
console.log(
  `\nTermine : ${accepted}/${results.length} fragments acceptes, ${claims} affirmations, ` +
    `$${costUsd.toFixed(4)} -> ${outputPath}`,
);
