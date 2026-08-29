# Persisted Records and Estimated 1RM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every initial mark and strict personal-record improvement, expose them on a dedicated progression-rail page, and add a configurable estimated 1RM everywhere it is useful.

**Architecture:** Treat `personalRecords` as a repairable projection of workout history. A pure deterministic engine emits the canonical timeline; repositories assemble historical sources, reconcile stable record identities, and update the projection in the same Dexie transaction as every invalidating mutation. UI reads enriched repository view models only. Estimated 1RM is a pure formula module, defaults to Epley, and is persisted as a record only for `weight_reps` snapshots.

**Tech Stack:** React 19, TypeScript strict, Dexie, dexie-react-hooks, Tailwind CSS v4, React Router hash routes, Vitest, Testing Library, fake-indexeddb, Capacitor Android.

## Global constraints

- Implement `docs/design/specs/2026-08-11-persisted-records-one-rep-max-design.md` exactly.
- A first qualifying performance is persisted as an initial mark; only a strict improvement is celebrated.
- Compare raw numeric values and round only display values to `0.1 kg`.
- 1RM accepts finite positive weight and integer reps `1..12`; one rep returns the exact load.
- 1RM applies only to the historical `weight_reps` snapshot, never to bodyweight, added weight, assistance, duration, or distance.
- Warm-up sets never produce records. Ties never produce duplicate events.
- Reuse `sessionTotals` for set/session tonnage. Do not introduce another effective-load formula.
- A record row uses the stable business key `exerciseId + type + workoutId + (workoutSetId ?? '')`; reconciliation preserves UUIDs and soft-deletes obsolete rows.
- Keep the existing `personalRecords` indexes. No Dexie schema version or new index is allowed before the benchmark proves it necessary.
- Components never import `db`. All visible French copy lives in `src/i18n/fr.ts`.
- Mobile touch targets remain at least 48 px; reduced-motion users get no rail insertion animation.
- Do not add confetti, decorative gradients, or a second design system. The rail uses the existing dark surfaces plus one restrained accent on the current record.
- TDD is mandatory for business logic and repositories: witness RED, implement GREEN, then run the focused regression set.
- REQUIRED SUB-SKILL for Tasks 5, 8, 9, and 10: apply `frontend-design` before changing HTML/CSS.
- `SettingsScreen.tsx` and `WorkoutScreen.tsx` are already near/over the project size limit. Extract the new UI instead of growing either file further.

---

### Task 1: Pure estimated-1RM engine

**Files:**
- Create: `src/lib/oneRepMax.ts`
- Create: `src/lib/oneRepMax.test.ts`

**Interfaces:**

```ts
export type OneRepMaxFormula = 'epley' | 'brzycki' | 'lombardi';

export function estimateOneRepMax(
  weightKg: number,
  reps: number,
  formula: OneRepMaxFormula,
): number | undefined;
```

- [ ] **Step 1: Write the failing formula contract**

Cover all three formulas, exact one-rep identity, raw decimal output, and invalid input:

```ts
it.each([
  ['epley', 116.66666666666667],
  ['brzycki', 112.5],
  ['lombardi', 117.4618943088019],
] as const)('estimates 100 kg x 5 with %s', (formula, expected) => {
  expect(estimateOneRepMax(100, 5, formula)).toBeCloseTo(expected, 10);
});

it.each(['epley', 'brzycki', 'lombardi'] as const)(
  'returns the exact load for one rep with %s',
  (formula) => expect(estimateOneRepMax(137.5, 1, formula)).toBe(137.5),
);

it.each([
  [0, 5], [-1, 5], [Number.NaN, 5], [100, 0], [100, 13], [100, 2.5],
])('rejects weight %s and reps %s', (weight, reps) => {
  expect(estimateOneRepMax(weight, reps, 'epley')).toBeUndefined();
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/lib/oneRepMax.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal pure function**

Validate before the switch. Return `weightKg` early for `reps === 1`; otherwise apply the approved formulas without rounding.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm.cmd run test:run -- src/lib/oneRepMax.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/lib/oneRepMax.ts src/lib/oneRepMax.test.ts
git commit -m "feat: estimate one rep max"
```

---

### Task 2: Canonical pure record projection

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/records.ts`
- Modify: `src/lib/records.test.ts`

**Interfaces:**

```ts
export type PersonalRecordType =
  | 'max_weight'
  | 'max_added_weight'
  | 'min_assistance'
  | 'max_reps'
  | 'best_1rm'
  | 'max_volume_set'
  | 'max_volume_session'
  | 'max_duration'
  | 'max_distance';

export interface PersonalRecord extends Syncable {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: number;
  workoutId: string;
  workoutSetId?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  formula?: OneRepMaxFormula;
}
```

`records.ts` produces the exact `RecordSource`, `RecordEventDraft`, and `projectRecordTimeline` contracts from the design specification.

- [ ] **Step 1: Replace the old derived-record tests with projection tests**

Keep focused regressions for `setVolume`, `isWorkingSet`, and `bestSets` while consumers still use them. Add table-driven candidates for every measurement type:

```ts
it('emits the initial mark and only strict improvements', () => {
  const events = projectRecordTimeline([
    source({ workoutSetId: 's1', weight: 80, reps: 5, achievedAt: 1 }),
    source({ workoutSetId: 's2', weight: 80, reps: 5, achievedAt: 2 }),
    source({ workoutSetId: 's3', weight: 82.5, reps: 5, achievedAt: 3 }),
  ], 'epley');

  expect(events.filter(({ type }) => type === 'max_weight').map(({ workoutSetId }) => workoutSetId))
    .toEqual(['s1', 's3']);
});

