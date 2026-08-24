# E5-LLM v0.4 HOLDOUT-30 and Final Verdict Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Produce a blind, independently adjudicated HOLDOUT-30, run the frozen E5 v0.4 candidate exactly once, and issue the auditable YES/NO verdict without launching 207 fragments.

**Architecture:** Treat the freeze manifest and frozen selection manifest as immutable inputs. Build the holdout in a separate GOLD namespace using the existing annotation contract, validate annotations without prediction access, then run the already frozen extractor through the manifest-driven runner. The evaluator consumes DEV-100 metrics only for the explicit N/A fallback; no prompt, DTO, validator, or gate may change after holdout observation.

**Tech Stack:** Node.js ESM, node:test, AJV 2020, existing E5 GOLD annotation schema, OpenRouter openai/gpt-5 with reasoning=minimal.

## Global Constraints

- Start only when fittrack-kb-contract/benchmark/e5/v0/v04-freeze.json has status READY_FOR_BLIND_HOLDOUT_ANNOTATION.
- Keep the frozen candidate commit, prompt, DTO, schemas, model, reasoning, prices, and gates unchanged.
- Use exactly the 30 IDs in benchmark/e5/v0/manifests/holdout-30.json: 15 F2 and 15 F3, disjoint from DEV-100.
- Annotators must not access predictions, raw responses, run reports, or model metadata for these fragments.
- Existing DEV-100 GOLD remains bit-for-bit unchanged.
- Any holdout gate failure gives E5 v0.4 ready for full 207-fragment candidate extraction: NO.
- A null holdout classification/fidelity metric can pass only through the documented passing DEV-100 baseline rule.
- Every paid call requires a fresh dry-run estimate and explicit user approval.
- HOLDOUT-30 is executed once for this frozen candidate.
- Never launch the 207 fragments, write curated data, or start Coach/Qwen work.
- Run node/npm commands from fittrack-kb-contract; run git commands from the worktree root.

---

### Task 1: Create the separate blind holdout namespace after freeze

**Files:**
- Create: fittrack-kb-contract/golden/e5-holdout-v04/manifest.json
- Create: fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-a.json
- Create: fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-b.json
- Create: fittrack-kb-contract/golden/e5-holdout-v04/adjudication/adjudicated.json
- Create: fittrack-kb-contract/golden/e5-holdout-v04/adjudication/disagreements.json
- Create: fittrack-kb-contract/golden/e5-holdout-v04/README.md

**Interfaces:**
- Consumes: v04-freeze.json and holdout-30.json.
- Produces: a namespace referencing ../e5/annotation.schema.json and containing no prediction data.

- [ ] **Step 1: Verify freeze and selection hashes**

~~~bash
node tools/validate-e5-v04-holdout.mjs --preflight
~~~

Expected: candidate commit/hash matches HEAD, selection state is FROZEN_BEFORE_V04_PROMPT_OR_DTO, 30 unique IDs, split 15/15, zero DEV overlap.

- [ ] **Step 2: Run the scaffold command**

~~~bash
node tools/scaffold-e5-v04-holdout.mjs
~~~

Expected: create only the six files listed above. Annotation arrays are empty; no prediction, runId, model, prompt, or rawResponse key exists.

- [ ] **Step 3: Validate the blank namespace**

Run: node tools/validate-e5-v04-holdout.mjs --structure-only

Expected: PASS for structure and blindness; INCOMPLETE_ANNOTATION_SET is reported as expected, not hidden.

- [ ] **Step 4: Commit the scaffold separately**

~~~bash
git add fittrack-kb-contract/golden/e5-holdout-v04
git commit -m "test(kb): scaffold blind E5 v0.4 holdout"
~~~

### Task 2: Complete independent annotation A

**Files:**
- Modify: fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-a.json

- [ ] **Step 1: Give annotator A only the frozen fragments, citation catalog, annotation schema, E5 Design Review, and holdout README**

Do not provide model outputs or DEV error reports. Use annotatorId annotator_A, annotationRole primary, and all 30 fragment IDs in manifest order.

- [ ] **Step 2: Annotate each fragment claim by claim**

For each claim preserve exact rawStatement/supportSpans, UTF-8 coordinates, conditions, limitations, cannotConclude, closed citation IDs, all six axes, and ZERO_CLAIM when applicable. PRODUCT_POLICY and MODELING_DECISION text is not extracted as scientific knowledge. Clinical claims remain conditional and non-diagnostic.

- [ ] **Step 3: Validate A after each five-fragment batch**

~~~bash
node tools/validate-e5-v04-holdout.mjs --annotator annotator-a
~~~

Expected after the final batch: 30/30 fragments valid, exact IDs/order, every span rereads, every citation belongs to its fragment.

- [ ] **Step 4: Commit annotation A without any model artifact**

~~~bash
git add fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-a.json
git commit -m "test(kb): add primary E5 v0.4 holdout annotation"
~~~

### Task 3: Complete independent annotation B

**Files:**
- Modify: fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-b.json

- [ ] **Step 1: Give annotator B the same allowed inputs but no access to annotation A**

Use annotatorId annotator_B and annotationRole independent_secondary.

- [ ] **Step 2: Annotate all 30 fragments independently**

Apply the same atomicity, citation, epistemic, cannotConclude, UNRESOLVED, and clinical-safety rules. Do not copy A or consult predictions.

- [ ] **Step 3: Validate B after each five-fragment batch**

~~~bash
node tools/validate-e5-v04-holdout.mjs --annotator annotator-b
~~~

Expected after the final batch: 30/30 valid with no blindness violation.

- [ ] **Step 4: Commit annotation B separately**

