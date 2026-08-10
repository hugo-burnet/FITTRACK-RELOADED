# Bodyweight Tonnage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count estimated bodyweight, weighted-bodyweight, and assisted-bodyweight work in every FitTrack tonnage reading, with a dated body-weight input on the home screen.

**Architecture:** Keep `sessionTotals` as the only tonnage formula. Attach an optional effective-bodyweight factor to exercises and their immutable workout snapshots, resolve the body weight applicable to each workout from the existing `bodyMeasurements` table, and carry both values through the historical projection used by analytics and exports. UI components only call repositories.

**Tech Stack:** React 19, TypeScript strict, Dexie, dexie-react-hooks, Tailwind CSS v4, Zustand-free persistent data, Vitest, Testing Library, Capacitor Android.

## Global Constraints

- Implement `docs/superpowers/specs/2026-08-10-bodyweight-tonnage-design.md` exactly.
- `bodyweightLoadFactor` is optional and, when present, finite and in `(0, 1]`.
- Push-ups use `0.70`; bodyweight squats use `0.90`; full suspended movements use `1.00`.
- Formula: `(bodyWeightKg × factor + addedLoad − assistance) × reps`, with assistance clamped at zero and roles applied separately.
- Added external load still counts when no body weight is known; assistance without a resolvable body load counts zero.
- Body weight is local-first, stored as a dated `BodyMeasurement`, and same-day saves update rather than duplicate.
- Historical workouts use the latest measure at or before the workout; workouts before the first measure use the earliest known value.
- No component imports `db`; all strings live in `src/i18n/fr.ts`; touch targets are at least 48 px.
- No new Dexie index or database version is needed.
- TDD is mandatory: witness RED before production changes, then GREEN, then the focused regression set.
- REQUIRED SUB-SKILL for Tasks 5 and 6: apply `frontend-design` before HTML/CSS changes.
- Preserve Claude's independent `perf/home-dashboard-reads` worktree and do not edit `useHomeDashboard.ts`.
- Before publishing, merge `perf/home-dashboard-reads` into the release result and re-run every gate on the combined tree; no APK is tagged from either branch alone.

---

### Task 1: Effective load in the single tonnage engine

**Files:**
- Modify: `src/lib/volume.test.ts`
- Modify: `src/lib/volume.ts`

**Interfaces:**
- Consumes: existing `WeightRole`, `isWorkingSet`, `VolumeEntry`.
- Produces: `VolumeEntry.bodyweightLoadFactor?: number` and `sessionTotals(entries, bodyWeightKg?)`.

- [ ] **Step 1: Write the failing formula tests**

Add focused cases to `volume.test.ts`:

```ts
it.each([
  ['traction', 'added', undefined, 1, 80, 8, 640],
  ['traction lestée', 'added', 10, 1, 80, 8, 720],
  ['traction assistée', 'assist', 20, 1, 80, 8, 480],
  ['pompes', 'added', undefined, 0.7, 80, 8, 448],
  ['squats', 'added', undefined, 0.9, 80, 10, 720],
] as const)('%s produit son tonnage effectif', (_name, weightRole, weight, factor, bodyWeight, reps, expected) => {
  expect(sessionTotals([
    { set: aSet({ weight, reps }), weightRole, bodyweightLoadFactor: factor },
  ], bodyWeight).tonnage).toBe(expected);
});

it('borne une assistance supérieure au poids effectif à zéro', () => {
  expect(sessionTotals([
    { set: aSet({ weight: 90, reps: 8 }), weightRole: 'assist', bodyweightLoadFactor: 1 },
  ], 80).tonnage).toBe(0);
});

it('compte seulement le lest quand le poids corporel manque', () => {
  expect(sessionTotals([
    { set: aSet({ weight: 10, reps: 8 }), weightRole: 'added', bodyweightLoadFactor: 1 },
  ]).tonnage).toBe(80);
});
```

Keep explicit regressions for classic loads, warm-ups, missing factor, missing body weight, time, distance, and decimal rounding.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/lib/volume.test.ts
```

Expected: FAIL because `VolumeEntry` has no coefficient and `sessionTotals` ignores its second argument/bodyweight roles.

- [ ] **Step 3: Implement the minimal formula**

In `volume.ts`, extend the entry and centralize the effective load:

```ts
export interface VolumeEntry {
  set: VolumeSet;
  weightRole?: WeightRole;
  bodyweightLoadFactor?: number;
}