it('uses lower-is-better semantics for assistance', () => {
  const events = projectRecordTimeline([
    assistedSource({ workoutSetId: 's1', weight: 35, reps: 8 }),
    assistedSource({ workoutSetId: 's2', weight: 40, reps: 10 }),
    assistedSource({ workoutSetId: 's3', weight: 30, reps: 8 }),
  ], 'epley');

  expect(values(events, 'min_assistance')).toEqual([35, 30]);
});
```

Also assert:

- deterministic order is `achievedAt`, `exerciseOrder`, `setOrder`, then stable source ID;
- one series may emit several categories;
- warm-ups and incomplete/deleted sources emit nothing;
- `best_1rm` exists only for `weight_reps` and only with reps `1..12`;
- session tonnage events have no `workoutSetId` and update once per workout/exercise;
- all measurement-type/category mappings match the design table;
- ties are absent for every category, including `min_assistance`;
- raw 1RM values decide improvements even when both display as the same tenth.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:run -- src/lib/records.test.ts src/lib/oneRepMax.test.ts
```

Expected: FAIL on the new types and missing canonical projector.

- [ ] **Step 3: Implement candidate evaluation and projection**

Keep the module pure. Split private helpers by responsibility:

```ts
function candidatesFor(source: RecordSource, formula: OneRepMaxFormula): RecordEventDraft[];
function isImprovement(type: PersonalRecordType, value: number, current?: number): boolean;
function compareSources(left: RecordSource, right: RecordSource): number;
```

Emit an event when no incumbent exists or when the candidate strictly improves it. Update the in-memory incumbent after every event. Preserve entered context (`weight`, `reps`, duration, distance, formula) on each draft.

- [ ] **Step 4: Verify GREEN and regressions**

```powershell
npm.cmd run test:run -- src/lib/records.test.ts src/lib/oneRepMax.test.ts src/lib/volume.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/data/types.ts src/lib/records.ts src/lib/records.test.ts
git commit -m "feat: project personal record timelines"
```

---

### Task 3: Assemble deterministic record sources from history

**Files:**
- Create: `src/data/repositories/recordSources.ts`
- Create: `src/data/repositories/recordSources.test.ts`
- Modify: `src/lib/volume.ts`
- Modify: `src/lib/volume.test.ts`

**Interfaces:**

```ts
export async function listRecordSourcesForExercises(
  exerciseIds: readonly string[],
): Promise<RecordSource[]>;

export async function getCompletedSetRecordSources(
  workoutSetId: string,
): Promise<RecordSource[]>;
```

The first function returns set sources plus one session-tonnage source for each workout/exercise. The second returns the newly completed set source and the current session-tonnage source needed by incremental persistence.

- [ ] **Step 1: Expose the canonical effective-load helper under test**

Rename/export the current private helper without changing behavior:

```ts
export function effectiveLoadKg(entry: VolumeEntry, bodyWeightKg?: number): number;
```

Add a regression proving records can reuse this value for `max_volume_set`; do not copy its formula into `records.ts` or a repository.

- [ ] **Step 2: Write failing source-assembly repository tests**

Using `fake-indexeddb` and `resetDb`, seed active, completed, discarded, deleted, and warm-up rows. Assert:

- active and completed workouts are included; discarded/deleted rows are excluded;
- only completed, non-deleted sets become set sources;
- `WorkoutExercise` snapshots determine measurement type, order, weight role, and bodyweight factor even if the exercise library later changes;
- historical exercise name is available to read-model joins but is not required by the pure source;
- a dated body weight is resolved at the workout timestamp;
- session tonnage exactly equals `sessionTotals` across every working set for that workout/exercise;
- each session source uses the last qualifying set timestamp and deterministic order;
- the incremental function returns the same source shapes as the full assembler.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:run -- src/data/repositories/recordSources.test.ts src/lib/volume.test.ts
```

Expected: FAIL because the repository and exported helper do not exist.

- [ ] **Step 4: Implement the source assembler**

Query tables in bounded bulk, group rows in memory, and resolve dated body weight without importing the public `bodyMeasurements` repository. This avoids the cycle `bodyMeasurements -> reconciliation -> recordSources -> bodyMeasurements`.

Use historical snapshot fields through the existing exercise-identity helpers. Build session entries once and call:

```ts
sessionTotals(volumeEntries, resolvedBodyWeightKg).tonnage
```

Do not import `settings` or write any table from this internal module.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/data/repositories/recordSources.test.ts src/lib/volume.test.ts src/lib/records.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/data/repositories/recordSources.ts src/data/repositories/recordSources.test.ts src/lib/volume.ts src/lib/volume.test.ts
git commit -m "feat: assemble record projection sources"
```

