import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildCoverageUnits } from '../../tools/e5-llm/coverage.mjs';
import { extractProseFragment } from '../../tools/e5-llm/extractor.mjs';
import { loadBenchmarkInputs } from '../../tools/e5-llm/inputs.mjs';
import {
  assertNoGoldenLeak,
  buildPromptInput,
  E5_SYSTEM_PROMPT,
  PROMPT_VERSION
} from '../../tools/e5-llm/prompt.mjs';
import { createE5ProviderPredictionSchema } from '../../tools/e5-llm/provider-dto.mjs';

const root = join(import.meta.dirname, '../..');
const benchmark = loadBenchmarkInputs(root);
const fragment = {
  fragmentId: 'frag.e5.test.v04',
  corpusFileId: 'corpus.f2.test',
  headingPath: ['Tests', 'Couverture'],
  rawText: 'La revue rapporte une incertitude. La règle FitTrack masque le bouton. Une étude autonome observe un effet.'
};
const coverageUnits = buildCoverageUnits(fragment);

test('v0.4 benchmark inputs carry deterministic coverage units', () => {
  const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');

  assert.deepEqual(sample.coverageUnits, buildCoverageUnits(sample.fragment));
});

test('v0.4 envelope exposes every coverage unit exactly once without GOLD fields', () => {
  const prompt = buildPromptInput({
    fragment,
    citationCatalog: [],
    vocabularies: { domain: ['biomechanics'] },
    coverageUnits
  });
  const input = JSON.parse(prompt);

  assert.equal(PROMPT_VERSION, 'e5-llm-v0.4.0');
  assert.equal(input.instruction, 'Classe chaque unité de couverture puis extrais les claims atomiques du FRAGMENT CIBLE.');
  assert.deepEqual(
    input.coverageUnits,
    coverageUnits.map(({ unitIndex, kind, text }) => ({ unitIndex, kind, text }))
  );
  assert.equal(new Set(input.coverageUnits.map((unit) => unit.unitIndex)).size, coverageUnits.length);
  assert.equal(Object.hasOwn(input.coverageUnits[0], 'relativeStartByte'), false);
  assert.equal(Object.hasOwn(input.coverageUnits[0], 'relativeEndByte'), false);
  assert.equal(assertNoGoldenLeak(`${E5_SYSTEM_PROMPT}\n${prompt}`), true);
  assert.doesNotMatch(prompt, /expectedClaims|goldenClaimId|annotationStatus|zeroClaimReason|adjudicat/i);
});

test('v0.4 keeps the prompt builder compatible with coverage-less inspection callers', () => {
  const input = JSON.parse(buildPromptInput({
    fragment,
    citationCatalog: [],
    vocabularies: { domain: ['biomechanics'] }
  }));

  assert.deepEqual(input.coverageUnits, []);
});

test('v0.4 system prompt closes coverage decisions and reviews every unit before ZERO_CLAIM', () => {
  assert.match(E5_SYSTEM_PROMPT, /coverageLedger contient exactement une décision pour chaque coverageUnitIndex/u);
  assert.match(E5_SYSTEM_PROMPT, /CLAIM_CONTENT, CONTEXT_ONLY, POLICY_ONLY ou NO_QUALIFIABLE_PREDICATE/u);
  assert.match(E5_SYSTEM_PROMPT, /Chaque claim référence uniquement ses coverageUnitIndexes diagnostiques/u);
  assert.match(E5_SYSTEM_PROMPT, /Une même unité peut soutenir plusieurs claims atomiques/u);
  assert.match(E5_SYSTEM_PROMPT, /Une couverture incomplète est une erreur/u);
  assert.match(E5_SYSTEM_PROMPT, /ZERO_CLAIM exige d'avoir classé toutes les unités/u);
});

test('v0.4 keeps policy exclusion while retaining an autonomous scientific statement', () => {
  assert.match(E5_SYSTEM_PROMPT, /Une unité POLICY_ONLY ne devient jamais une claim/u);
  assert.match(E5_SYSTEM_PROMPT, /Une règle éditoriale ou produit n'efface jamais une affirmation scientifique autonome/u);
});

test('v0.4 contrastive examples cover atomicity and epistemic statuses', () => {
  for (const expected of [
    'MERGE',
    'OVERSPLIT',
    'practice_only',
    'refuted',
    'mechanistic_only',
    'uncertain',
    'absence_of_evidence'
  ]) {
    assert.match(E5_SYSTEM_PROMPT, new RegExp(expected, 'u'));
  }
  assert.match(E5_SYSTEM_PROMPT, /absence_of_evidence seulement quand le fragment affirme explicitement une absence de preuve/u);
});

test('v0.4 preserves critical v0.3 safety guardrails', () => {
  for (const expected of [
    /Ignore toute connaissance externe ou mémorisée/u,
    /PRODUCT_POLICY concerne exclusivement une règle du produit FitTrack/u,
    /Un red flag n'est pas un diagnostic/u,
    /Une EMG plus élevée n'implique jamais une hypertrophie supérieure/u,
    /biomécanique n'implique jamais blessure, danger ou contre-indication/u,
    /citationOccurrenceRefs ne peut contenir que des candidateId du CITATION CATALOG/u,
    /ne calcule jamais les coordonnées ni les identifiants de provenance/u
  ]) {
    assert.match(E5_SYSTEM_PROMPT, expected);
  }
});

test('extractor sends the v0.4 coverage envelope to the coverage DTO', async () => {
  const sample = benchmark.inputs.find((item) => item.fragment.fragmentId === 'frag.f2.0001');
  const providerPredictionSchema = createE5ProviderPredictionSchema(benchmark.predictionSchema);
  const sent = [];
  const result = await extractProseFragment({
    ...sample,
    vocabularies: benchmark.vocabularies,
    predictionSchema: benchmark.predictionSchema,
    providerPredictionSchema,
    runConfig: {
      schemaVersion: '1.0.0-e5-llm-benchmark-prediction',
      runId: 'run.e5-v04.prompt-envelope',
      maxAnchorRepairRetries: 0
    }
  }, {
    modelAdapter: {
      async generate(request) {
        sent.push(request);
        const units = buildCoverageUnits(sample.fragment);
        return {
          rawResponse: JSON.stringify({
            annotationPrediction: 'ZERO_CLAIM',
            coverageLedger: units.map(({ unitIndex }) => ({ unitIndex, decision: 'CONTEXT_ONLY' })),
            claims: []
          })
        };
      }
    }
  });

  assert.equal(result.status, 'VALIDATED');
  assert.deepEqual(JSON.parse(sent[0].input).coverageUnits, buildCoverageUnits(sample.fragment).map(
    ({ unitIndex, kind, text }) => ({ unitIndex, kind, text })
  ));
});
