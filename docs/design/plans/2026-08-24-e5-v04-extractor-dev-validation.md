# E5-LLM v0.4 Extractor and DEV Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build the auditable E5 v0.4 extractor, prove claim-level salvage by offline replay, pass DEV-20 and DEV-100, and freeze the exact candidate used for the independent holdout.

**Architecture:** Keep extractProseFragment(input, { modelAdapter }) as the external deep-module interface. Add deterministic selection and coverage modules behind it, evolve the transport-only Provider DTO to v3, and make validateProviderAndMaterialize() own claim filtering, deterministic post-processing, and audit construction. The OpenRouter adapter remains the only remote seam; tests use the replay adapter.

**Tech Stack:** Node.js ESM, node:test, AJV 2020, JSON Schema, deterministic UTF-8 byte offsets, OpenRouter openai/gpt-5 with reasoning=minimal.

## Global Constraints

- Work only in C:\Users\e6\Documents\FITTRACK RELOADED\.worktrees\knowledge-base-v1 on feat/knowledge-base-v1.
- Preserve the existing 100-fragment GOLD bit-for-bit as immutable DEV-100.
- Freeze HOLDOUT-30 selection before editing the v0.4 prompt or DTO; annotate it only after code freeze.
- Never write to canonical/, curated/, corpus, E5-P0, or existing GOLD to improve scores.
- One full call maximum per fragment, zero full retries, one targeted repair maximum per fragment.
- Keep openrouter / openai/gpt-5 / reasoning minimal; no Qwen calls.
- Every paid stage needs a zero-call dry-run, cost estimate, manifest validation, and explicit user approval.
- Never launch the 207 fragments from this plan.
- Do not commit raw responses, predictions, diagnostics, metrics, probes, pilots, or tests/validation-results.json.
- Run node/npm commands from fittrack-kb-contract; run git commands from the worktree root.
- DEV-20 gates: precision >= 0.90, recall >= 0.80, zero critical safety violation, zero global rejection, no witness regression, projected 207 cost <= 2.50 USD.
- DEV-100 gates: global precision >= 0.95, global recall >= 0.85, F3 precision >= 0.98, citation precision >= 0.97, citation recall >= 0.90, hallucination rate <= 0.005, knowledgeType >= 0.90, epistemicStatus >= 0.85, UNRESOLVED fidelity >= 0.90, cannotConclude fidelity >= 0.90, negation/population/temporality >= 0.98, overmerged <= 0.03, oversplit <= 0.05, and zero global rejection or critical safety violation.

---

### Task 1: Freeze HOLDOUT-30 and DEV-20 before protocol edits

**Files:**
- Create: fittrack-kb-contract/tools/e5-llm/v04-selection.mjs
- Create: fittrack-kb-contract/tools/select-e5-v04-datasets.mjs
- Test: fittrack-kb-contract/tests/e5-llm/v04-selection.test.mjs
- Create: fittrack-kb-contract/benchmark/e5/v0/manifests/holdout-30.json
- Create: fittrack-kb-contract/benchmark/e5/v0/manifests/dev-20.json

**Interfaces:**
- Produces: selectHoldout30({ fragments, citationCandidates, dev100Ids, corpusCommit }) -> manifest
- Produces: selectDev20({ annotations, fragmentResults, errors }) -> manifest

- [ ] **Step 1: Write failing deterministic-selection tests**

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDev20, selectHoldout30 } from '../../tools/e5-llm/v04-selection.mjs';

function fragment(corpus, index) {
  return {
    fragmentId: 'frag.' + corpus.toLowerCase() + '.' + String(index).padStart(4, '0'),
    corpusFileId: 'corpus.' + corpus.toLowerCase() + '.fixture',
    headingPath: ['Fixture'],
    rawText: 'Phrase ' + index + '.'
  };
}

test('HOLDOUT-30 is deterministic, disjoint, and split 15/15', () => {
  const fragments = [
    ...Array.from({ length: 16 }, (_, index) => fragment('F2', index)),
    ...Array.from({ length: 16 }, (_, index) => fragment('F3', index))
  ];
  const input = {
    fragments, citationCandidates: [], corpusCommit: 'fixture-commit',
    dev100Ids: ['frag.f2.0000', 'frag.f3.0000']
  };
  const first = selectHoldout30(input);
  assert.deepEqual(first, selectHoldout30(input));
  assert.deepEqual(first.counts, { F2: 15, F3: 15 });
  assert.equal(new Set(first.fragmentIds).size, 30);
  assert.equal(first.fragmentIds.some((id) => input.dev100Ids.includes(id)), false);
});

