# External Exercise Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Hevy exercise association an explicit, persisted user confirmation, fix the real Pallof press regression, and keep repeated CSV imports duplicate-free.

**Architecture:** A pure `ExternalExerciseIdentityRegistry` reviews exact source identities against the catalogue and confirmed bindings. Dexie stores those bindings in one new table; the existing Hevy repository writes bindings, custom exercises, workouts, sets, and routines atomically. Catalogue aliases and lexical ranking remain suggestions only.

**Tech Stack:** React 19, TypeScript strict, Dexie.js/IndexedDB, `fake-indexeddb`, Vitest, Testing Library, Vite, Tailwind CSS v4.

## Global Constraints

- All behavior remains fully offline and local-first.
- Never modify the already shipped `db.version(1)` or `db.version(2)` declarations; append version 3.
- An unknown external identity is never automatically confirmed.
- Only a binding with `verification: 'user'` may be reused without a new action.
- Exact identity normalization may normalize Unicode, case, accents, punctuation, and repeated spaces; it must not remove or translate words, singularize them, or drop equipment.
- Catalogue aliases and similarity scores may order suggestions only.
- `Développé Debout Poulie Centrée` suggests `pallof-press`, never `cable-shoulder-press`.
- A target must be alive and have the same `measurementType`; otherwise the review status is `conflict`.
- Bindings, custom exercises, workouts, rows, sets, routines, and import keys are written in one Dexie transaction.
- Existing `hevyExerciseMappings` settings are not trusted or migrated because automatic and manual legacy mappings cannot be distinguished.
- All UI text lives in `src/i18n/fr.ts`; no hard-coded French in components.
- TDD is mandatory: every production behavior begins with a focused failing test whose failure is observed.
- Workers in a parallel wave own only the files listed for their task, stage those exact files, and never revert or stage another worker’s changes.

## Parallel Execution Map

```text
Wave A — independent, run in parallel
├── Task 1: Dexie binding schema
├── Task 2: Pure identity registry and Pallof suggestion
└── Task 3: Evidence presentation component and French copy

Wave B — after Wave A, independent file ownership, run in parallel
├── Task 4: Repository/import transaction integration
└── Task 5: Draft and UI state integration

Wave C — after Wave B
└── Task 6: Whole-path regression, cleanup, documentation, verification
```

---

### Task 1: Persist confirmed external exercise bindings

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/db.ts`
- Modify: `src/data/dbMigration.test.ts`
- Create: `src/data/repositories/externalExerciseBindings.ts`
- Create: `src/data/repositories/externalExerciseBindings.test.ts`

**Interfaces:**
- Produces:

```ts
export type ExternalExerciseSource = 'hevy_csv';

export interface ExternalExerciseBinding extends Syncable {
  source: ExternalExerciseSource;
  identityKey: string;
  sourceTitle: string;
  exerciseId: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  verification: 'user';
  confirmedAt: number;
}

export async function listExternalExerciseBindings(
  source: ExternalExerciseSource,
): Promise<ExternalExerciseBinding[]>;
```

- The table is also available as `db.externalExerciseBindings`.
- Task 4 writes bindings inside its own transaction and therefore uses the table directly; this repository entry point is the read seam used by preparation.

- [ ] **Step 1: Write the migration test that requires schema version 3**

Extend `src/data/dbMigration.test.ts` so the existing version-1 fixture opens through every shipped upgrade:

```ts
expect(db.verno).toBe(3);
expect(db.tables.map((table) => table.name)).toContain(
  'externalExerciseBindings',
);
expect(await db.exercises.get('bench')).toBeDefined();
expect(await db.workouts.get('winter')).toBeDefined();
```

The preservation assertions are mandatory because Dexie drops stores omitted from a new `stores(...)` declaration.

- [ ] **Step 2: Run the migration test and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/data/dbMigration.test.ts
```

Expected: FAIL because `db.verno` is 2 and the table does not exist.

- [ ] **Step 3: Add the binding type and version-3 schema**

Add `ExternalExerciseSource` and `ExternalExerciseBinding` beside `Exercise` in `src/data/types.ts`.

In `src/data/db.ts`, import the type, add:

```ts
externalExerciseBindings!: EntityTable<ExternalExerciseBinding, 'id'>;
```

Append `version(3).stores(...)` with the complete current schema plus:

```ts
externalExerciseBindings:
  'id, [source+identityKey], exerciseId, updatedAt, deletedAt',
```

Do not add an upgrade callback: legacy settings are intentionally left inert and no binding is invented.

- [ ] **Step 4: Run the migration test and observe GREEN**

Run:

```powershell
npm.cmd run test:run -- src/data/dbMigration.test.ts
```

Expected: PASS; old exercises/workouts survive and the new table exists.

- [ ] **Step 5: Write repository tests**

Create `src/data/repositories/externalExerciseBindings.test.ts` with `resetDb` and fixtures proving:

```ts
expect(await listExternalExerciseBindings('hevy_csv')).toEqual([
  expect.objectContaining({
    source: 'hevy_csv',
    identityKey: 'developpe debout poulie centree',
    exerciseId: 'pallof',
    verification: 'user',
  }),
]);
```

Also insert a soft-deleted binding and prove it is excluded and results are sorted by `identityKey`.

- [ ] **Step 6: Run the repository test and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/externalExerciseBindings.test.ts
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 7: Implement the minimal read repository**

Create `src/data/repositories/externalExerciseBindings.ts`:

```ts
export async function listExternalExerciseBindings(
  source: ExternalExerciseSource,
): Promise<ExternalExerciseBinding[]> {
  return (
    await db.externalExerciseBindings
      .where('[source+identityKey]')
      .between([source, Dexie.minKey], [source, Dexie.maxKey])
      .toArray()
  )
    .filter((binding) => binding.deletedAt === 0)
    .sort((left, right) =>
      left.identityKey.localeCompare(right.identityKey),
    );
}
```

- [ ] **Step 8: Verify GREEN and commit only Task 1 files**

Run:

```powershell
npm.cmd run test:run -- src/data/dbMigration.test.ts src/data/repositories/externalExerciseBindings.test.ts
npm.cmd run typecheck
```

Expected: all targeted tests and typecheck PASS.

Commit:

```powershell
git add -- src/data/types.ts src/data/db.ts src/data/dbMigration.test.ts src/data/repositories/externalExerciseBindings.ts src/data/repositories/externalExerciseBindings.test.ts
git commit -m "feat(import): persiste les identités externes confirmées"
```

---

### Task 2: Build the pure identity registry and correct the Pallof suggestion

**Files:**
- Create: `src/lib/externalExerciseIdentity.ts`
- Create: `src/lib/externalExerciseIdentity.test.ts`
- Modify: `src/lib/hevyExerciseMatch.ts`
- Modify: `src/lib/hevyExerciseMatch.test.ts`
- Modify: `src/lib/hevyExerciseAliases.ts`

**Interfaces:**
- Consumes `ExternalExerciseBinding`, `Exercise`, `Equipment`, `MeasurementType`, and `NewExercise`.
- Produces:

```ts
export interface ExternalExerciseObservation {
  source: 'hevy_csv';
  sourceTitle: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  sessionCount: number;
  setCount: number;
  examples: readonly ExternalExerciseExample[];
}

export type ExternalExerciseReviewEntry =
  | ConfirmedExternalExercise
  | UnconfirmedExternalExercise
  | ConflictingExternalExercise;

export function externalExerciseIdentityKey(title: string): string;

export function createExternalExerciseIdentityRegistry(
  exercises: readonly Exercise[],
  bindings: readonly ExternalExerciseBinding[],
  suggestions: ReadonlyMap<string, readonly Exercise[]>,
): ExternalExerciseIdentityRegistry;
```

- `ExternalExerciseIdentityRegistry.review(observations)` is pure and synchronous.
- `resolve(entries, decisions, confirmedAt)` returns:

```ts
{
  exercisesByIdentityKey: ReadonlyMap<string, Exercise>;
  exercisesToCreate: Exercise[];
  bindingsToWrite: ExternalExerciseBinding[];
}
```

- [ ] **Step 1: Write exact-key tests**

In `externalExerciseIdentity.test.ts`, assert:

```ts
expect(
  externalExerciseIdentityKey(' Développé  Debout, Poulie Centrée '),
).toBe('developpe debout poulie centree');

expect(
  externalExerciseIdentityKey('Développé Debout Poulie Centrée'),
).not.toBe(externalExerciseIdentityKey('Développé Debout Centrée'));
```