---

### Task 4: Stable persisted reconciliation and projection version

**Files:**
- Create: `src/data/repositories/recordReconciliation.ts`
- Create: `src/data/repositories/personalRecords.ts`
- Create: `src/data/repositories/personalRecords.test.ts`
- Modify: `src/data/repositories/settings.ts`
- Modify: `src/data/repositories/settings.test.ts`
- Modify: `src/test/resetDb.ts`

**Internal interfaces:**

```ts
export async function persistRecordsForCompletedSet(
  workoutSetId: string,
  formula: OneRepMaxFormula,
): Promise<PersonalRecord[]>;

export async function reconcileRecordsForExercises(
  exerciseIds: readonly string[],
  formula: OneRepMaxFormula,
  types?: ReadonlySet<PersonalRecordType>,
): Promise<RecordRebuildResult>;

export async function reconcileAllRecords(
  formula: OneRepMaxFormula,
  types?: ReadonlySet<PersonalRecordType>,
): Promise<RecordRebuildResult>;
```

**Public repository interfaces:**

```ts
export const PERSONAL_RECORDS_PROJECTION_VERSION = 1;

export interface RecordTimelineFilters {
  exerciseId?: string;
  type?: PersonalRecordType;
}

export interface RecordTimelineEntry {
  record: PersonalRecord;
  exerciseName: string;
  workoutStatus: 'active' | 'completed';
  previousValue?: number;
  triggerWorkoutSetId?: string;
}

export interface RecordRebuildResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

export function listRecordTimeline(filters?: RecordTimelineFilters): Promise<RecordTimelineEntry[]>;
export function listCurrentRecordsForExercise(exerciseId: string): Promise<RecordTimelineEntry[]>;
export function listRecordsForWorkout(workoutId: string): Promise<RecordTimelineEntry[]>;
export function rebuildRecordsForExercises(exerciseIds: readonly string[]): Promise<RecordRebuildResult>;
export function rebuildAllRecords(): Promise<RecordRebuildResult>;
export function ensureRecordProjection(): Promise<'ready' | 'rebuilt'>;
export function isRecordProjectionCurrent(): Promise<boolean>;
```

Settings adds:

```ts
export function getOneRepMaxFormula(): Promise<OneRepMaxFormula>;
export function setOneRepMaxFormula(formula: OneRepMaxFormula): Promise<void>;
```

- [ ] **Step 1: Write failing reconciliation tests**

Cover a full rebuild from source history and assert exact events. Then modify a historical set and rebuild again:

```ts
const first = await rebuildAllRecords();
const original = await db.personalRecords.toArray();

await db.workoutSets.update('set-2', { weight: 77.5 });
const second = await rebuildAllRecords();
const reconciled = await db.personalRecords.toArray();

expect(first.created).toBeGreaterThan(0);
expect(second.deleted).toBeGreaterThan(0);
expect(activeBusinessKeys(reconciled)).toEqual(expectedBusinessKeysFromHistory());
expect(idForSurvivingKey(reconciled)).toBe(idForSurvivingKey(original));
expect(reconciled.some(({ deletedAt }) => deletedAt > 0)).toBe(true);
```

Also assert:

- two identical rebuilds create no new IDs and report only unchanged rows;
- a changed value/formula updates the surviving stable row with `touch`;
- removed drafts are soft-deleted, never physically deleted;
- a later reappearance can revive the matching row and preserve its UUID;
- targeted rebuilding changes no other exercise;
- `types = new Set(['best_1rm'])` changes no other category;
- `previousValue` is absent on the first mark and points to the preceding event afterward;
- `triggerWorkoutSetId` equals the source set for set records and the last contributing set for session-tonnage records, without changing the persisted business key;
- timeline order is newest first, current records return exactly one row per category, and workout reads include all categories;
- historical names come from workout snapshots, with current exercise name as fallback;
- active/completed statuses are returned and discarded sources are not.

- [ ] **Step 2: Write failing settings and bootstrap tests**

Assert missing/invalid `oneRepMaxFormula` normalizes to Epley. Test that a formula change rebuilds only `best_1rm` atomically: inject a reconciliation failure and verify both the old setting and old records remain.

For the projection version:

```ts
expect(await ensureRecordProjection()).toBe('rebuilt');
expect(await ensureRecordProjection()).toBe('ready');
expect(await isRecordProjectionCurrent()).toBe(true);
```