function effectiveLoadKg(entry: VolumeEntry, bodyWeightKg?: number): number {
  const { set, weightRole, bodyweightLoadFactor } = entry;
  if (weightRole === 'load') return set.weight ?? 0;

  const bodyLoad =
    bodyWeightKg !== undefined && bodyweightLoadFactor !== undefined
      ? bodyWeightKg * bodyweightLoadFactor
      : 0;

  if (weightRole === 'added') return bodyLoad + (set.weight ?? 0);
  if (weightRole === 'assist') {
    return bodyLoad === 0 ? 0 : Math.max(bodyLoad - (set.weight ?? 0), 0);
  }
  return 0;
}
```

Use `effectiveLoadKg(entry, bodyWeightKg) * (set.reps ?? 0)` only for working sets.

- [ ] **Step 4: Verify GREEN and regressions**

Run:

```powershell
npm.cmd run test:run -- src/lib/volume.test.ts src/lib/records.test.ts
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/lib/volume.ts src/lib/volume.test.ts
git commit -m "feat: calculate effective bodyweight tonnage"
```

---

### Task 2: Catalogue coefficients and immutable exercise snapshots

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/lib/exerciseSnapshot.ts`
- Modify: `src/lib/exerciseSnapshot.test.ts`
- Modify: `src/data/seed/exercises.json`
- Modify: `src/data/seed/seedDatabase.ts`
- Modify: `src/data/seed/seedDatabase.test.ts`
- Modify: `src/data/repositories/exerciseSnapshot.test.ts`

**Interfaces:**
- Produces: `Exercise.bodyweightLoadFactor?`, `WorkoutExercise.exerciseBodyweightLoadFactor?`, `ExerciseIdentity.bodyweightLoadFactor?`.
- The seed owns only factors on shipped rows; custom rows remain untouched.

- [ ] **Step 1: Write failing snapshot and seed tests**

Cover:

```ts
expect(snapshotOf({ ...pullUp, bodyweightLoadFactor: 1 }))
  .toMatchObject({ exerciseBodyweightLoadFactor: 1 });

expect(resolveExerciseIdentity(
  { ...row, exerciseBodyweightLoadFactor: 0.7 },
  { ...pushUp, bodyweightLoadFactor: 1 },
).bodyweightLoadFactor).toBe(0.7);
```

In `seedDatabase.test.ts`, assert `push-up === 0.7`, `bodyweight-squat === 0.9`, `pull-up === 1`, an excluded `crunch` has no factor, a stale shipped factor is repaired, and a custom factor is preserved.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/lib/exerciseSnapshot.test.ts src/data/seed/seedDatabase.test.ts src/data/repositories/exerciseSnapshot.test.ts
```

Expected: type/runtime failures because the fields and catalogue values do not exist.

- [ ] **Step 3: Add optional model and snapshot fields**

Add to `Exercise`:

```ts
bodyweightLoadFactor?: number;
```

Add to `WorkoutExercise`:

```ts
exerciseBodyweightLoadFactor?: number;
```

Include the snapshot field in `ExerciseSnapshot`, `snapshotOf`, `exerciseSnapshotOfRow`, `ExerciseIdentity`, and both identity resolvers.

- [ ] **Step 4: Add the approved catalogue factors**

Update only these seed groups:

```text
1.00: pull-up, chin-up, chest-dip, triceps-dip, handstand-push-up,
      assisted-pull-up, assisted-dip
0.70: push-up, diamond-push-up, inverted-row, bench-dip
0.90: bodyweight-squat, pistol-squat, sissy-squat,
      bodyweight-calf-raise, burpee