Add separate assertions proving `machine`, `assis`, and plural endings are retained.

- [ ] **Step 2: Run and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/lib/externalExerciseIdentity.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement conservative exact normalization**

Use Unicode NFD, remove combining marks, lowercase, replace non-letter/non-number runs with one space, and trim. Do not call the existing fuzzy normalizer.

- [ ] **Step 4: Add registry review tests**

Cover these observable cases:

```ts
expect(review[0]?.status).toBe('needs_confirmation');
expect(review[0]?.suggestions[0]?.exercise.slug).toBe('pallof-press');
```

Then add:

- a live compatible `verification: 'user'` binding → `confirmed`;
- a deleted target → `conflict: target_deleted`;
- a missing target → `conflict: target_missing`;
- changed measurement type → `conflict: measurement_changed`;
- a suggestion with no binding remains `needs_confirmation`;
- a legacy/coded suggestion never becomes `confirmed`.

- [ ] **Step 5: Run and observe the expected registry failures**

Run the same focused test. Expected: key tests pass, registry behavior tests FAIL because review/resolve are absent.

- [ ] **Step 6: Implement review and resolve minimally**

Implementation rules:

- index exercises by ID;
- index active user bindings by exact identity key;
- confirmed bindings win only when target is alive and compatible;
- broken bindings return `conflict` with suggestions;
- unbound observations return `needs_confirmation`;
- resolve requires one decision for every non-confirmed entry;
- custom decisions materialize an `Exercise` with `isCustom: 1`;
- every new or changed decision creates a `verification: 'user'` binding;
- duplicate decisions for one key throw `Duplicate external exercise decision`.

- [ ] **Step 7: Turn the current canonical alias into a suggestion and fix Pallof**

In `hevyExerciseAliases.ts` change:

```ts
'developpe debout centree|cable': 'pallof-press',
```

Rename `findCanonicalHevyExercise` to `findSuggestedHevyExercise` and update only this task’s tests. Keep fuzzy ranking unchanged; its output is never confirmation.

Change the regression assertion to:

```ts
['Développé Debout Poulie Centrée', 'pallof-press'],
```

Add an assertion that `cable-shoulder-press` is not returned for that title.

- [ ] **Step 8: Verify GREEN and commit only Task 2 files**

Run:

```powershell
npm.cmd run test:run -- src/lib/externalExerciseIdentity.test.ts src/lib/hevyExerciseMatch.test.ts
npm.cmd run typecheck
```

Expected: all targeted tests and typecheck PASS after Task 1’s types are present.

Commit:

```powershell
git add -- src/lib/externalExerciseIdentity.ts src/lib/externalExerciseIdentity.test.ts src/lib/hevyExerciseMatch.ts src/lib/hevyExerciseMatch.test.ts src/lib/hevyExerciseAliases.ts
git commit -m "fix(import): identifie le Pallof press sans préconfirmation"
```

---

### Task 3: Present exercise evidence without owning import state

**Files:**
- Create: `src/features/history/HevyExerciseEvidence.tsx`
- Create: `src/features/history/HevyExerciseEvidence.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces:

```ts
export interface HevyExerciseEvidenceExample {
  workoutName: string;
  startedAt: number;
  sets: readonly {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    distanceMeters?: number;
  }[];
}

export interface HevyExerciseEvidenceObservation {
  sessionCount: number;
  setCount: number;
  examples: readonly HevyExerciseEvidenceExample[];
}

export function HevyExerciseEvidence({
  observation,
}: {
  observation: HevyExerciseEvidenceObservation;
}): React.ReactNode;
```

- The local prop is structural so Task 3 is independent of Task 2; Task 5 can
  pass an `ExternalExerciseObservation` directly.
- Task 5 embeds this component in the mapping sheet. Task 3 must not edit any existing Hevy import component.

- [ ] **Step 1: Write the rendering test**

Render an observation with two sessions and four sets. Assert the user sees:

- `2 séances · 4 séries`;
- `LOWER A`;
- the localized date;
- `10 kg × 15`, `15 kg × 12`.

The test must query accessible text and must not inspect Tailwind class names.

- [ ] **Step 2: Run and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/features/history/HevyExerciseEvidence.test.tsx
```

Expected: FAIL because the component and translation keys do not exist.