test('DEV-20 follows the frozen bucket order and split 10/10', () => {
  const fragmentResults = Array.from({ length: 20 }, (_, index) => ({
    fragmentId: 'frag.' + (index < 10 ? 'f2.' : 'f3.') + String(index).padStart(4, '0'),
    corpus: index < 10 ? 'F2' : 'F3', status: 'VALIDATED', errors: [], goldenZero: index % 2 === 0
  }));
  const annotations = fragmentResults.map((item) => ({
    fragmentId: item.fragmentId, annotationStatus: item.goldenZero ? 'zero_claim' : 'claims'
  }));
  const result = selectDev20({ annotations, fragmentResults, errors: [] });
  assert.deepEqual(result.counts, { F2: 10, F3: 10 });
  assert.deepEqual(result.bucketPriority, [
    'partial_rejection', 'false_zero_claim', 'missed_claim', 'merged_claims',
    'wrong_epistemic_status', 'citation_error', 'safety_violation',
    'successful_zero_claim_witness', 'successful_nonempty_witness', 'residual_error_count'
  ]);
});
~~~

- [ ] **Step 2: Run node --test tests/e5-llm/v04-selection.test.mjs**

Expected: FAIL with ERR_MODULE_NOT_FOUND.

- [ ] **Step 3: Implement exact selection**

Use SHA-256 of the UTF-8 concatenation of e5-v04-holdout-30, a NUL byte, corpusCommit, a NUL byte, and fragmentId. Exclude DEV-100, split F2/F3, stratify by headingPath.join(' > '), citation presence, and UTF-8 length tertile, sort strata lexically, then round-robin to 15 per corpus. Map buckets exactly: partial_rejection means REJECTED with at least one individually valid claim; false_zero_claim means ZERO_CLAIM_FALSE_NEGATIVE; missed_claim means MISSED_CLAIM; merged_claims means MERGED_CLAIMS; wrong_epistemic_status means WRONG_EPISTEMIC_STATUS; citation_error means WRONG_CITATION, CITATION_BLEED, or INVENTED_CITATION; safety_violation means any critical safety category; successful witnesses have no errors and the stated GOLD zero/non-zero class; residual uses total remaining errors. Within each bucket sort by descending error count then fragmentId; skip selected IDs and cycle buckets until ten distinct IDs per corpus. Persist seed, algorithm, source hashes, stratum/bucket, and counts.

- [ ] **Step 4: Generate both manifests from the audited v0.3 run**

~~~powershell
node tools/select-e5-v04-datasets.mjs --v03-run "C:\Users\e6\Documents\Codex\2026-08-24\tu-reprends-le-travail-sur-fittrack\work\FITTRACK-RELOADED\fittrack-kb-contract\benchmark\e5\v0\runs\openrouter-openai-gpt-5"
~~~

Expected: HOLDOUT-30 frozen 15 F2/15 F3; DEV-20 frozen 10 F2/10 F3; zero API calls.

- [ ] **Step 5: Re-run tests, inspect the manifests, and commit before prompt/DTO edits**

~~~bash
node --test tests/e5-llm/v04-selection.test.mjs
git diff --check
git add fittrack-kb-contract/tools/e5-llm/v04-selection.mjs fittrack-kb-contract/tools/select-e5-v04-datasets.mjs fittrack-kb-contract/tests/e5-llm/v04-selection.test.mjs fittrack-kb-contract/benchmark/e5/v0/manifests/holdout-30.json fittrack-kb-contract/benchmark/e5/v0/manifests/dev-20.json
git commit -m "test(kb): freeze E5 v0.4 development datasets"
~~~

### Task 2: Add deterministic coverage units and ledger validation

**Files:**
- Create: fittrack-kb-contract/tools/e5-llm/coverage.mjs
- Test: fittrack-kb-contract/tests/e5-llm/coverage-v04.test.mjs

**Interfaces:**
- Produces: buildCoverageUnits(fragment) -> [{ unitIndex, kind, text, relativeStartByte, relativeEndByte }]
- Produces: auditCoverageLedger({ coverageUnits, coverageLedger, claims }) -> { diagnostics, coveredUnitIndexes }

- [ ] **Step 1: Write failing tests for prose, Markdown list items, UTF-8 reread, complete coverage, duplicate indexes, out-of-range indexes, and CLAIM_CONTENT without a claim reference**

~~~js
const rawText = 'Épaule stable.\n- Charge progressive\n- Pacing.';
const units = buildCoverageUnits({ rawText });
assert.deepEqual(units.map((item) => item.kind), ['SENTENCE', 'LIST_ITEM', 'LIST_ITEM']);
for (const unit of units) {
  assert.equal(Buffer.from(rawText, 'utf8').subarray(unit.relativeStartByte, unit.relativeEndByte).toString('utf8'), unit.text);
}
~~~