```

Leave segmental/isometric movements without the field. Extend catalogue validation to accept only finite factors in `(0, 1]`.

- [ ] **Step 5: Reconcile shipped coefficients**

Extend the seed reconciliation comparison and `touch` payload so a shipped factor is aligned with the JSON, including removal when the catalogue omits it. Never copy this field to an `isCustom: 1` row.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```powershell
npm.cmd run test:run -- src/lib/exerciseSnapshot.test.ts src/data/seed/seedDatabase.test.ts src/data/repositories/exerciseSnapshot.test.ts
npm.cmd run typecheck
```

Then:

```powershell
git add -- src/data/types.ts src/lib/exerciseSnapshot.ts src/lib/exerciseSnapshot.test.ts src/data/seed/exercises.json src/data/seed/seedDatabase.ts src/data/seed/seedDatabase.test.ts src/data/repositories/exerciseSnapshot.test.ts
git commit -m "feat: define bodyweight load factors"
```

---

### Task 3: Dated body-weight repository

**Files:**
- Create: `src/data/repositories/bodyMeasurements.ts`
- Create: `src/data/repositories/bodyMeasurements.test.ts`

**Interfaces:**
- Produces:

```ts
export interface BodyWeightReading { valueKg: number; measuredAt: number }
export async function getLatestBodyWeight(): Promise<BodyWeightReading | undefined>;
export async function saveBodyWeight(valueKg: number, measuredAt?: number): Promise<BodyWeightReading>;
export async function resolveBodyWeightsAt(timestamps: readonly number[]): Promise<Map<number, number>>;
```

- [ ] **Step 1: Write repository tests first**

Test first save, same-local-day replacement with stable row count, another-day insertion, latest read, resolution before/between/after measures, deleted rows ignored, and invalid `0`, negative, `NaN`, and infinity rejected with `RangeError`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/bodyMeasurements.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement repository-only Dexie access**

Use `newEntity`, `touch`, the existing compound index `[type+measuredAt]`, and a transaction for same-day upsert. Sort live body-weight rows oldest-first once in `resolveBodyWeightsAt`; for each timestamp choose the last `<= timestamp`, falling back to the first row.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/bodyMeasurements.test.ts
npm.cmd run typecheck
```

Then:

```powershell
git add -- src/data/repositories/bodyMeasurements.ts src/data/repositories/bodyMeasurements.test.ts
git commit -m "feat: store dated body weight readings"
```

---

### Task 4: Carry body weight and factors through historical projections

**Files:**
- Modify: `src/lib/historyProjection.ts`
- Modify: `src/data/repositories/historicalWorkouts.ts`
- Modify: `src/data/repositories/historicalWorkouts.test.ts`
- Modify: `src/lib/analytics/sessions.ts`
- Modify: `src/lib/analytics/sessions.test.ts`
- Modify: `src/lib/analytics/volume.ts`
- Modify: `src/lib/analytics/volume.test.ts`
- Modify: `src/lib/analytics/metrics.ts`
- Modify: `src/lib/analytics/metrics.test.ts`
- Modify: `src/lib/export/projectCoachExport.ts`
- Modify: `src/lib/export/projectCoachExport.test.ts`

**Interfaces:**
- `HistoricalWorkout.bodyWeightKg?: number`.
- `HistoricalExercise.bodyweightLoadFactor?: number`.
- `AnalyticsSession` carries both values required by `sessionTotals`.

- [ ] **Step 1: Write failing projection tests**

Create two dated measurements and workouts on either side of them. Assert the projected workouts receive the correct `bodyWeightKg`, the earliest fallback applies before the first measure, and snapshot factor wins over a changed library factor.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/historicalWorkouts.test.ts src/lib/analytics/sessions.test.ts
```

- [ ] **Step 3: Extend the projection in one batch read**

Call `resolveBodyWeightsAt(workouts.map(({ startedAt }) => startedAt))` once. Add the resolved weight to each workout and the resolved identity factor to each historical exercise. Do not add one Dexie read per workout.

- [ ] **Step 4: Write failing downstream consistency tests**

Use a common 80 kg body weight and assert:

- weekly volume counts an 8-rep push-up set as `448`;
- `toAnalyticsSessions` and `metricSeries('sessionTonnage')` return the same value;
- `reps_only` and `assisted_weight_reps` offer `sessionTonnage`;
- coach export totals match the weekly total.

- [ ] **Step 5: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/lib/analytics/volume.test.ts src/lib/analytics/metrics.test.ts src/lib/analytics/sessions.test.ts src/lib/export/projectCoachExport.test.ts
```

- [ ] **Step 6: Pass the shared inputs to `sessionTotals`**

Every mapping adds `bodyweightLoadFactor`; every workout call passes `bodyWeightKg`. Update `OFFERED` so reps-only and assisted exercise analytics can select session tonnage.