If rebuilding throws, the version setting must remain stale so the next launch retries.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:run -- src/data/repositories/personalRecords.test.ts src/data/repositories/settings.test.ts
```

Expected: FAIL because the projection repository and formula setting do not exist.

- [ ] **Step 4: Implement stable reconciliation**

`recordReconciliation.ts` may import `recordSources`, `records`, `db`, and timestamp helpers. It must not import the public `settings` or `personalRecords` modules.

Compute expected drafts first, map active and soft-deleted persisted rows by the stable business key, then reconcile inside the caller's current Dexie transaction. Only call `crypto.randomUUID()` for genuinely new keys. A revived row clears `deletedAt` and uses `touch`.

For incremental completion, project the new set/session candidates against current incumbents. If the current active workout already owns the session-level business key, update that row as the session tonnage grows; set-level improvements remain separate rows.

- [ ] **Step 5: Implement public reads, settings, and versioned backfill**

Public rebuild wrappers read the normalized formula and open one transaction over:

```ts
db.settings,
db.workouts,
db.workoutExercises,
db.workoutSets,
db.bodyMeasurements,
db.personalRecords
```

`setOneRepMaxFormula` validates its argument, opens the same transaction, rebuilds only `best_1rm`, and writes the new setting last. `ensureRecordProjection` writes `personalRecordsProjectionVersion` only after a successful full reconciliation. A successful explicit `rebuildAllRecords` also writes the current version so the Records repair action clears a stale state.

- [ ] **Step 6: Verify GREEN, atomicity, and commit**

```powershell
npm.cmd run test:run -- src/data/repositories/personalRecords.test.ts src/data/repositories/settings.test.ts src/data/repositories/recordSources.test.ts src/lib/records.test.ts
npm.cmd run typecheck
```

Expected: PASS, including injected-failure rollback tests.

```powershell
git add -- src/data/repositories/recordReconciliation.ts src/data/repositories/personalRecords.ts src/data/repositories/personalRecords.test.ts src/data/repositories/settings.ts src/data/repositories/settings.test.ts src/test/resetDb.ts
git commit -m "feat: persist and reconcile personal records"
```

---

### Task 5: Atomic live-workout records and persisted notifications

**Files:**
- Modify: `src/data/repositories/workoutSets.ts`
- Modify: `src/data/repositories/workoutHistory.ts`
- Create: `src/data/repositories/workoutRecords.test.ts`
- Modify: `src/data/repositories/workouts.test.ts`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.test.tsx`
- Modify: `src/features/workout/RecordNote.tsx`
- Modify: `src/i18n/fr.ts`
- Modify: `src/i18n/labels.ts`
- Modify: `src/i18n/labels.test.ts`

**UI contract:**

```ts
export interface WorkoutRecordNotice {
  types: PersonalRecordType[];
  entries: RecordTimelineEntry[];
}

// keyed by source set ID; initial marks are excluded
type WorkoutRecordNotices = Map<string, WorkoutRecordNotice>;
```

- [ ] **Step 1: Write failing atomic-write tests**

Extend repository tests to prove:

- completing a first working set writes its initial record events in the same transaction;
- completing a strict improvement writes every category it beats;
- completing a tie writes no new event;
- warm-up completion writes none;
- 13 reps do not produce `best_1rm`;
- failure while persisting records rolls back `isCompleted` and `performedAt`;
- editing the values/type of a completed set, uncompleting, deleting, or restoring it reconciles that exercise before commit;
- an unrelated exercise's record IDs are unchanged;
- an active workout's session-tonnage row is updated rather than duplicated as more sets complete.

- [ ] **Step 2: Verify repository RED**

```powershell
npm.cmd run test:run -- src/data/repositories/workoutRecords.test.ts
```

Expected: FAIL because set mutations do not include `personalRecords` or reconciliation.

- [ ] **Step 3: Integrate record writes into set transactions**

Expand the transaction table list to the projection stores. Keep the fast path only for a newly completed set:

```ts
await persistRecordsForCompletedSet(setId, formula);
```

Use targeted `reconcileRecordsForExercises([set.exerciseId], formula)` for every mutation that can invalidate an earlier event. Do this only when a changed/deleted/restored set is or was completed; editing an uncompleted draft must remain cheap.

Remove `listRecordSets` from `workoutHistory.ts` after its final consumer is migrated, plus its obsolete block/import in `workouts.test.ts`.

- [ ] **Step 4: Write failing view-model and copy tests**

`labels.ts` changes `recordLabel` to accept `PersonalRecordType` and adds reusable, French-reading helpers:

```ts
recordValue(record: PersonalRecord): string;
recordContext(record: PersonalRecord): string;
recordGain(record: PersonalRecord, previousValue?: number): string | undefined;
oneRepMaxFormulaLabel(formula: OneRepMaxFormula): string;
```

Assert kg/reps/seconds/metres formatting, assistance wording, session tonnage, 1RM formula context, and gains. Every string/key comes from `fr.ts`. Exercise the final one-record/multiple-record note through the existing `WorkoutExerciseCard.test.tsx`; do not add a unit test for the pure display component.

- [ ] **Step 5: Replace derived live notifications with persisted reads**

In `WorkoutScreen`, replace the all-history `listRecordSets` query and `workoutRecordKinds` calculation with:

```ts
useLiveQuery(() => listRecordsForWorkout(active.id), [active.id])
```

Group entries by `entry.triggerWorkoutSetId ?? record.workoutSetId`, discard entries with `previousValue === undefined`, and pass all improved categories to the matching card. This lets the session-tonnage event attach to the last contributing set while its persisted business key remains workout-scoped. `RecordNote` renders one compact line for one category and a short summary for multiple categories; it never chooses which categories survive persistence.