- [ ] **Step 3: Add French copy**

Add exact keys under `history` in `fr.ts`:

```ts
importEvidenceOne: '{sessionCount} séance · {setCount} séries',
importEvidence: '{sessionCount} séances · {setCount} séries',
importEvidenceSet: '{weight} kg × {reps}',
importEvidenceExamples: 'Exemples dans le fichier',
importNeedsConfirmation: 'À confirmer',
importConfirmed: 'Confirmé',
importConflict: 'Association à vérifier',
importConflictMissing: 'L’exercice associé est introuvable',
importConflictDeleted: 'L’exercice associé a été supprimé',
importConflictMeasurement: 'Le type de mesure a changé',
importNewConfirmationOne: '{count} nouvelle association',
importNewConfirmation: '{count} nouvelles associations',
importReusedConfirmationOne: '{count} association confirmée réutilisée',
importReusedConfirmation: '{count} associations confirmées réutilisées',
```

Use the existing plural-selection pattern rather than embedding conditions in translations.

- [ ] **Step 4: Implement the focused component**

Render one compact summary followed by at most three example sessions. Reuse `Card`/typography tokens only if they fit inside another sheet; do not introduce a new layout system. Format absent weight/reps by using only the values present in each set.

- [ ] **Step 5: Verify GREEN and commit only Task 3 files**

Run:

```powershell
npm.cmd run test:run -- src/features/history/HevyExerciseEvidence.test.tsx
npm.cmd run typecheck
```

Expected: test and typecheck PASS after Task 2’s observation type is present.

Commit:

```powershell
git add -- src/features/history/HevyExerciseEvidence.tsx src/features/history/HevyExerciseEvidence.test.tsx src/i18n/fr.ts
git commit -m "feat(import): montre les preuves de chaque exercice Hevy"
```

---

### Task 4: Integrate confirmed bindings into the Hevy repository transaction

**Files:**
- Modify: `src/data/repositories/hevyImport.ts`
- Modify: `src/data/repositories/hevyImport.test.ts`
- Modify: `src/data/repositories/hevyWorkoutEntities.ts`
- Modify: `src/data/repositories/hevyRoutineImport.ts`
- Modify: `src/data/repositories/settings.ts`
- Modify: `src/data/repositories/settings.test.ts`

**Interfaces:**
- Consumes Task 1’s table/repository and Task 2’s exact key/registry types.
- Produces:

```ts
export interface HevyImportPreparation {
  exercises: Exercise[];
  existingImportKeys: string[];
  confirmedBindings: ExternalExerciseBinding[];
  aliveRoutineFolderNames: string[];
}

export type HevyExerciseResolutions = Record<
  string,
  HevyExerciseResolution
>;
```

The record key is now `externalExerciseIdentityKey(sourceTitle)`, never `hevyExerciseSourceKey`.

- [ ] **Step 1: Write preparation tests that distrust legacy settings**

Seed:

- a legacy `hevyExerciseMappings` setting pointing the Pallof title to `cable-shoulder-press`;
- a confirmed binding pointing the exact identity to `pallof-press`.

Assert `prepareHevyImport` returns the confirmed binding and does not expose the legacy mapping.