- [ ] **Step 2: Run node --test tests/e5-llm/coverage-v04.test.mjs and verify failure**

- [ ] **Step 3: Implement exact segmentation without normalization**

A list item begins with optional spaces plus -, *, +, or an ordered marker and includes continuation lines until the next marker or blank line. Split non-list paragraphs after ., !, ?, or …, including closing quotes/brackets. Move indexes past boundary whitespace; never rewrite unit text. Emit exactly COVERAGE_DUPLICATE_UNIT, COVERAGE_INCOMPLETE, COVERAGE_UNIT_OUT_OF_RANGE, CLAIM_CONTENT_WITHOUT_CLAIM, and CLAIM_UNIT_REFERENCE_INVALID.

- [ ] **Step 4: Run tests and commit**

~~~bash
node --test tests/e5-llm/coverage-v04.test.mjs
git add fittrack-kb-contract/tools/e5-llm/coverage.mjs fittrack-kb-contract/tests/e5-llm/coverage-v04.test.mjs
git commit -m "feat(kb): add deterministic E5 coverage units"
~~~

### Task 3: Evolve the Provider DTO to v3 and retain v2 replay

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/provider-dto.mjs
- Modify: fittrack-kb-contract/tests/e5-llm/provider-dto.test.mjs
- Modify: fittrack-kb-contract/tests/e5-llm/provider-schema.test.mjs

**Interfaces:**
- Changes: createE5ProviderPredictionSchema(canonicalSchema, { dtoVersion })
- Produces: providerClaimToCanonical(providerClaim, claimIndex, fragment, citationCatalog)

- [ ] **Step 1: Add failing tests that v3 requires coverageLedger and claim coverageUnitIndexes, v2 omits them, and both projected schemas remain depth <= 5**

~~~js
const v3 = createE5ProviderPredictionSchema(canonicalSchema, { dtoVersion: 'e5-provider-prediction-v3' });
assert.deepEqual(v3.required, ['annotationPrediction', 'coverageLedger', 'claims']);
assert.equal(v3.$defs.claim.required.includes('coverageUnitIndexes'), true);
assert.equal(projectProviderSchema(v3).providerSchemaAssertions.maxDepth <= 5, true);
~~~

- [ ] **Step 2: Run DTO/schema tests and verify failure**

- [ ] **Step 3: Implement v3**

Set PROVIDER_DTO_VERSION to e5-provider-prediction-v3 and retain LEGACY_PROVIDER_DTO_VERSION e5-provider-prediction-v2. Define flat decisions { unitIndex, decision } using CLAIM_CONTENT, CONTEXT_ONLY, POLICY_ONLY, NO_QUALIFIABLE_PREDICATE. Require non-empty unique integer coverageUnitIndexes on v3 claims. Coverage fields never enter canonical output. Extract providerClaimToCanonical() so validation can materialize one claim independently.

- [ ] **Step 4: Run tests including canonical/GOLD byte preservation and commit**

~~~bash
node --test tests/e5-llm/provider-dto.test.mjs tests/e5-llm/provider-schema.test.mjs
git add fittrack-kb-contract/tools/e5-llm/provider-dto.mjs fittrack-kb-contract/tests/e5-llm/provider-dto.test.mjs fittrack-kb-contract/tests/e5-llm/provider-schema.test.mjs
git commit -m "feat(kb): add E5 provider coverage DTO v3"
~~~

### Task 4: Replace global rejection with claim-level validation

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/validate.mjs
- Test: fittrack-kb-contract/tests/e5-llm/claim-salvage-v04.test.mjs

**Interfaces:**
- Deepens: validateProviderAndMaterialize({ rawResponse, expectedFragment, citationCatalog, coverageUnits, providerSchemaValidator, canonicalSchemaValidator, runConfig })
- Returns statuses VALIDATED, PARTIALLY_VALIDATED, REJECTED.

- [ ] **Step 1: Write failing cases for a valid sister plus invented citation, valid sister plus missing anchor, a PRODUCT_POLICY sister filtered as UNSUPPORTED_INFERENCE, all claims filtered, incomplete coverage with a valid claim, invalid JSON, invalid provider schema, and annotation/claims mismatch**

~~~js
assert.equal(result.status, 'PARTIALLY_VALIDATED');
assert.equal(result.accepted, true);
assert.equal(result.prediction.claims.length, 1);
assert.equal(result.claimAudit.attempted, 2);
assert.equal(result.claimAudit.retained, 1);
assert.equal(result.claimAudit.filtered, 1);
~~~