Keep the notification visually restrained and inside the existing card language. Do not animate on page mount.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/data/repositories/workoutRecords.test.ts src/data/repositories/workouts.test.ts src/features/workout/WorkoutExerciseCard.test.tsx src/i18n/labels.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/data/repositories/workoutSets.ts src/data/repositories/workoutHistory.ts src/data/repositories/workoutRecords.test.ts src/data/repositories/workouts.test.ts src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutExerciseCard.test.tsx src/features/workout/RecordNote.tsx src/i18n/fr.ts src/i18n/labels.ts src/i18n/labels.test.ts
git commit -m "feat: persist live workout records"
```

---

### Task 6: Reconcile lifecycle and historical-edit mutations

**Files:**
- Modify: `src/data/repositories/workoutLifecycle.ts`
- Modify: `src/data/repositories/workoutExercises.ts`
- Create: `src/data/repositories/recordMutationConsistency.test.ts`
- Modify: `src/data/repositories/history.ts`
- Modify: `src/data/repositories/history.test.ts`
- Modify: `src/data/repositories/historyRepair.ts`
- Modify: `src/data/repositories/historyRepair.test.ts`

- [ ] **Step 1: Add failing mutation-matrix tests**

For each operation below, first create a chronology in which the affected row owns a record, perform the mutation through its public repository, then assert the persisted active chronology equals `projectRecordTimeline(listRecordSourcesForExercises(...))`:

- discard active workout;
- delete a workout through the live-workout lifecycle;
- remove a workout exercise with completed sets;
- edit an archived workout's set values, exercise choice, order, or status through `saveArchivedWorkout`;
- delete an archived workout;
- resnapshot workout exercises in `repairHistoryExerciseSnapshots`.

Inject one reconciliation failure per repository family and assert the source mutation rolls back.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:run -- src/data/repositories/recordMutationConsistency.test.ts src/data/repositories/history.test.ts src/data/repositories/historyRepair.test.ts
```

Expected: FAIL because these transactions leave the projection stale.

- [ ] **Step 3: Capture affected exercise IDs before mutation**

For destructive paths, collect the union of exercise IDs from source rows before deletion and from replacement rows after editing. Do not attempt to rediscover deleted IDs after the source cascade.

Expand each existing transaction with `settings`, `bodyMeasurements`, and `personalRecords`, then call targeted reconciliation before commit. `finishWorkout` needs no full rebuild: it changes only the source destination from active to completed, while the already persisted events remain valid.

- [ ] **Step 4: Update obsolete zero-record assertions**

Existing history tests that assert `personalRecords.count() === 0` must instead assert the exact reconciled timeline after save/delete. Do not merely remove these assertions.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/data/repositories/recordMutationConsistency.test.ts src/data/repositories/history.test.ts src/data/repositories/historyRepair.test.ts src/data/repositories/personalRecords.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/data/repositories/workoutLifecycle.ts src/data/repositories/workoutExercises.ts src/data/repositories/recordMutationConsistency.test.ts src/data/repositories/history.ts src/data/repositories/history.test.ts src/data/repositories/historyRepair.ts src/data/repositories/historyRepair.test.ts
git commit -m "feat: reconcile records after history changes"
```

---

### Task 7: Reconcile imports and dated body-weight corrections

**Files:**
- Modify: `src/data/repositories/hevyImport.ts`
- Modify: `src/data/repositories/hevyImport.test.ts`
- Modify: `src/data/repositories/bodyMeasurements.ts`
- Modify: `src/data/repositories/bodyMeasurements.test.ts`

- [ ] **Step 1: Write failing import tests**

Assert one import containing several workouts builds the final chronology once, with deterministic ties when timestamps match. Re-import the same archive and assert no duplicate IDs. Inject reconciliation failure and assert the entire import rolls back.

Replace the current assertion that import leaves `personalRecords` empty with exact projected records.

- [ ] **Step 2: Write failing body-weight interval tests**

Create measurements `M1 < M2 < M3` and bodyweight-dependent workouts around them. Editing `M2` must rebuild only `max_volume_session` records for `reps_only` and `assisted_weight_reps` exercises in `[M2, M3)`. Also cover:

- inserting a new measurement splits the former interval;
- same-day upsert keeps one measurement;
- workouts before the first measure use the earliest measurement and are affected when it changes;
- classic `weight_reps` and record categories unrelated to tonnage keep their IDs;
- reconciliation failure rolls back the body-weight write.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:run -- src/data/repositories/hevyImport.test.ts src/data/repositories/bodyMeasurements.test.ts
```

Expected: FAIL because import and body-weight writes do not update the projection.

- [ ] **Step 4: Integrate import reconciliation**

Add projection stores to the single import transaction. Collect unique imported exercise IDs and call targeted reconciliation once after all source rows are written. Do not rebuild after each CSV row.

- [ ] **Step 5: Integrate interval-scoped body-weight reconciliation**

Determine the old and new affected time intervals before the upsert, query source workout rows in their union, then collect only bodyweight-dependent snapshot types. Rebuild with:

```ts
new Set<PersonalRecordType>(['max_volume_session'])
```