- [ ] **Step 2: Run and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/hevyImport.test.ts
```

Expected: FAIL because preparation still reads `getHevyExerciseMappings`.

- [ ] **Step 3: Replace settings reads with the binding repository**

Remove Hevy-mapping exports from `settings.ts` only after callers have moved. Keep unrelated plate and weekly-goal settings unchanged.

`prepareHevyImport` loads:

```ts
listExternalExerciseBindings('hevy_csv')
```

and returns `confirmedBindings`.

- [ ] **Step 4: Write the atomic import test**

Create explicit resolutions for the 25 fixture titles, with
`Développé Debout Poulie Centrée` targeting `pallof-press`.

After import assert:

```ts
expect(await db.externalExerciseBindings.count()).toBe(25);
expect(
  await db.workoutExercises
    .where('exerciseId')
    .equals(pallof.id)
    .count(),
).toBe(2);
```

Assert the four completed sets belong to the Pallof exercise and no workout row references `cable-shoulder-press`.

Force a late `bulkAdd` failure as the existing rollback test does and assert bindings, exercises, workouts, sets, and routines all remain at their pre-import counts.

- [ ] **Step 5: Run and observe RED**

Expected failures: no binding writes, wrong Pallof target, and incomplete rollback table coverage.

- [ ] **Step 6: Switch every import identity lookup to the exact key**

Use `externalExerciseIdentityKey` in:

- `sourceKeys`;
- `measurementBySourceKey`;
- `resolveExercises`;
- `buildHevyWorkoutEntities`;
- `buildHevyRoutineEntities`.

Do not use the fuzzy suggestion key for entity lookup.

- [ ] **Step 7: Write user-confirmed bindings inside the import transaction**

Add `db.externalExerciseBindings` to the transaction table list.

For every resolution, materialize:

```ts
newEntity<ExternalExerciseBinding>({
  source: 'hevy_csv',
  identityKey,
  sourceTitle,
  exerciseId: exercise.id,
  measurementType,
  ...(equipmentHint === undefined ? {} : { equipmentHint }),
  verification: 'user',
  confirmedAt: importedAt,
});
```

Use `bulkPut` keyed by existing binding IDs when a confirmation changes; do not create two active rows for one `[source+identityKey]`.

- [ ] **Step 8: Preserve duplicate-import behavior**

Extend the repository test to import the same parsed CSV twice and assert the second result reports zero imported workouts/sets/routines/exercises and does not duplicate bindings.

- [ ] **Step 9: Verify GREEN and commit only Task 4 files**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/hevyImport.test.ts src/data/repositories/settings.test.ts
npm.cmd run typecheck
```

Expected: targeted tests and typecheck PASS.

Commit:

```powershell
git add -- src/data/repositories/hevyImport.ts src/data/repositories/hevyImport.test.ts src/data/repositories/hevyWorkoutEntities.ts src/data/repositories/hevyRoutineImport.ts src/data/repositories/settings.ts src/data/repositories/settings.test.ts
git commit -m "feat(import): écrit les associations confirmées atomiquement"
```

---

### Task 5: Require explicit confirmation in the import draft and UI

**Files:**
- Modify: `src/features/history/hevyImportDraft.ts`
- Modify: `src/features/history/hevyImportDraft.test.ts`
- Modify: `src/features/history/HevyImportMappingStep.tsx`
- Create: `src/features/history/HevyImportMappingStep.test.tsx`
- Modify: `src/features/history/HevyExerciseMappingSheet.tsx`
- Modify: `src/features/history/HevyExerciseMappingSheet.test.tsx`
- Modify: `src/features/history/HevyImportScreen.tsx`
- Modify: `src/features/history/HevyImportReview.tsx`

**Interfaces:**
- Consumes Task 2’s registry/review types, Task 3’s evidence component, and Task 4’s `confirmedBindings`.
- Produces draft rows whose state is explicit:

```ts
export interface HevyMappingDraftRow {
  review: ExternalExerciseReviewEntry;
  resolution?: HevyExerciseResolution;
  resolutionSource?: 'binding' | 'user';
}
```

- `unresolvedHevySources` returns rows whose review is not a valid confirmed binding and which have no user resolution.

- [ ] **Step 1: Replace the canonical-preconfirmation test with RED trust tests**

In `hevyImportDraft.test.ts`, change the former “preconfirms canonical alias” expectation:

```ts
expect(row.review.status).toBe('needs_confirmation');
expect(row.resolution).toBeUndefined();
expect(unresolvedHevySources(draft)).toHaveLength(1);
```

Add:

- a valid confirmed binding pre-resolves with `resolutionSource: 'binding'`;
- a legacy suggestion never pre-resolves;
- a deleted/incompatible bound target remains `conflict`;
- user selection resolves either `needs_confirmation` or `conflict`;
- evidence counts sessions and sets and caps examples at three.

- [ ] **Step 2: Run and observe RED**

Run:

```powershell
npm.cmd run test:run -- src/features/history/hevyImportDraft.test.ts
```

Expected: FAIL because canonical aliases are still auto-resolved and no review/evidence exists.

- [ ] **Step 3: Build observations and reviews in the draft**

Aggregate the already parsed importable workouts by exact identity key:

- unique session count;
- total set count;
- up to three examples in newest-first order;
- source measurement and inferred equipment.