- [ ] **Step 7: Verify GREEN and commit**

Run all files from Steps 2 and 5, then typecheck. Commit:

```powershell
git add -- src/lib/historyProjection.ts src/data/repositories/historicalWorkouts.ts src/data/repositories/historicalWorkouts.test.ts src/lib/analytics/sessions.ts src/lib/analytics/sessions.test.ts src/lib/analytics/volume.ts src/lib/analytics/volume.test.ts src/lib/analytics/metrics.ts src/lib/analytics/metrics.test.ts src/lib/export/projectCoachExport.ts src/lib/export/projectCoachExport.test.ts
git commit -m "feat: propagate bodyweight tonnage through history"
```

---

### Task 5: Consistent live and history workout totals

**Files:**
- Modify: `src/data/repositories/workoutDetail.ts`
- Modify: `src/data/repositories/workouts.test.ts`
- Modify: `src/data/repositories/history.ts`
- Modify: `src/data/repositories/history.test.ts`
- Modify: `src/features/workout/WorkoutFinishScreen.tsx`
- Create: `src/features/workout/WorkoutFinishScreen.test.tsx`
- Modify: `src/features/history/HistoryWorkoutDetail.tsx`
- Modify: `src/features/history/HistoryWorkoutDetail.test.tsx`

**Interfaces:**
- `WorkoutDetail.bodyWeightKg?: number`, resolved by repositories at `workout.startedAt`.
- Components consume `workoutExerciseIdentityOf(line).bodyweightLoadFactor` and never read Dexie directly.

- [ ] **Step 1: Write failing detail and rendering tests**

Seed 80 kg, a push-up row with factor `0.7`, and 8 reps. Assert active detail and archived detail expose 80 kg, the finish reading is `448 kg`, and the archived detail shows the same tonnage.

- [ ] **Step 2: Verify RED**

Run the focused repository and component tests. Expected: missing body weight/factor propagation.

- [ ] **Step 3: Implement repository resolution and shared calculation**

Resolve the one workout timestamp through `resolveBodyWeightsAt([workout.startedAt])`. Pass factors into each `VolumeEntry` and `detail.bodyWeightKg` as the second `sessionTotals` argument.

- [ ] **Step 4: Verify GREEN and commit**

Run focused tests plus `src/lib/volume.test.ts`, then commit:

```powershell
git add -- src/data/repositories/workoutDetail.ts src/data/repositories/workouts.test.ts src/data/repositories/history.ts src/data/repositories/history.test.ts src/features/workout/WorkoutFinishScreen.tsx src/features/workout/WorkoutFinishScreen.test.tsx src/features/history/HistoryWorkoutDetail.tsx src/features/history/HistoryWorkoutDetail.test.tsx
git commit -m "feat: show bodyweight tonnage in workout totals"
```

---

### Task 6: Home weight entry and custom exercise coefficient