Keep `recordSources` independent of this public repository to avoid a module cycle.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/data/repositories/hevyImport.test.ts src/data/repositories/bodyMeasurements.test.ts src/data/repositories/personalRecords.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/data/repositories/hevyImport.ts src/data/repositories/hevyImport.test.ts src/data/repositories/bodyMeasurements.ts src/data/repositories/bodyMeasurements.test.ts
git commit -m "feat: keep imported records and tonnage records current"
```

---

### Task 8: Formula settings, repair action, and startup backfill

**Files:**
- Create: `src/features/settings/OneRepMaxSettings.tsx`
- Create: `src/features/settings/OneRepMaxSettings.test.tsx`
- Create: `src/features/settings/RecordRepairAction.tsx`
- Create: `src/features/settings/RecordRepairAction.test.tsx`
- Create: `src/data/initialize.ts`
- Create: `src/data/initialize.test.ts`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/features/settings/SettingsScreen.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src/i18n/fr.ts`

**Startup interface:**

```ts
export interface InitializationResult {
  recordProjection: 'ready' | 'rebuilt' | 'stale';
}

export function initializePersistentData(): Promise<InitializationResult>;
```

- [ ] **Step 1: Write failing startup tests**

Mock only failure boundaries, not the record calculation. Assert:

- seeding runs before record backfill;
- an old/missing projection version triggers one rebuild;
- a current version skips the rebuild;
- seed failure still rejects so the existing boot error remains visible;
- record-rebuild failure returns `{ recordProjection: 'stale' }` and allows the app to mount;
- the stale version remains in IndexedDB for retry on next launch.

- [ ] **Step 2: Write failing settings component tests**

For `OneRepMaxSettings`, open the selector, choose Brzycki, confirm the example changes, and assert the repository setter is called. On repository failure, keep Epley selected and show the localized error.

For `RecordRepairAction`, click the explicit repair button, assert the confirmation/loading state, then display localized created/updated/deleted counts. On failure, keep the action retryable.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:run -- src/data/initialize.test.ts src/features/settings/OneRepMaxSettings.test.tsx src/features/settings/RecordRepairAction.test.tsx src/features/settings/SettingsScreen.test.tsx
```

Expected: FAIL because the initializer and extracted settings blocks do not exist.

- [ ] **Step 4: Implement startup sequencing**

`initializePersistentData` calls `seedDatabase`, then `ensureRecordProjection`. Catch only the projection error and return `stale`; let seed errors retain the existing fatal boot path. Change `main.tsx` to mount from this function without importing `db` into React.

- [ ] **Step 5: Build the two focused settings blocks**

Add an “Estimation du 1RM” row under training settings. The `OptionSheet` contains Epley, Brzycki, and Lombardi with plain-language descriptions plus `100 kg × 5` examples computed through `estimateOneRepMax`, not hard-coded results.

Keep record repair distinct from the existing historical-snapshot repair. Its button is secondary/destructive-neutral: rebuilding records is recoverable and must not look like data deletion.

Mount both extracted components from `SettingsScreen`; do not move unrelated settings code.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/data/initialize.test.ts src/features/settings/OneRepMaxSettings.test.tsx src/features/settings/RecordRepairAction.test.tsx src/features/settings/SettingsScreen.test.tsx src/data/repositories/settings.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/features/settings/OneRepMaxSettings.tsx src/features/settings/OneRepMaxSettings.test.tsx src/features/settings/RecordRepairAction.tsx src/features/settings/RecordRepairAction.test.tsx src/data/initialize.ts src/data/initialize.test.ts src/features/settings/SettingsScreen.tsx src/features/settings/SettingsScreen.test.tsx src/main.tsx src/i18n/fr.ts
git commit -m "feat: configure and repair record projections"
```

---

### Task 9: Dedicated progression-rail records page

**Files:**
- Create: `src/features/records/RecordsScreen.tsx`
- Create: `src/features/records/RecordsScreen.test.tsx`
- Create: `src/features/records/RecordRail.tsx`
- Modify: `src/features/analytics/routes.tsx`
- Modify: `src/features/analytics/AnalyticsScreen.tsx`
- Create: `src/features/analytics/AnalyticsScreen.test.tsx`
- Modify: `src/router.tsx`
- Modify: `src/index.css`
- Modify: `src/i18n/fr.ts`

**Route:** `#/analytics/records`, lazy-loaded through `RecordsRoute`.

- [ ] **Step 1: Write failing screen integration tests**

Seed persisted records and render the route. Assert:

- newest event is the hero/current mark and older events follow chronologically;
- initial marks are visible on this page;
- exercise and category filters change the repository view, and `?exerciseId=...` preselects an exercise for deep links;
- “Tous” clears each filter;
- an active record navigates to `/workout`; a completed one navigates to `/history/:id`;
- empty history displays the dedicated empty state;
- stale projection displays repair/retry, and successful retry replaces it with the rail;
- the Analytics overview lists “Records” first without changing the three Home shortcuts.

- [ ] **Step 2: Verify RED**

```powershell
npm.cmd run test:run -- src/features/records/RecordsScreen.test.tsx src/features/analytics/AnalyticsScreen.test.tsx
```