Create the registry with preparation exercises/bindings and a suggestion map built from `findSuggestedHevyExercise` plus ranked candidates. Store the review entry on each row. Only a valid user binding sets the initial resolution.

- [ ] **Step 4: Add mapping-step rendering tests**

Create `HevyImportMappingStep.test.tsx` proving:

- a suggestion row shows “À confirmer” and no checked icon;
- a user binding shows “Confirmé” and a checked icon;
- a conflict shows an explicit warning and no checked icon;
- Pallof source shows the target metadata `Abdominaux · Poulie`;
- `HevyExerciseEvidence` is reachable when opening the row.

- [ ] **Step 5: Run and observe RED**

Expected: FAIL because the component still treats every resolution as confirmed and lacks status copy.

- [ ] **Step 6: Implement status-driven mapping UI**

Use existing translation keys where their meaning is still correct and Task 3’s
status/conflict/count keys for the new states. Add no French strings here; Task
3 owns `fr.ts`.

Rules:

- green check only for `resolutionSource: 'binding' | 'user'`;
- suggestion label never says “Correspondance FitTrack” as a certainty;
- conflict label includes the reason;
- mapping sheet displays target name, primary muscle, equipment, and evidence;
- selecting a target changes `resolutionSource` to `user`;
- Continue remains disabled while any row lacks a usable resolution.

- [ ] **Step 7: Update review and screen orchestration**

The review screen reports:

- new confirmations;
- reused confirmations;
- custom exercises.

The submit action passes exact-key resolutions to Task 4’s repository. On a failed import, returning to mapping preserves user choices in memory and writes no binding.

- [ ] **Step 8: Verify GREEN and commit only Task 5 files**

Run:

```powershell
npm.cmd run test:run -- src/features/history/hevyImportDraft.test.ts src/features/history/HevyImportMappingStep.test.tsx src/features/history/HevyExerciseMappingSheet.test.tsx
npm.cmd run typecheck
```

Expected: targeted tests and typecheck PASS.

Commit:

```powershell
git add -- src/features/history/hevyImportDraft.ts src/features/history/hevyImportDraft.test.ts src/features/history/HevyImportMappingStep.tsx src/features/history/HevyImportMappingStep.test.tsx src/features/history/HevyExerciseMappingSheet.tsx src/features/history/HevyExerciseMappingSheet.test.tsx src/features/history/HevyImportScreen.tsx src/features/history/HevyImportReview.tsx
git commit -m "feat(import): exige la validation des exercices Hevy"
```

---

### Task 6: Verify the whole path and update project memory

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces a green whole-project baseline and the phone checkpoint.

- [ ] **Step 1: Run focused whole-path tests before cleanup**

Run:

```powershell
npm.cmd run test:run -- src/lib/hevyExerciseMatch.test.ts src/lib/externalExerciseIdentity.test.ts src/data/dbMigration.test.ts src/data/repositories/externalExerciseBindings.test.ts src/data/repositories/hevyImport.test.ts src/features/history/hevyImportDraft.test.ts src/features/history/HevyImportMappingStep.test.tsx src/features/history/HevyExerciseMappingSheet.test.tsx
```

Expected: all focused tests PASS with pristine output.

- [ ] **Step 2: Find and remove obsolete authority paths**

Run:

```powershell
rg -n "findCanonicalHevyExercise|HEVY_EXERCISE_SLUG_BY_KEY|getHevyExerciseMappings|setHevyExerciseMappings|resolutionSource.*canonical" src
```

Expected: zero production references. Test names/comments may mention the former bug only when explaining the regression.

If this command finds a production reference, return it to the Task 2, 4, or 5
owner according to the file list above; Task 6 does not absorb implementation
cleanup into an unreviewed miscellaneous diff.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: all commands exit 0; all tests pass; build completes.

- [ ] **Step 4: Update `PROGRESS.md`**

Record:

- exact root cause and Pallof correction;
- version-3 binding table;
- explicit-confirmation trust rule;
- exact test counts and build evidence;
- no library replacement;
- checkpoint: reset FitTrack, import the CSV, confirm 25 identities, inspect both `LOWER A` sessions and muscle analytics, then reimport and observe zero duplicates.

- [ ] **Step 5: Commit verification/documentation**

```powershell
git add -- PROGRESS.md
git commit -m "docs: consigne la fiabilisation des exercices importés"
```