- [ ] **Step 2: Run the new test and verify current REJECTED behavior**

- [ ] **Step 3: Implement global-versus-local validation**

Only invalid JSON, invalid Provider DTO, and failures preventing reliable claim enumeration are global. For valid DTOs: audit coverage; materialize and guard each claim independently; retain valid claims; derive final annotationPrediction from retained count; return PARTIALLY_VALIDATED for any filtered claim, coverage inconsistency, or provider annotation mismatch. If all attempted claims are filtered, return canonical ZERO_CLAIM plus the complete audit.

~~~js
return {
  status,
  accepted: status !== 'REJECTED',
  prediction,
  diagnostics,
  claimAudit: { attempted, retained, filtered, claims: claimAudits },
  coverageAudit,
  repairableClaimIndexes,
  providerPrediction
};
~~~

Keep safety diagnostics from filtered claims. Add CLAIM_FILTERED, PARTIAL_VALIDATION, and ANNOTATION_PREDICTION_MISMATCH; do not reinterpret existing codes.

- [ ] **Step 4: Run salvage and existing tests, then commit**

~~~bash
node --test tests/e5-llm/claim-salvage-v04.test.mjs tests/e5-llm/benchmark.test.mjs tests/e5-llm/provider-dto.test.mjs
git add fittrack-kb-contract/tools/e5-llm/validate.mjs fittrack-kb-contract/tests/e5-llm/claim-salvage-v04.test.mjs
git commit -m "feat(kb): salvage E5 claims independently"
~~~

### Task 5: Add the two authorized deterministic post-processing rules

**Files:**
- Create: fittrack-kb-contract/tools/e5-llm/postprocess.mjs
- Test: fittrack-kb-contract/tests/e5-llm/postprocess-v04.test.mjs
- Modify: fittrack-kb-contract/tools/e5-llm/validate.mjs

**Interface:** postprocessClaims({ claims, fragment, citationCatalog, coverageUnits }) -> { claims, resolutions, diagnostics }

- [ ] **Step 1: Write failing tests**

~~~js
test('EXPERT_PRACTICE plus UNRESOLVED becomes practice_only with an audit reason', () => {
  const result = postprocessClaims(fixtureExpertPractice());
  assert.equal(result.claims[0].epistemicStatus.value, 'practice_only');
  assert.equal(result.resolutions[0].reason, 'deterministic_expert_practice_default');
});

test('one local citation attaches only to the sole eligible claim', () => {
  const result = postprocessClaims(fixtureUniqueLocalCitation());
  assert.deepEqual(result.claims[0].citationOccurrenceRefs, ['cand.e5-citation.0123456789abcdef']);
});

test('multiple claims or citations stay unresolved', () => {
  const result = postprocessClaims(fixtureAmbiguousCitation());
  assert.deepEqual(result.claims.flatMap((item) => item.citationOccurrenceRefs), []);
});
~~~

- [ ] **Step 2: Run node --test tests/e5-llm/postprocess-v04.test.mjs and verify failure**

- [ ] **Step 3: Implement only the approved rules**

Convert EXPERT_PRACTICE with epistemic state UNRESOLVED to RESOLVED/practice_only and record deterministic_expert_practice_default. Do not default EVIDENCE, EMG_OBSERVATION, BIOMECHANICAL_OBSERVATION, DEFINITION, or contextual types. Preserve valid attached citations. Auto-attach only when one coverage sentence contains exactly one eligible retained claim and exactly one closed-catalog citation; never cross a coverage-unit boundary.

- [ ] **Step 4: Integrate after local validation, run tests, and commit**

~~~bash
node --test tests/e5-llm/postprocess-v04.test.mjs tests/e5-llm/claim-salvage-v04.test.mjs
git add fittrack-kb-contract/tools/e5-llm/postprocess.mjs fittrack-kb-contract/tools/e5-llm/validate.mjs fittrack-kb-contract/tests/e5-llm/postprocess-v04.test.mjs
git commit -m "feat(kb): add conservative E5 deterministic resolutions"
~~~

### Task 6: Preserve valid sisters through targeted repair

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/extractor.mjs
- Modify: fittrack-kb-contract/tools/e5-llm/provider-dto.mjs
- Test: fittrack-kb-contract/tests/e5-llm/repair-salvage-v04.test.mjs

**Interface:** Keep extractProseFragment(input, { modelAdapter }) as the only caller-facing extraction interface.

- [ ] **Step 1: Write failing tests that claim 2 alone is repaired, claim 1 is never regenerated, failed repair retains claim 1, provider error during repair returns PARTIALLY_VALIDATED, and total repairs never exceed one**

