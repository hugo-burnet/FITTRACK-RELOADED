#!/usr/bin/env node
// Sonde Grok CLI — un seul fragment réel, le vrai prompt, le vrai schéma.
//
// Elle répond à trois questions avant qu'on engage 103 fragments :
//   1. la CLI produit-elle un DTO conforme au schéma fournisseur ?
//   2. les supportAnchors retombent-ils sur les octets du fragment ?
//   3. combien coûte un fragment, mesuré et non extrapolé ?
//
// Elle n'écrit rien dans le corpus et ne touche à aucun manifeste gelé.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGrokCliAdapter } from './e5-llm/adapters.mjs';
import { createE5ProviderPredictionSchema } from './e5-llm/provider-dto.mjs';
import { buildPromptInput, E5_SYSTEM_PROMPT, assertNoGoldenLeak } from './e5-llm/prompt.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');

const fragments = JSON.parse(
  readFileSync(join(root, 'candidates/e5-prose-fragments.json'), 'utf8'),
).fragments;

const wanted = process.argv[2];
const fragment = wanted
  ? fragments.find((item) => item.fragmentId === wanted)
  : fragments.find((item) => (item.rawText ?? item.text ?? '').length > 1200);
if (!fragment) throw new Error('fragment introuvable');

const canonicalSchema = JSON.parse(
  readFileSync(join(benchmarkRoot, 'prediction.schema.json'), 'utf8'),
);
const providerSchema = createE5ProviderPredictionSchema(canonicalSchema);

const input = buildPromptInput({
  fragment,
  citationCatalog: [],
  vocabularies: {},
  coverageUnits: [],
});
// Le prompt ne doit jamais contenir de matière du golden set : c'est la garde
// qui rend la mesure honnête, et elle vaut autant pour une sonde manuelle.
assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${input}`);

const adapter = createGrokCliAdapter({ binaryPath: process.env.GROK_BIN ?? 'grok' });

const started = Date.now();
const response = await adapter.generate({
  systemPrompt: E5_SYSTEM_PROMPT,
  input,
  outputSchema: providerSchema,
  runConfig: { model: process.env.GROK_MODEL ?? null, maxOutputTokens: 16000 },
});

let parsed = null;
let parseError = null;
try {
  parsed = JSON.parse(response.rawResponse);
} catch (error) {
  parseError = error.message;
}

const claims = Array.isArray(parsed?.claims) ? parsed.claims : [];
const fragmentText = fragment.rawText ?? fragment.text ?? '';
let anchorsTotal = 0;
let anchorsFound = 0;
for (const claim of claims) {
  for (const anchor of claim.supportAnchors ?? []) {
    anchorsTotal += 1;
    if (typeof anchor === 'string' && fragmentText.includes(anchor)) anchorsFound += 1;
  }
}

console.log(
  JSON.stringify(
    {
      fragmentId: fragment.fragmentId,
      fragmentChars: fragmentText.length,
      dureeSecondes: Math.round((Date.now() - started) / 1000),
      modele: response.modelVersion,
      jsonParsable: parseError === null,
      parseError,
      claimsProduites: claims.length,
      ancres: { total: anchorsTotal, retrouveesTelQuel: anchorsFound },
      usage: response.usage,
      coutUsd: response.usage.cost,
      coutProjete103Fragments: Number((response.usage.cost * 103).toFixed(2)),
    },
    null,
    2,
  ),
);