~~~bash
git add fittrack-kb-contract/golden/e5-holdout-v04/annotations/annotator-b.json
git commit -m "test(kb): add secondary E5 v0.4 holdout annotation"
~~~

### Task 4: Measure disagreements and adjudicate

**Files:**
- Modify: fittrack-kb-contract/golden/e5-holdout-v04/adjudication/disagreements.json
- Modify: fittrack-kb-contract/golden/e5-holdout-v04/adjudication/adjudicated.json
- Modify: fittrack-kb-contract/golden/e5-holdout-v04/manifest.json

- [ ] **Step 1: Generate the disagreement inventory without predictions**

~~~bash
node tools/validate-e5-v04-holdout.mjs --compare-annotators
~~~

Expected: exact claim-count agreement, span/granularity disagreement, citation disagreement, knowledgeType, epistemicStatus, ZERO_CLAIM, and UNRESOLVED metrics are written only to disagreements.json.

- [ ] **Step 2: Adjudicate every real disagreement**

Each decision records fragmentId, compared claim refs, decision, and evidence from fragment/design contract. Do not manufacture explanations for agreements. Preserve uncertainty when the fragment does not resolve it.

- [ ] **Step 3: Build the adjudicated annotation in manifest order**

Set annotationRole adjudicated. Every one of the 30 fragments appears exactly once; every disagreement has a resolution; no model field exists.

- [ ] **Step 4: Run full holdout validation**

~~~bash
node tools/validate-e5-v04-holdout.mjs
~~~

Expected: PASS for schema, counts, split, disjointness, spans, citations, vocabularies, blindness, disagreements, and source hashes.

- [ ] **Step 5: Commit adjudication and final GOLD manifest**

~~~bash
git add fittrack-kb-contract/golden/e5-holdout-v04/adjudication fittrack-kb-contract/golden/e5-holdout-v04/manifest.json
git commit -m "test(kb): adjudicate E5 v0.4 holdout"
~~~

### Task 5: Verify frozen code and prepare the one allowed holdout run

**Files generated locally, never committed:** holdout dry-run and run directories.

- [ ] **Step 1: Confirm the extractor candidate has not changed**

~~~powershell
node tools/validate-e5-v04-holdout.mjs --verify-freeze
git status --short
$freeze = Get-Content -Raw 'fittrack-kb-contract/benchmark/e5/v0/v04-freeze.json' | ConvertFrom-Json
git diff $freeze.candidateCommit -- fittrack-kb-contract/tools/e5-llm fittrack-kb-contract/tools/run-e5-llm-benchmark.mjs fittrack-kb-contract/tools/evaluate-e5-llm-benchmark.mjs fittrack-kb-contract/benchmark/e5/v0/config.gpt-5.json
~~~

Expected: no extractor/prompt/DTO/evaluator/config change since freeze. Annotation-only commits are allowed.

- [ ] **Step 2: Run official offline checks**

~~~bash
npm run test:e5-llm
npm run validate:e5-gold
node tools/validate-e5-v04-holdout.mjs
~~~

Expected: PASS.

- [ ] **Step 3: Run the zero-call holdout dry-run**

~~~bash
npm run benchmark:e5-v04:holdout30:dry-run
~~~

Expected: exactly 30 fragments, 15 F2/15 F3, zero API calls, frozen hashes match, cost estimate displayed, no GOLD leak.

- [ ] **Step 4: STOP and obtain explicit user approval for the displayed cost**

Do not run the holdout on inferred approval.

### Task 6: Run HOLDOUT-30 once and issue the final verdict

**Generated locally, never committed:** a child directory of fittrack-kb-contract/benchmark/e5/v0/runs/holdout-30 named with the emitted runId

- [ ] **Step 1: After approval run the frozen candidate once**

~~~bash
npm run benchmark:e5-v04:holdout30 -- --approve-cost --dev100-frozen
~~~

Expected: at most 30 full calls, zero full retries, one targeted repair maximum per fragment, no budget overrun.

- [ ] **Step 2: Evaluate against the adjudicated holdout with the frozen DEV-100 baseline**

~~~powershell
$freeze = Get-Content -Raw 'fittrack-kb-contract/benchmark/e5/v0/v04-freeze.json' | ConvertFrom-Json
$holdoutRun = (Get-ChildItem 'fittrack-kb-contract/benchmark/e5/v0/runs/holdout-30' -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
$dev100Metrics = Join-Path 'fittrack-kb-contract/benchmark/e5/v0/runs/dev-100' ($freeze.dev100RunId + '/metrics.json')
node tools/evaluate-e5-llm-benchmark.mjs --run "$holdoutRun" --stage HOLDOUT_30 --dev100-metrics "$dev100Metrics"
~~~

Expected: report GLOBAL/F2/F3, all historical gates, four new gates, partial/global statuses, filtered safety attempts, costs, and N/A reasons.

- [ ] **Step 3: Apply the binary verdict rule**

If every gate passes, report exactly:

E5 v0.4 ready for full 207-fragment candidate extraction: YES

If one or more gates fail, report exactly:

E5 v0.4 ready for full 207-fragment candidate extraction: NO

List failed gates with actual and threshold. Do not change code, prompt, DTO, GOLD, or gates after observing the result.

- [ ] **Step 4: Preserve audit artifacts locally and commit no generated result automatically**

Inspect git status and index. Keep raw responses, predictions, metrics, diagnostics, errors, and reports local unless the user separately approves a curated audit commit.

- [ ] **Step 5: STOP**

Do not launch 207 fragments. A YES only authorizes asking the user for a new explicit approval. A NO ends v0.4 and requires a separately designed next version with a fresh holdout.