- [ ] **Step 2: Run node --test tests/e5-llm/repair-salvage-v04.test.mjs and verify current rejection**

- [ ] **Step 3: Implement partial-result repair flow**

Pass coverageUnits into validation. A failed repair adds REPAIR_FAILED to the pre-repair partial result and keeps retained claims. A successful repair merges anchors only for repairableClaimIndexes and revalidates once.

~~~js
function resultOf(fragmentId, validation, attempts, runConfig) {
  return {
    fragmentId,
    status: validation.status,
    prediction: validation.prediction,
    diagnostics: validation.diagnostics,
    claimAudit: validation.claimAudit,
    coverageAudit: validation.coverageAudit,
    attempts,
    usageByCallType: summarizeAttemptUsage(attempts, runConfig)
  };
}
~~~

- [ ] **Step 4: Run repair, anchor, and budget tests, then commit**

~~~bash
node --test tests/e5-llm/repair-salvage-v04.test.mjs tests/e5-llm/anchors-v03.test.mjs tests/e5-llm/benchmark.test.mjs
git add fittrack-kb-contract/tools/e5-llm/extractor.mjs fittrack-kb-contract/tools/e5-llm/provider-dto.mjs fittrack-kb-contract/tests/e5-llm/repair-salvage-v04.test.mjs
git commit -m "feat(kb): retain valid claims across anchor repair"
~~~

### Task 7: Replace the prompt with the coverage-oriented v0.4 protocol

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/prompt.mjs
- Modify: fittrack-kb-contract/tools/e5-llm/inputs.mjs
- Modify: fittrack-kb-contract/benchmark/e5/v0/config.gpt-5.json
- Test: fittrack-kb-contract/tests/e5-llm/prompt-v04.test.mjs

**Interfaces:**
- Changes: buildPromptInput({ fragment, citationCatalog, vocabularies, coverageUnits })
- Sets: PROMPT_VERSION = e5-llm-v0.4.0

- [ ] **Step 1: Write failing prompt-contract tests**

Assert every unit appears once, no GOLD field leaks, coverage decisions are closed, ZERO_CLAIM requires reviewing all units, editorial policy remains excluded while an autonomous scientific statement in the same passage remains extractible, and contrastive examples cover merge, oversplit, practice_only, refuted, mechanistic_only, uncertain, and explicit absence_of_evidence.

- [ ] **Step 2: Run node --test tests/e5-llm/prompt-v04.test.mjs and verify version/coverage failures**

- [ ] **Step 3: Implement the input envelope and system prompt**

~~~js
{
  instruction: 'Classe chaque unité de couverture puis extrais les claims atomiques du FRAGMENT CIBLE.',
  fragment: { fragmentId, corpusFileId, headingPath, rawText },
  coverageUnits: coverageUnits.map(({ unitIndex, kind, text }) => ({ unitIndex, kind, text })),
  citationCatalog,
  closedVocabularies
}
~~~

State that coverageUnitIndexes is diagnostic only, one unit can support multiple atomic claims, incomplete coverage is an error, and the model never computes offsets or provenance. Keep every v0.3 critical safety guardrail.

- [ ] **Step 4: Update config versions only**

Set extractorVersion to 0.3.0-e5-llm-v0.4 and promptVersion to e5-llm-v0.4.0. Keep model, reasoning, prices, retry limits, and 2.50 USD cap unchanged.

- [ ] **Step 5: Run prompt/DTO/leak tests and commit**

~~~bash
node --test tests/e5-llm/prompt-v04.test.mjs tests/e5-llm/provider-dto.test.mjs tests/e5-llm/benchmark.test.mjs
git add fittrack-kb-contract/tools/e5-llm/prompt.mjs fittrack-kb-contract/tools/e5-llm/inputs.mjs fittrack-kb-contract/benchmark/e5/v0/config.gpt-5.json fittrack-kb-contract/tests/e5-llm/prompt-v04.test.mjs
git commit -m "feat(kb): add E5 coverage-oriented prompt v0.4"
~~~

### Task 8: Make evaluation status-aware and add frozen gates

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/evaluate.mjs
- Modify: fittrack-kb-contract/tools/evaluate-e5-llm-benchmark.mjs
- Test: fittrack-kb-contract/tests/e5-llm/metrics-v04.test.mjs

**Interface:** benchmarkPass(metrics, { stage, dev100Metrics = null }) with DEV_20, DEV_100, HOLDOUT_30.

- [ ] **Step 1: Write failing tests for filtered dangerous claims, partial status, all-filtered denominators, DEV-20 gates, four new DEV-100 gates, and holdout N/A semantics**

