# Task 6 — Preserve valid sisters through targeted repair

## Files

- `fittrack-kb-contract/tools/e5-llm/extractor.mjs`
- `fittrack-kb-contract/tools/e5-llm/provider-dto.mjs`
- `fittrack-kb-contract/tests/e5-llm/repair-salvage-v04.test.mjs`

## Decisions

- The v3 coverage DTO is detected structurally and causes the extractor to build and pass `coverageUnits` to every v0.4 validation pass. The explicitly selected v2 replay DTO remains coverage-free.
- A partial v0.4 result repairs only `repairableClaimIndexes`; anchor merging remains limited to those indexes.
- A malformed repair, failed revalidation of the repaired anchor, or provider error returns the original `PARTIALLY_VALIDATED` result, preserves its retained claims, appends `REPAIR_FAILED`, and performs no full regeneration.
- A run is limited to one full call and one repair call; no repair retry is possible.

## TDD

- RED: `node --test tests/e5-llm/repair-salvage-v04.test.mjs` initially failed 4/4: no v0.4 coverage audit was returned and failed repairs replaced the partial result with `REJECTED`.
- GREEN: the same test now passes 4/4. It covers targeted claim 2 repair, preservation of claim 1, malformed repair salvage, provider-error salvage, coverage activation, and the one-repair budget.

## Verification

- `node --test tests/e5-llm/repair-salvage-v04.test.mjs tests/e5-llm/anchors-v03.test.mjs tests/e5-llm/benchmark.test.mjs` — 51 passed, 0 failed.
- `node --test tests/e5-llm/*.test.mjs` — 121 passed, 0 failed.
- `node tools/run-e5-llm-benchmark.mjs --mode dry-run` — 100 fragments, 0 provider calls, no GOLD leak. Its generated dry-run file was removed afterwards and is not committed.

## Coverage proof

The v0.4 integration test asserts a complete returned `coverageAudit` after the successful repair. That field is populated only because the live extractor builds and passes `coverageUnits` for the v3 provider schema; the v2 anchors replay regression suite still passes.

## Call budget

- Full calls: exactly 1.
- Full retries: 0.
- Repair calls: at most 1.
- Real provider calls: 0 (test adapters and dry-run only).

## Auto-review

- `git diff --check` is clean.
- Scope review found changes limited to the requested implementation and test files plus this report; prompt, manifests, GOLD, HOLDOUT, corpus, canonical, and curated data are unchanged.
- Independent review found no blocking defect. It confirmed the v3/v2 split, the one-repair limit, and partial-result salvage.

## Commit

`feat(kb): retain valid claims across anchor repair` (SHA reported at handoff)

## Concerns

- P2 review note: the dedicated new test uses v3 only. The existing `anchors-v03` suite covers the explicitly selected v2 replay repair success and one-repair limit.
- P3 review note: v3 is identified from the current factory schema shape. A future equivalent schema variant must preserve the coverage fields or update `providerSchemaIncludesCoverage`.