Expected: FAIL because the route, screen, and overview entry do not exist.

- [ ] **Step 3: Implement the rail information architecture**

`RecordsScreen` owns data/filter state; `RecordRail` is display-only. Use this hierarchy:

1. compact back header and “Records” title;
2. two horizontal filter chips (“Tous les exercices”, “Tous les records”);
3. current-record hero with large tabular value, source context, date, and gain;
4. a vertical rail of prior events whose notches resemble a machine weight stack;
5. empty/error/repair states in the same content region.

Older events use muted text and short ticks. Only the newest/current node uses the accent fill. Values use a named CSS utility with a system monospace stack and `font-variant-numeric: tabular-nums`; do not fetch a web font.

- [ ] **Step 4: Add insertion motion without mount theatrics**

Inside `RecordRail`, track already-seen record IDs in an effect. Skip the first loaded result. For later Dexie insertions only, call `Element.animate` on new nodes with a short opacity/translate/scale sequence. Bypass it when:

```ts
window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

No animation may be required for reading or navigation.

- [ ] **Step 5: Wire filters, route, and Analytics entry**

Use existing `OptionSheet` primitives and repository filter arguments. Keep one unfiltered `listRecordTimeline()` live query for exercise options and one filtered query for displayed events, so selecting an exercise never makes the other options disappear. Synchronize the exercise filter to the `exerciseId` search parameter so Exercise Detail can deep-link into the filtered rail. Add the lazy route in `analytics/routes.tsx`, the child path in `router.tsx`, and the first overview row in `AnalyticsScreen`.

- [ ] **Step 6: Verify responsive behavior and GREEN**

Run:

```powershell
npm.cmd run test:run -- src/features/records/RecordsScreen.test.tsx src/features/analytics/AnalyticsScreen.test.tsx
npm.cmd run typecheck
npm.cmd run dev
```

In the local browser at widths `320`, `390`, and `430` px, verify:

- no horizontal overflow with long French exercise names;
- every chip/row target is at least 48 px;
- large values do not wrap;
- the page remains usable with 200% text zoom;
- current and old nodes remain distinguishable without relying only on color;
- reduced-motion emulation disables insertion animation.

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/records/RecordsScreen.tsx src/features/records/RecordsScreen.test.tsx src/features/records/RecordRail.tsx src/features/analytics/routes.tsx src/features/analytics/AnalyticsScreen.tsx src/features/analytics/AnalyticsScreen.test.tsx src/router.tsx src/index.css src/i18n/fr.ts
git commit -m "feat: add personal records progression rail"
```

---

### Task 10: Persisted exercise records and 1RM analytics

**Files:**
- Modify: `src/features/exercises/ExerciseDetailScreen.tsx`
- Create: `src/features/exercises/ExerciseDetailScreen.test.tsx`
- Modify: `src/lib/analytics/metrics.ts`
- Modify: `src/lib/analytics/metrics.test.ts`
- Modify: `src/features/analytics/ExerciseAnalyticsScreen.tsx`
- Create: `src/features/analytics/ExerciseAnalyticsScreen.test.tsx`
- Modify: `src/lib/records.ts`
- Modify: `src/lib/records.test.ts`
- Modify: `src/i18n/fr.ts`
- Modify: `src/i18n/labels.ts`
- Modify: `src/i18n/labels.test.ts`

**Analytics interface:**

```ts
export type MetricKey =
  | 'topWeight'
  | 'estimatedOneRepMax'
  | 'bestSetVolume'
  | 'sessionTonnage'
  | 'totalReps'
  | 'workingSets'
  | 'duration'
  | 'distance';

export function metricSeries(
  key: MetricKey,
  sessions: readonly ExerciseSession[],
  formula: OneRepMaxFormula = 'epley',
): MetricPoint[];
```

- [ ] **Step 1: Write failing analytics tests**

Assert `availableMetrics('weight_reps')` exposes estimated 1RM immediately after top weight and no other measurement type exposes it. Cover:

- best eligible 1RM per session;
- current formula selection;
- reps above 12 and invalid loads ignored;
- raw values retained in points while localized display rounds to one decimal;
- sessions with no eligible set omitted, not plotted as zero.

- [ ] **Step 2: Write failing exercise-detail tests**

Seed a persisted projection whose value intentionally differs from the raw source rows. The detail page must display the persisted value, proving it no longer calls `bestSets(allSets)`. Assert record labels/values and the link `/analytics/records?exerciseId=<id>` to the dedicated filtered rail.

- [ ] **Step 3: Verify RED**

```powershell
npm.cmd run test:run -- src/lib/analytics/metrics.test.ts src/features/exercises/ExerciseDetailScreen.test.tsx src/features/analytics/ExerciseAnalyticsScreen.test.tsx
```

Expected: FAIL because the metric and persisted record consumer do not exist.

- [ ] **Step 4: Add the 1RM metric through the existing analytics engine**

The metric computes the maximum `estimateOneRepMax` across eligible working sets in each session. `ExerciseAnalyticsScreen` reads `getOneRepMaxFormula()` with `useLiveQuery` and passes it to `metricSeries`; changing the setting redraws the graph without persisting analytics points.