~~~js
const result = benchmarkPass(metrics, { stage: 'DEV_100' });
assert.equal(result.gates.knowledgeTypeAccuracy.threshold, 0.90);
assert.equal(result.gates.epistemicStatusAccuracy.threshold, 0.85);
assert.equal(result.gates.unresolvedFidelity.threshold, 0.90);
assert.equal(result.gates.cannotConcludeFidelity.threshold, 0.90);
~~~

- [ ] **Step 2: Run node --test tests/e5-llm/metrics-v04.test.mjs and verify failure**

- [ ] **Step 3: Count attempts and statuses correctly**

Use record.claimAudit.attempted as denominator, falling back to legacy raw-response parsing only for v0.3 replay. Aggregate local diagnostics from retained and filtered claims exactly once. Count only status REJECTED in rejectedFragments; report VALIDATED/PARTIALLY_VALIDATED/REJECTED separately.

- [ ] **Step 4: Implement gates and N/A behavior**

For HOLDOUT_30, a null classification/fidelity metric passes only when the same gate is non-null and passing in dev100Metrics; otherwise fail with na_without_passing_dev100_baseline.

- [ ] **Step 5: Update audit/report output and commit**

Reports include attempted/retained/filtered claims, coverage diagnostics, partial validations, global rejections, stage, all gates, and explicit YES/NO. Replay never receives a release verdict.

~~~bash
node --test tests/e5-llm/metrics-v04.test.mjs tests/e5-llm/benchmark.test.mjs
git add fittrack-kb-contract/tools/e5-llm/evaluate.mjs fittrack-kb-contract/tools/evaluate-e5-llm-benchmark.mjs fittrack-kb-contract/tests/e5-llm/metrics-v04.test.mjs
git commit -m "feat(kb): enforce E5 v0.4 evaluation gates"
~~~

### Task 9: Add the zero-API v0.3 replay proof

**Files:**
- Create: fittrack-kb-contract/tools/replay-e5-v03-run.mjs
- Test: fittrack-kb-contract/tests/e5-llm/replay-v03.test.mjs
- Modify: fittrack-kb-contract/package.json

**Interface:** replayV03Run({ sourceRunRoot, outputRoot }) -> { summary, metrics, errors }

- [ ] **Step 1: Write a failing replay test using a temporary fixture**

Assert no network adapter is created, valid sisters survive, filtered safety claims remain counted, output stays below the supplied temp root, and GOLD/curated hashes do not change.

- [ ] **Step 2: Run node --test tests/e5-llm/replay-v03.test.mjs and verify missing module**

- [ ] **Step 3: Implement replay**

Load config.json and raw-responses/{safeId}/attempt-{attempt}.json in attempt order. Use createReplayAdapter(), legacy DTO v2, and the v0.4 validator with coverage checks disabled only for legacy replay. Persist under benchmark/e5/v0/replays/{emitted-runId}/ or a test temp root; never call OpenRouter.

- [ ] **Step 4: Add the package script and run the real replay**

~~~json
"benchmark:e5-v04:replay-v03": "node tools/replay-e5-v03-run.mjs"
~~~

~~~powershell
npm run benchmark:e5-v04:replay-v03 -- --source-run "C:\Users\e6\Documents\Codex\2026-08-24\tu-reprends-le-travail-sur-fittrack\work\FITTRACK-RELOADED\fittrack-kb-contract\benchmark\e5\v0\runs\openrouter-openai-gpt-5"
~~~

Expected: zero API calls, 17 recovered GOLD matches, global recall approximately 0.6882, no valid sister lost.

- [ ] **Step 5: Commit code/tests only; leave replay output local**

~~~bash
git add fittrack-kb-contract/tools/replay-e5-v03-run.mjs fittrack-kb-contract/tests/e5-llm/replay-v03.test.mjs fittrack-kb-contract/package.json
git commit -m "test(kb): replay E5 v0.3 through claim salvage"
~~~

### Task 10: Make the runner manifest-driven and stage-safe

**Files:**
- Modify: fittrack-kb-contract/tools/e5-llm/inputs.mjs
- Modify: fittrack-kb-contract/tools/run-e5-llm-benchmark.mjs
- Modify: fittrack-kb-contract/tools/evaluate-e5-llm-benchmark.mjs
- Modify: fittrack-kb-contract/package.json
- Test: fittrack-kb-contract/tests/e5-llm/runner-v04.test.mjs

**Interfaces:**
- Changes: loadBenchmarkInputs(root, { manifestPath, expectedCounts })
- Adds stages: dry-run, dev-20, dev-100, holdout-30.

- [ ] **Step 1: Write failing tests**