**Files:**
- Create: `src/features/home/HomeBodyWeightCard.tsx`
- Create: `src/features/home/HomeBodyWeightCard.test.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/exercises/ExerciseFormScreen.tsx`
- Create: `src/features/exercises/ExerciseFormScreen.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Home card calls only `getLatestBodyWeight` and `saveBodyWeight`.
- Exercise draft carries `bodyweightLoadFactor?: number` and persists it through `createCustomExercise`/`updateExercise`.

- [ ] **Step 1: Read and apply `frontend-design`**

Keep the existing FitTrack dark surfaces and typography. The new card is a compact utility, not a hero card: direct numeric entry, one 48 px action, stable success/error slot, no decorative motion.

- [ ] **Step 2: Write failing home-card behavior tests**

Test initial empty state, prefilled latest value/date, save, same-day correction, disabled unchanged value, rejected write with retry, and French labels.

- [ ] **Step 3: Verify RED**

Run:

```powershell
npm.cmd run test:run -- src/features/home/HomeBodyWeightCard.test.tsx
```

- [ ] **Step 4: Implement `HomeBodyWeightCard` and place it**

Render it immediately after `HomeWeekCard` in ready state, and still render it when the dashboard query errors. Add a matching skeleton height during loading. Keep `useHomeDashboard.ts` untouched so Claude's performance patch remains independent.

- [ ] **Step 5: Write failing custom-factor tests**

Assert `reps_only` shows an optional percentage field, blank persists no factor, `70` persists `0.7`, assisted defaults to `1`, and unrelated measurement types hide/remove the field.

- [ ] **Step 6: Implement the conditional percentage input**

Use `NumberInput`, percent copy from `fr.ts`, validate `(0, 100]`, and convert UI percent to the stored decimal factor at the form boundary.

- [ ] **Step 7: Verify GREEN, accessibility, and commit**

Run focused tests, typecheck, and lint. Confirm all interactive targets are at least 48 px and status/error messages use `role="status"`/`role="alert"` appropriately. Commit:

```powershell
git add -- src/features/home/HomeBodyWeightCard.tsx src/features/home/HomeBodyWeightCard.test.tsx src/features/home/HomeScreen.tsx src/features/exercises/ExerciseFormScreen.tsx src/features/exercises/ExerciseFormScreen.test.tsx src/i18n/fr.ts
git commit -m "feat: add quick body weight entry"
```

---

### Task 7: Copy migration, full verification, and Android v0.1.2

**Files:**
- Modify: `src/i18n/fr.ts`
- Modify: any tests asserting the old exclusion copy
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `PROGRESS.md`

**Interfaces:**
- No new API; this task removes contradictory UI claims and prepares the release.

- [ ] **Step 1: Write failing copy assertions**

Update/add tests so the finish, export, analytics, and metric descriptions call the value an estimated effective bodyweight load and no longer claim that bodyweight/lest/assistance are always excluded.

- [ ] **Step 2: Verify RED, then update French copy**

Run the affected i18n/component tests, confirm they fail on old text, then change only `fr.ts` and expected semantic behavior.

- [ ] **Step 3: Bump version to `0.1.2`**

Use the package manager so both manifests agree:

```powershell
npm.cmd version 0.1.2 --no-git-tag-version
```

- [ ] **Step 4: Update `PROGRESS.md`**

Record the formula, coefficients, dated weight source, history fallback, verification totals, and phone checkpoint. State the approximation and excluded segmental exercises.

- [ ] **Step 5: Run focused cross-consumer regression**

```powershell
npm.cmd run test:run -- src/lib/volume.test.ts src/data/repositories/bodyMeasurements.test.ts src/data/repositories/historicalWorkouts.test.ts src/lib/analytics/volume.test.ts src/lib/analytics/metrics.test.ts src/lib/export/projectCoachExport.test.ts src/features/home/HomeBodyWeightCard.test.tsx src/features/history/HistoryWorkoutDetail.test.tsx
```

- [ ] **Step 6: Run the full project gates**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run -- --maxWorkers=4
npm.cmd run build
npm.cmd run build:android:web
```

Run Capacitor sync. If Windows still throws the known `uv_os_get_passwd returned ENOMEM`, use only the already-diagnosed runtime shim without modifying repository files:

```powershell
node.exe -e "const os=require('os'); os.userInfo=()=>({shell:process.env.ComSpec||'cmd.exe'}); process.argv=['node','cap','sync','android']; require('./node_modules/@capacitor/cli/bin/capacitor')"
```

- [ ] **Step 7: Request code review and fix findings with RED-GREEN evidence**

Review the complete delta against this spec, especially coefficient snapshots, historical fallback, cross-consumer consistency, repository-only data access, and home-card accessibility.

- [ ] **Step 8: Commit release preparation**

```powershell
git add -- src/i18n/fr.ts package.json package-lock.json PROGRESS.md
git commit -m "chore: prepare Android release v0.1.2"
```

- [ ] **Step 9: Finish the branch and publish**

Use `finishing-a-development-branch`: merge this branch locally to `master`, merge Claude's `perf/home-dashboard-reads` branch, resolve conflicts without discarding either feature, re-run lint/typecheck/the complete test suite/PWA build/Android build and sync on the combined tree, clean the owned worktree, push `master`, create/push annotated tag `v0.1.2`, monitor `.github/workflows/android.yml`, and verify `FitTrack-v0.1.2.apk` exists in the GitHub Release.

**Phone checkpoint:** Install `FitTrack-v0.1.2.apk` over the existing app without uninstalling. Save body weight on Home, complete push-ups/squats/pull-ups/weighted/assisted work, compare Finish/History/Weekly Volume, correct the same-day weight, relaunch offline, and confirm data persists.