Use the existing chart, units, selectors, and empty-state language. Do not create a special chart solely for 1RM.

- [ ] **Step 5: Switch exercise detail to persisted reads**

Use:

```ts
useLiveQuery(() => listCurrentRecordsForExercise(exerciseId), [exerciseId])
```

Remove the all-set record derivation and its old `bestSets` import. Keep session history queries only where the rest of the detail page still needs them. Render category-specific context through the shared label helpers.

After both Workout and Exercise Detail have migrated, remove the compatibility-only `RecordKind`, `recordsBeatenBy`, `workoutRecordKinds`, and `bestSets` exports plus their obsolete tests. Keep `setVolume`/`isWorkingSet` only where the canonical projection or volume engine still uses them.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm.cmd run test:run -- src/lib/analytics/metrics.test.ts src/features/exercises/ExerciseDetailScreen.test.tsx src/features/analytics/ExerciseAnalyticsScreen.test.tsx src/lib/records.test.ts src/i18n/labels.test.ts
npm.cmd run typecheck
```

Expected: PASS.

```powershell
git add -- src/features/exercises/ExerciseDetailScreen.tsx src/features/exercises/ExerciseDetailScreen.test.tsx src/lib/analytics/metrics.ts src/lib/analytics/metrics.test.ts src/features/analytics/ExerciseAnalyticsScreen.tsx src/features/analytics/ExerciseAnalyticsScreen.test.tsx src/lib/records.ts src/lib/records.test.ts src/i18n/fr.ts src/i18n/labels.ts src/i18n/labels.test.ts
git commit -m "feat: show persisted records and one rep max analytics"
```

---

### Task 11: Projection benchmark, release gates, and phone checkpoint

**Files:**
- Create: `src/data/repositories/personalRecords.bench.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `PROGRESS.md`

- [ ] **Step 1: Add a representative benchmark**

Reuse the existing `seedLargeHistory` snapshot-rich profile unchanged. Add:

```json
"bench:records": "vitest bench src/data/repositories/personalRecords.bench.ts --run"
```

The benchmark seeds the existing profile of 2,000 workouts × 8 exercises × 4 sets (64,000 sets), then measures separately:

- initial full reconstruction;
- idempotent full reconstruction;
- one-exercise targeted reconstruction;
- newest-first timeline read.

Assert row counts and idempotence outside the timed body. Do not add a schema migration based only on `fake-indexeddb` timing.

- [ ] **Step 2: Run and record the benchmark**

```powershell
npm.cmd run bench:records
```

Expected: all four benchmark cases complete and print stable timings. Record the measured medians and environment in `PROGRESS.md`. If full rebuild is slow, retain it as explicit repair/startup backfill; daily writes must still use incremental/targeted paths. Revisit indexing only if a real phone exceeds 100 ms for normal timeline reads, matching the existing performance-debt policy.

- [ ] **Step 3: Run the complete automated gate**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: all commands PASS with no ignored failures.

- [ ] **Step 4: Perform the final local-first scenario**

With browser network emulation set to offline:

1. complete a first set and verify no congratulation but an initial event on Records;
2. complete a strict improvement and verify the in-workout notice plus live rail insertion;
3. complete a tie and verify no duplicate;
4. edit the old best downward in History and verify the next valid event becomes current;
5. switch Epley to Brzycki and verify only 1RM values/timeline change;
6. reload/kill and reopen; verify all records survive;
7. run manual repair and verify the chronology is unchanged.

- [ ] **Step 5: Prepare version 0.2.0 and Android web assets**

```powershell
npm.cmd version 0.2.0 --no-git-tag-version
npm.cmd run android:sync
```

Expected: package manifests say `0.2.0`; the Android asset sync completes. The existing GitHub workflow remains the authoritative native APK build because it supplies the monotonically increasing `versionCode`.

- [ ] **Step 6: Update project progress**

In `PROGRESS.md`, record:

- persisted projection/version/backfill behavior;
- supported record categories and formula setting;
- exact test count and all gate results;
- benchmark medians;
- any intentionally retained debt;
- the phone checkpoint below.

- [ ] **Step 7: Re-run release gates after version/progress edits**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
npm.cmd run android:sync
git diff --check
```

Expected: PASS.

- [ ] **Step 8: Commit the release preparation**

```powershell
git add -- src/data/repositories/personalRecords.bench.ts package.json package-lock.json PROGRESS.md
git commit -m "chore: prepare Android release v0.2.0"
```

- [ ] **Step 9: Announce the manual phone checkpoint**

After the existing release workflow produces `FitTrack-v0.2.0.apk`, install it over the current app without clearing data. On the phone, verify:

- the first launch backfills old history without blocking normal app use;
- the Records rail opens from Analytics and remains smooth with the full history;
- a live improvement appears immediately and survives force-stop/offline reopen;
- long exercise names, large values, filters, and 200% text size remain readable;
- Epley/Brzycki/Lombardi changes update 1RM records and the chart;
- historical edit/delete/import/body-weight correction moves or removes affected record events;
- manual repair is idempotent and does not lose workouts.