Assert manifest IDs control selection; DEV-20 requires --approve-cost; DEV-100 also requires --dev20-approved; HOLDOUT-30 also requires --dev100-frozen and validated holdout GOLD; dry-run performs zero calls; no v0.4 mode can select all 207.

- [ ] **Step 2: Run node --test tests/e5-llm/runner-v04.test.mjs and verify current hard-coded pilot/full behavior**

- [ ] **Step 3: Implement manifest-driven loading**

Reject duplicate or missing IDs, wrong F2/F3 split, source hash mismatch, prompt/DTO mismatch, and holdout overlap with DEV-100. Build coverage units once per input and pass them to prompt and extractor.

- [ ] **Step 4: Implement approval and budget checks before provider-adapter construction**

Write the dry-run estimate first. Stop before creating the provider adapter if approvals are absent. Budget-check before every full or repair call. Output roots include stage and runId so audited runs are never overwritten. Persist raw provider response, coverage ledger, attempted/retained/filtered claims, global/local diagnostics, full/repair calls, tokens, latency, and cost separately.

- [ ] **Step 5: Add explicit scripts**

~~~json
"benchmark:e5-v04:dev20:dry-run": "node tools/run-e5-llm-benchmark.mjs --mode dry-run --manifest benchmark/e5/v0/manifests/dev-20.json --stage DEV_20",
"benchmark:e5-v04:dev20": "node tools/run-e5-llm-benchmark.mjs --mode dev-20 --manifest benchmark/e5/v0/manifests/dev-20.json",
"benchmark:e5-v04:dev100:dry-run": "node tools/run-e5-llm-benchmark.mjs --mode dry-run --manifest candidates/e5-prose-golden-manifest.json --stage DEV_100",
"benchmark:e5-v04:dev100": "node tools/run-e5-llm-benchmark.mjs --mode dev-100 --manifest candidates/e5-prose-golden-manifest.json",
"benchmark:e5-v04:holdout30:dry-run": "node tools/run-e5-llm-benchmark.mjs --mode dry-run --manifest benchmark/e5/v0/manifests/holdout-30.json --stage HOLDOUT_30",
"benchmark:e5-v04:holdout30": "node tools/run-e5-llm-benchmark.mjs --mode holdout-30 --manifest benchmark/e5/v0/manifests/holdout-30.json"
~~~

- [ ] **Step 6: Run runner/budget/audit tests and commit**

~~~bash
node --test tests/e5-llm/runner-v04.test.mjs tests/e5-llm/benchmark.test.mjs
git add fittrack-kb-contract/tools/e5-llm/inputs.mjs fittrack-kb-contract/tools/run-e5-llm-benchmark.mjs fittrack-kb-contract/tools/evaluate-e5-llm-benchmark.mjs fittrack-kb-contract/package.json fittrack-kb-contract/tests/e5-llm/runner-v04.test.mjs
git commit -m "feat(kb): orchestrate staged E5 v0.4 benchmarks"
~~~

### Task 11: Add blind-holdout scaffolding and validation tooling

**Files:**
- Create: fittrack-kb-contract/tools/scaffold-e5-v04-holdout.mjs
- Create: fittrack-kb-contract/tools/validate-e5-v04-holdout.mjs
- Test: fittrack-kb-contract/tests/e5-llm/holdout-scaffold.test.mjs
- Modify: fittrack-kb-contract/package.json

**Interface:** scaffoldHoldout({ freezeManifest, selectionManifest, outputRoot }) creates a separate namespace only after freeze; validateHoldout(root) verifies it without model data.

- [ ] **Step 1: Write failing temp-directory tests**

Assert the scaffold references ../e5/annotation.schema.json, creates blank A/B/adjudication containers with no model output, refuses to run without a freeze manifest, and the validator rejects prediction, runId, model, prompt, or rawResponse keys.

- [ ] **Step 2: Run node --test tests/e5-llm/holdout-scaffold.test.mjs and verify failure**

- [ ] **Step 3: Implement tooling but do not create the real holdout namespace**

The real namespace is created only in the second plan. Validation enforces 30 IDs, 15/15 split, no DEV overlap, exact selection-manifest hash, exact spans/citations, two independent annotators, and adjudication for every disagreement.

- [ ] **Step 4: Run tests and commit**

~~~bash
node --test tests/e5-llm/holdout-scaffold.test.mjs
git add fittrack-kb-contract/tools/scaffold-e5-v04-holdout.mjs fittrack-kb-contract/tools/validate-e5-v04-holdout.mjs fittrack-kb-contract/tests/e5-llm/holdout-scaffold.test.mjs fittrack-kb-contract/package.json
git commit -m "feat(kb): prepare blind E5 holdout validation"
~~~

