# Coach Export Working-Set Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the coach export’s duplicate warm-up predicate so projected content and `workingSetCount` share `isWorkingSet`.

**Architecture:** Strengthen the existing export-option test with all four set types and a content/count coherence assertion. Then replace the local predicate in `projectCoachExport` with the existing pure authority from `records.ts`.

**Tech Stack:** TypeScript strict, Vitest.

## Global Constraints

- Preserve the export schema, values, ordering, numbering, totals, IDs, notes, and serialization.
- Preserve `includeWarmups: true` as “include every set”.
- Preserve `includeWarmups: false` as “include normal, dropset, and failure; exclude warmup”.
- Reuse `isWorkingSet`; add no helper, adapter, type, option, or abstraction.
- Do not modify `warmupContext`, records behavior, export types, serializers, translations, repositories, schema, migrations, routes, or dependencies.
- Commit the preservation test separately from the production refactor.
- Work on `master`, as required by `AGENTS.md`.

---

### Task 1: Prove and centralize the export rule

**Files:**
- Modify: `src/lib/export/projectCoachExport.test.ts`
- Modify: `src/lib/export/projectCoachExport.ts`
- Temporary mutation only, restored before commits: `src/lib/records.ts`

**Interfaces:**
- Consumes: `isWorkingSet(set: Pick<WorkoutSet, 'setType'>): boolean`.
- Preserves: `projectCoachExport(scope, sources, options, now): CoachExport`.

- [ ] **Step 1: Record the green baseline**

Run:

```powershell
npm.cmd run test:run -- src/lib/export/projectCoachExport.test.ts
```

Expected: the existing export suite passes.

- [ ] **Step 2: Strengthen the mixed-set fixture and coherence assertion**

Inside `describe('projectCoachExport — options')`, rename `threeSets` to `mixedSets` and use these sets:

```ts
sets: [
  historicalSet({ setType: 'warmup', weight: 40, reps: 12 }),
  historicalSet({ setType: 'normal' }),
  historicalSet({ setType: 'dropset' }),
  historicalSet({ setType: 'failure' }),
],
```

Update the warm-up exclusion test to assert:

```ts
expect(sets).toHaveLength(3);
expect(sets.map((one) => one.number)).toEqual([1, 2, 3]);
expect(sets.map((one) => one.type)).toEqual(['normal', 'dropset', 'failure']);
expect(data.workingSetCount).toBe(sets.length);
```

Update the default-inclusion test to call `mixedSets()` and expect four sets. Update the notes test to call `mixedSets()`.

- [ ] **Step 3: Verify the characterization remains green**

Run:

```powershell
npm.cmd run test:run -- src/lib/export/projectCoachExport.test.ts
```

Expected: pass. This characterizes existing behavior; sensitivity is demonstrated next.

- [ ] **Step 4: Demonstrate sensitivity to divergent authorities**

Temporarily replace only `isWorkingSet`’s body in `src/lib/records.ts` with:

```ts
set.setType === 'normal';
```

Run:

```powershell
npm.cmd run test:run -- src/lib/export/projectCoachExport.test.ts -t "drops warm-ups and renumbers what remains"
```

Expected: FAIL because projected content still has three sets while `workingSetCount` becomes one.

Restore the exact original body:

```ts
set.setType !== 'warmup';
```

Confirm `git diff -- src/lib/records.ts` is empty and rerun the targeted test successfully.

- [ ] **Step 5: Commit the preservation proof**

```powershell
git add -- src/lib/export/projectCoachExport.test.ts
git commit -m "test(export): lie contenu et compteur des séries"
```

- [ ] **Step 6: Replace the duplicate predicate**

In `src/lib/export/projectCoachExport.ts`, replace:

```ts
exercise.sets.filter((set) => set.setType !== 'warmup')
```

with:

```ts
exercise.sets.filter(isWorkingSet)
```

No other production line changes.

- [ ] **Step 7: Verify the refactor and absence of the duplicate**

Run:

```powershell
npm.cmd run test:run -- src/lib/export/projectCoachExport.test.ts src/lib/records.test.ts
npm.cmd run typecheck
npm.cmd exec eslint -- src/lib/export/projectCoachExport.ts src/lib/export/projectCoachExport.test.ts
rg -n "setType !== 'warmup'" src/lib/export/projectCoachExport.ts
git diff --check
```

Expected: tests, typecheck, ESLint, and diff check pass; `rg` returns no match in `projectCoachExport.ts`.

- [ ] **Step 8: Run complete gates**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 9: Commit the refactor**

```powershell
git add -- src/lib/export/projectCoachExport.ts
git commit -m "refactor(export): centralise les séries de travail"
```

After an independent diff review, update `PROGRESS.md` with the shared authority, mutation proof, fresh gate counts, and no manual phone checkpoint because the export bytes and UI are unchanged.