### Task 12: Verify and commit the v0.4 candidate implementation

**Files:**
- Modify if needed: fittrack-kb-contract/benchmark/e5/v0/README.md
- Do not modify: existing GOLD, corpus, E5-P0, canonical, curated, PROGRESS.md, tests/validation-results.json.

- [ ] **Step 1: Run npm run test:e5-llm**

Expected: all E5-LLM tests pass.

- [ ] **Step 2: Run npm run validate:e5-gold and npm run test:e5-gold**

Expected: existing 100 fragments and 186 claims remain unchanged.

- [ ] **Step 3: Run npm run check**

Expected: PASS. Inspect git diff --name-only afterwards; do not stage generated validation output or line-ending-only rewrites.

- [ ] **Step 4: From repository root run typecheck, build, and test:run**

~~~bash
npm run typecheck
npm run build
npm run test:run
~~~

Expected: typecheck and build pass. If the known Vitest collection issue still reports the 18 node:test suites as suite-level failures while application tests pass, record the exact evidence; do not alter assertions to hide it.

- [ ] **Step 5: Document statuses, coverage, commands, approvals, output layout, and STOP conditions**

~~~bash
git add fittrack-kb-contract/benchmark/e5/v0/README.md
git commit -m "docs(kb): document E5 v0.4 staged validation"
~~~

- [ ] **Step 6: Confirm git status --short is clean and record git rev-parse HEAD**

### Task 13: Execute DEV-20 only after explicit cost approval

**Generated locally, never committed:** a child directory of fittrack-kb-contract/benchmark/e5/v0/runs/dev-20 named with the emitted runId

- [ ] **Step 1: Run npm run benchmark:e5-v04:dev20:dry-run**

Expected: 20 fragments, 10 F2/10 F3, zero API calls, no GOLD leak, projected 207 cost <= 2.50 USD.

- [ ] **Step 2: STOP and obtain explicit user approval for the displayed estimate**

Approval of this plan is not approval to spend.

- [ ] **Step 3: After approval run npm run benchmark:e5-v04:dev20 -- --approve-cost**

Expected: at most 20 full calls, zero full retries, one repair maximum per fragment, ledger persisted before each call.

- [ ] **Step 4: Evaluate**

~~~powershell
$dev20Run = (Get-ChildItem 'benchmark/e5/v0/runs/dev-20' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
node tools/evaluate-e5-llm-benchmark.mjs --run "$dev20Run" --stage DEV_20
~~~

Expected: every DEV-20 gate passes. If any gate fails, report DEV-20: NO, stop before DEV-100, and require a new estimate/approval for any further paid pilot.

### Task 14: Execute DEV-100 once and freeze only after PASS

**Files:**
- Create after PASS only: fittrack-kb-contract/benchmark/e5/v0/v04-freeze.json
- Keep run output local: a child directory of benchmark/e5/v0/runs/dev-100 named with the emitted runId

- [ ] **Step 1: Run npm run benchmark:e5-v04:dev100:dry-run**

Expected: exactly 100 DEV fragments, 50 F2/50 F3, zero calls, no GOLD leak, cost within cap.

- [ ] **Step 2: STOP and obtain explicit user approval, reporting estimate and passing DEV-20 runId**

- [ ] **Step 3: Run once**

~~~bash
npm run benchmark:e5-v04:dev100 -- --approve-cost --dev20-approved
~~~

Expected: at most 100 full calls, zero full retries, one targeted repair maximum per fragment.

- [ ] **Step 4: Evaluate all frozen gates**

~~~powershell
$dev100Run = (Get-ChildItem 'benchmark/e5/v0/runs/dev-100' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
node tools/evaluate-e5-llm-benchmark.mjs --run "$dev100Run" --stage DEV_100
~~~

If any gate fails, report E5 v0.4 DEV-100: NO, stop, do not annotate HOLDOUT-30, and do not rerun DEV-100 as the same candidate.

- [ ] **Step 5: After PASS create v04-freeze.json**

Record fields candidateCommit, promptVersion, promptHash, providerDtoVersion, providerSchemaHash, model, reasoningEffort, prices, dev20RunId, dev100RunId, dev100MetricsHash, holdoutManifestHash, and status READY_FOR_BLIND_HOLDOUT_ANNOTATION. Include no raw response or GOLD answer.

~~~bash
git add fittrack-kb-contract/benchmark/e5/v0/v04-freeze.json
git commit -m "chore(kb): freeze E5 v0.4 holdout candidate"
~~~

- [ ] **Step 6: STOP**

Proceed only with 2026-08-24-e5-v04-holdout-verdict.md. Do not launch HOLDOUT-30 or 207 automatically.
