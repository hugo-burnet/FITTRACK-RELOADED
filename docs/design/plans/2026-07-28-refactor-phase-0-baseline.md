# Refactor Phase 0 Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a committed, reproducible baseline for FitTrack before P0 fixes and behavior-preserving refactors.

**Architecture:** A test-only deep module, `seedLargeHistory`, owns deterministic bulk creation of a realistic IndexedDB history behind one interface. Existing repository interfaces remain the measurement seams; a separate Vitest benchmark exercises them without slowing `npm run test:run`. The architecture scan produces a temporary visual report and no application changes.

**Tech Stack:** React 19, TypeScript 6 strict, Dexie 4, fake-indexeddb 6, Vitest 4 / Tinybench, Vite 8, PowerShell, Git.

## Global Constraints

- No application behavior, UI copy, public repository interface, dependency, or Dexie schema may change.
- The large dataset stays test-only and never enters the production bundle.
- IDs, timestamps, row counts, ordering, and relationships are deterministic.
- The full reference profile is exactly 2,000 completed workouts, 8 exercises per workout, and 4 completed sets per exercise.
- No phone-data backup is required for this phase.
- Bugs discovered during measurement are recorded, never fixed opportunistically.
- `improve-codebase-architecture` governs the scan; `codebase-design` supplies its architecture vocabulary.
- `refactoring` is a gate only: no refactor begins in Phase 0.
- All user-facing text remains in `src/i18n/fr.ts`; this plan adds no user-facing text.
- Code, identifiers, and comments remain in English.

---

### Task 1: Freeze and measure the clean starting point

**Files:**
- Read: `docs/design/specs/2026-07-28-refactor-phase-0-baseline-design.md`
- Read: `docs/plans/01-ARCHITECTURE.md`
- Read: `package.json`
- Create Git tag only: `refactor-phase-0-start-2026-07-28`

**Interfaces:**
- Consumes: clean `master` after the committed specification and implementation plan.
- Produces: an annotated local reference tag plus captured command output for the final baseline report.

- [ ] **Step 1: Confirm the exact Git starting state**

Run:

```powershell
git status --short --branch
git log -3 --oneline --decorate
git diff --check
```

Expected:

- branch is `master`;
- working tree is clean;
- `git diff --check` exits `0`.

- [ ] **Step 2: Create the annotated local reference tag**

Run:

```powershell
git tag -a refactor-phase-0-start-2026-07-28 -m "refactor phase 0 starting point" HEAD
git show --no-patch --decorate refactor-phase-0-start-2026-07-28
```

Expected: the tag resolves to the clean plan commit at `HEAD`. Do not push the tag during Phase 0.

- [ ] **Step 3: Run and time the initial quality gates**

Run each command separately and retain its exit code, elapsed milliseconds, and relevant summary:

```powershell
Measure-Command { npm run lint }
Measure-Command { npm run typecheck }
Measure-Command { npm run test:run }
Measure-Command { npm run build }
git diff --check
```

Expected: all five checks exit `0`. If one fails, stop implementation, preserve the output, and invoke `systematic-debugging`; do not change assertions or application behavior.

- [ ] **Step 4: Capture source-size metrics**

Run:

```powershell
Get-ChildItem -LiteralPath src -Recurse -File -Include *.ts,*.tsx |
  ForEach-Object {
    [PSCustomObject]@{
      Lines = (Get-Content -LiteralPath $_.FullName).Count
      File = $_.FullName.Substring((Get-Location).Path.Length + 1)
    }
  } |
  Sort-Object Lines -Descending |
  Select-Object -First 40
```

Expected: exactly 40 rows, sorted from the largest source file down.

- [ ] **Step 5: Capture build-size metrics**

Run:

```powershell
Get-ChildItem -LiteralPath dist\assets -File |
  Where-Object { $_.Extension -in '.js', '.css' } |
  ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $buffer = New-Object System.IO.MemoryStream
    $gzip = New-Object System.IO.Compression.GZipStream(
      $buffer,
      [System.IO.Compression.CompressionLevel]::SmallestSize,
      $true
    )
    $gzip.Write($bytes, 0, $bytes.Length)
    $gzip.Dispose()
    [PSCustomObject]@{
      File = $_.Name
      Bytes = $bytes.Length
      GzipBytes = $buffer.Length
    }
    $buffer.Dispose()
  } |
  Sort-Object Bytes -Descending
```

Expected: every JavaScript and CSS asset has raw and gzip byte counts.

---

### Task 2: Add the deterministic large-history module with TDD

**Files:**
- Create: `src/test/largeHistory.test.ts`
- Create: `src/test/largeHistory.ts`
- Read: `src/test/factories.ts`
- Read: `src/data/types.ts`
- Read: `src/data/db.ts`

**Interfaces:**
- Consumes: `db` from `@/data/db` and persisted entity types from `@/data/types`.
- Produces:
  - `LargeHistoryProfile`
  - `LargeHistoryCounts`
  - `LARGE_HISTORY_PROFILE`
  - `seedLargeHistory(profile: LargeHistoryProfile): Promise<LargeHistoryCounts>`

- [ ] **Step 1: Write the failing deterministic-history tests**

Create `src/test/largeHistory.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import {
  seedLargeHistory,
  type LargeHistoryProfile,
} from '@/test/largeHistory';

const SMALL_PROFILE: LargeHistoryProfile = {
  workoutCount: 3,
  exercisesPerWorkout: 2,
  setsPerExercise: 2,
  startedAt: Date.UTC(2020, 0, 6, 18),
  workoutSpacingMs: 36 * 60 * 60 * 1_000,
};

async function snapshotIdsAndTimes(): Promise<{
  workoutIds: string[];
  workoutTimes: number[];
  rowIds: string[];
  setIds: string[];
}> {
  const [workouts, rows, sets] = await Promise.all([
    db.workouts.orderBy('startedAt').toArray(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
  ]);

  return {
    workoutIds: workouts.map((workout) => workout.id),
    workoutTimes: workouts.map((workout) => workout.startedAt),
    rowIds: rows.map((row) => row.id).sort(),
    setIds: sets.map((set) => set.id).sort(),
  };
}

describe('seedLargeHistory', () => {
  beforeEach(resetDb);

  it('creates the requested graph with valid parent relationships', async () => {
    const counts = await seedLargeHistory(SMALL_PROFILE);

    expect(counts).toEqual({
      exercises: 2,
      workouts: 3,
      workoutExercises: 6,
      workoutSets: 12,
    });
    await expect(db.exercises.count()).resolves.toBe(2);
    await expect(db.workouts.count()).resolves.toBe(3);
    await expect(db.workoutExercises.count()).resolves.toBe(6);
    await expect(db.workoutSets.count()).resolves.toBe(12);

    const workouts = new Set((await db.workouts.toArray()).map((row) => row.id));
    const rows = await db.workoutExercises.toArray();
    const rowIds = new Set(rows.map((row) => row.id));
    const sets = await db.workoutSets.toArray();

    expect(rows.every((row) => workouts.has(row.workoutId))).toBe(true);
    expect(sets.every((set) => workouts.has(set.workoutId))).toBe(true);
    expect(sets.every((set) => rowIds.has(set.workoutExerciseId))).toBe(true);
    expect(sets.every((set) => set.isCompleted === 1)).toBe(true);
  });

  it('recreates the same ids, ordering, and timestamps after reset', async () => {
    await seedLargeHistory(SMALL_PROFILE);
    const first = await snapshotIdsAndTimes();

    await resetDb();
    await seedLargeHistory(SMALL_PROFILE);

    expect(await snapshotIdsAndTimes()).toEqual(first);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/test/largeHistory.test.ts
```

Expected: FAIL because `@/test/largeHistory` does not exist.

- [ ] **Step 3: Implement the deep test-data module**

Create `src/test/largeHistory.ts`:

```typescript
import { db } from '@/data/db';
import type {
  Equipment,
  Exercise,
  MuscleGroup,
  Syncable,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { day } from '@/test/factories';

export interface LargeHistoryProfile {
  workoutCount: number;
  exercisesPerWorkout: number;
  setsPerExercise: number;
  startedAt: number;
  workoutSpacingMs: number;
}

export interface LargeHistoryCounts {
  exercises: number;
  workouts: number;
  workoutExercises: number;
  workoutSets: number;
}

export const LARGE_HISTORY_PROFILE: LargeHistoryProfile = {
  workoutCount: 2_000,
  exercisesPerWorkout: 8,
  setsPerExercise: 4,
  startedAt: day(-3_000),
  workoutSpacingMs: 36 * 60 * 60 * 1_000,
};

const MUSCLES: readonly MuscleGroup[] = [
  'chest',
  'lats',
  'upper_back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'abs',
];

const EQUIPMENT: readonly Equipment[] = [
  'barbell',
  'cable',
  'machine',
  'dumbbell',
  'barbell',
  'machine',
  'cable',
  'bodyweight',
];

const pad = (value: number): string => value.toString().padStart(5, '0');

function syncable(id: string, at: number): Syncable {
  return {
    id,
    createdAt: at,
    updatedAt: at,
    deletedAt: 0,
  };
}

export async function seedLargeHistory(
  profile: LargeHistoryProfile,
): Promise<LargeHistoryCounts> {
  const exercises: Exercise[] = Array.from(
    { length: profile.exercisesPerWorkout },
    (_, exerciseIndex) => ({
      ...syncable(`large-exercise-${pad(exerciseIndex)}`, profile.startedAt),
      name: `Benchmark exercise ${exerciseIndex + 1}`,
      primaryMuscle: MUSCLES[exerciseIndex % MUSCLES.length]!,
      secondaryMuscles: [],
      equipment: EQUIPMENT[exerciseIndex % EQUIPMENT.length]!,
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    }),
  );

  const workouts: Workout[] = [];
  const workoutExercises: WorkoutExercise[] = [];
  const workoutSets: WorkoutSet[] = [];

  for (let workoutIndex = 0; workoutIndex < profile.workoutCount; workoutIndex += 1) {
    const workoutId = `large-workout-${pad(workoutIndex)}`;
    const startedAt = profile.startedAt + workoutIndex * profile.workoutSpacingMs;

    workouts.push({
      ...syncable(workoutId, startedAt),
      routineId: '',
      name: `Benchmark workout ${workoutIndex + 1}`,
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
      startedTimezoneOffsetMinutes: 0,
    });

    for (
      let exerciseIndex = 0;
      exerciseIndex < profile.exercisesPerWorkout;
      exerciseIndex += 1
    ) {
      const exercise = exercises[exerciseIndex]!;
      const rowId = `large-row-${pad(workoutIndex)}-${pad(exerciseIndex)}`;

      workoutExercises.push({
        ...syncable(rowId, startedAt),
        workoutId,
        exerciseId: exercise.id,
        order: exerciseIndex,
        supersetGroup: 0,
        restSeconds: 120,
        exerciseName: exercise.name,
        exerciseMeasurementType: exercise.measurementType,
        exercisePrimaryMuscle: exercise.primaryMuscle,
        exerciseEquipment: exercise.equipment,
      });

      for (let setIndex = 0; setIndex < profile.setsPerExercise; setIndex += 1) {
        workoutSets.push({
          ...syncable(
            `large-set-${pad(workoutIndex)}-${pad(exerciseIndex)}-${pad(setIndex)}`,
            startedAt,
          ),
          workoutExerciseId: rowId,
          exerciseId: exercise.id,
          workoutId,
          order: setIndex,
          setType: 'normal',
          side: 'both',
          weight: 20 + exerciseIndex * 10 + setIndex * 2.5,
          reps: 12 - setIndex,
          isCompleted: 1,
          performedAt:
            startedAt +
            (exerciseIndex * profile.setsPerExercise + setIndex + 1) * 60_000,
        });
      }
    }
  }

  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    async () => {
      await db.exercises.bulkAdd(exercises);
      await db.workouts.bulkAdd(workouts);
      await db.workoutExercises.bulkAdd(workoutExercises);
      await db.workoutSets.bulkAdd(workoutSets);
    },
  );

  return {
    exercises: exercises.length,
    workouts: workouts.length,
    workoutExercises: workoutExercises.length,
    workoutSets: workoutSets.length,
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npx vitest run src/test/largeHistory.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Run type and regression gates**

Run:

```powershell
npm run typecheck
npm run test:run
```

Expected: both commands exit `0`; the suite has exactly two more tests than the Task 1 baseline.

- [ ] **Step 6: Commit the deterministic data module**

Run:

```powershell
git add -- src/test/largeHistory.ts src/test/largeHistory.test.ts
git commit -m "test: ajoute un historique volumineux reproductible"
```

Expected: one atomic `test:` commit containing only the generator and its tests.

---

### Task 3: Add an opt-in history benchmark

**Files:**
- Create: `src/data/repositories/history.bench.ts`
- Modify: `package.json`
- Read: `src/data/repositories/history.ts`
- Read: `src/data/repositories/exportQueries.ts`
- Read: `src/lib/export/types.ts`

**Interfaces:**
- Consumes:
  - `seedLargeHistory(LARGE_HISTORY_PROFILE)`
  - `listHistoryPage({}, 0, 20)`
  - `listCompletedWorkoutTimestamps()`
  - `listExportSources({ kind: 'period', from, to })`
- Produces: npm command `bench:history` and `.tmp/history-benchmark.json` when explicitly requested.

- [ ] **Step 1: Add the benchmark command**

Add this script to `package.json` after `test:run`:

```json
"bench:history": "vitest bench src/data/repositories/history.bench.ts --run",
```

- [ ] **Step 2: Create the benchmark at the existing repository seams**

Create `src/data/repositories/history.bench.ts`:

```typescript
import { beforeAll, bench } from 'vitest';
import { listExportSources } from '@/data/repositories/exportQueries';
import {
  listCompletedWorkoutTimestamps,
  listHistoryPage,
} from '@/data/repositories/history';
import {
  LARGE_HISTORY_PROFILE,
  seedLargeHistory,
} from '@/test/largeHistory';
import { resetDb } from '@/test/resetDb';

const DAY_MS = 86_400_000;
const OPTIONS = {
  iterations: 3,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};

beforeAll(async () => {
  await resetDb();
  const startedAt = performance.now();
  const counts = await seedLargeHistory(LARGE_HISTORY_PROFILE);
  const elapsedMs = performance.now() - startedAt;

  if (
    counts.workouts !== 2_000 ||
    counts.workoutExercises !== 16_000 ||
    counts.workoutSets !== 64_000
  ) {
    throw new Error(`Unexpected large-history counts: ${JSON.stringify(counts)}`);
  }

  console.info(
    `large-history seed: ${elapsedMs.toFixed(1)} ms ` +
      `(${counts.workouts} workouts, ${counts.workoutExercises} rows, ` +
      `${counts.workoutSets} sets)`,
  );
}, 120_000);

bench(
  'history first page from 2,000 workouts',
  async () => {
    await listHistoryPage({}, 0, 20);
  },
  OPTIONS,
);

bench(
  'completed workout timestamps from 2,000 workouts',
  async () => {
    await listCompletedWorkoutTimestamps();
  },
  OPTIONS,
);

bench(
  'bounded one-year export projection',
  async () => {
    await listExportSources({
      kind: 'period',
      from: LARGE_HISTORY_PROFILE.startedAt,
      to: LARGE_HISTORY_PROFILE.startedAt + 365 * DAY_MS,
    });
  },
  OPTIONS,
);
```

- [ ] **Step 3: Typecheck the benchmark before running it**

Run:

```powershell
npm run typecheck
```

Expected: exit `0`; the benchmark imports only existing public repository interfaces.

- [ ] **Step 4: Run the full benchmark once and save machine-readable output**

Run:

```powershell
New-Item -ItemType Directory -Force -Path '.tmp' | Out-Null
npm run bench:history -- --outputJson .tmp/history-benchmark.json
Get-Content -Raw -Encoding UTF8 -LiteralPath '.tmp/history-benchmark.json'
```

Expected:

- console reports exactly 2,000 workouts, 16,000 workout-exercise rows, and 64,000 sets;
- three benchmark tasks complete without error;
- `.tmp/history-benchmark.json` contains their sample counts and timing statistics.

- [ ] **Step 5: Prove the benchmark remains opt-in**

Run:

```powershell
npm run test:run
```

Expected: unit tests pass and `history.bench.ts` is not listed as a test file.

- [ ] **Step 6: Commit the benchmark separately**

Run:

```powershell
git add -- package.json src/data/repositories/history.bench.ts
git commit -m "test: mesure les lectures d’un historique volumineux"
```

Expected: one atomic `test:` commit; `.tmp/history-benchmark.json` remains ignored and uncommitted.

---

### Task 4: Run the installed architecture skills without changing the app

**Files:**
- Read: `docs/plans/01-ARCHITECTURE.md`
- Read: `docs/design/specs/2026-07-28-refactor-phase-0-baseline-design.md`
- Read: `PROGRESS.md`
- Read: recent files under `src/data/repositories/`, `src/features/analytics/`, `src/features/history/`, `src/features/workout/`, and `src/features/routines/`
- Create outside repository: `%TEMP%\architecture-review-20260728-phase0.html`

**Interfaces:**
- Consumes: installed `improve-codebase-architecture`, `codebase-design`, and `refactoring` skills.
- Produces: a temporary HTML report containing ranked deepening candidates; no module interface is selected or implemented.

- [ ] **Step 1: Establish the scan scope from evidence**

Run:

```powershell
git log --since="2026-07-25" --name-only --pretty=format: |
  Where-Object { $_ -ne '' } |
  Group-Object |
  Sort-Object Count -Descending |
  Select-Object -First 30 Count,Name
```

Use the result plus the audit P0/P1 list to scope the scan to:

- history/export/analytics reads;
- workout lifecycle and set mutations;
- routine ordering and set mutations;
- the three large screen coordinators only where recent changes or missing tests create real friction.

- [ ] **Step 2: Dispatch one Explorer as required by `improve-codebase-architecture`**

Give the Explorer this bounded brief:

```text
Inspect FitTrack for deepening opportunities only in:
1. history/export/analytics reads,
2. workout lifecycle and set mutations,
3. routine ordering and set mutations,
4. RoutinesScreen, RoutineEditorScreen, WorkoutExerciseCard, and WorkoutScreen
   only where recent commits or missing integration tests create concrete friction.

Read docs/plans/01-ARCHITECTURE.md ADR-001 through ADR-007 and the Phase 0
baseline spec first. Use the codebase-design vocabulary exactly: module,
interface, implementation, depth, seam, adapter, leverage, locality.

For each candidate provide exact files, current interface, leakage/friction,
deletion-test result, dependency category, preservation evidence available,
and recommendation strength Strong / Worth exploring / Speculative.
Do not edit files. Do not design replacement interfaces. Do not suggest
features or bug fixes as refactors.
```

Expected: a read-only report with evidence grounded in exact files.

- [ ] **Step 3: Apply the `refactoring` gate to every candidate**

Reject or relabel any candidate that:

- changes behavior;
- lacks proportionate preservation evidence;
- exists only to make a private helper unit-testable;
- introduces speculative generality;
- mixes a P0 fix into a structural change.

Expected: the final candidate list contains only behavior-preserving future work, or explicitly says that no candidate is ready.

- [ ] **Step 4: Generate the visual HTML report**

Create `%TEMP%\architecture-review-20260728-phase0.html` following the installed `HTML-REPORT.md`:

- one card per candidate;
- exact files;
- one-sentence problem and solution;
- side-by-side before/after diagram;
- dependency category;
- recommendation strength;
- wins expressed as leverage and locality;
- a single top recommendation;
- Tailwind CDN and Mermaid ESM only;
- no application code and no repository write.

Expected: the report uses the terms **module**, **interface**, **implementation**, **depth**, **seam**, **adapter**, **leverage**, and **locality** consistently.

- [ ] **Step 5: Open and inspect the report**

Run the platform-equivalent open action for the exact generated path, then inspect that:

- every diagram renders;
- no card proposes an interface yet;
- ADR conflicts are marked, not silently ignored;
- the top recommendation matches the strongest evidence.

Expected: a readable local HTML report and its absolute path retained for the final handoff.

---

### Task 5: Commit the measured baseline and project handoff

**Files:**
- Create: `docs/baselines/2026-07-28-refactor-baseline.md`
- Modify: `PROGRESS.md`
- Read: `.tmp/history-benchmark.json`
- Read: temporary architecture HTML report

**Interfaces:**
- Consumes: all captured outputs from Tasks 1–4.
- Produces: the durable baseline record and the end-of-session checkpoint.

- [ ] **Step 1: Write the baseline report with observed values only**

Create `docs/baselines/2026-07-28-refactor-baseline.md` with these exact sections:

```markdown
# Baseline de refactorisation — 2026-07-28

## Référence Git

## Environnement

## Portes qualité initiales

## Inventaire du code

## Taille du build

## Dataset volumineux

## Mesures des lectures historiques

## Scan d’architecture

## Limites de la baseline

## Anomalies consignées sans correction
```

Populate every section from captured output:

- exact tag and commit;
- Node/npm versions;
- exit code and elapsed time for each gate;
- Vitest file/test count;
- 40 largest TypeScript/TSX files;
- raw/gzip build assets;
- exact dataset counts and seed duration;
- benchmark median/sample count from the JSON result;
- temporary architecture-report path and ranked candidates;
- explicit `fake-indexeddb` versus phone limitation;
- `Aucune` when no anomaly was observed.

Do not invent thresholds, round away raw byte counts, or convert an observed failure into a fix.

- [ ] **Step 2: Update `PROGRESS.md` at the top**

Add a new current entry stating:

- Phase 0 baseline completed;
- tag and baseline-report path;
- deterministic dataset counts;
- benchmark interfaces measured;
- architecture scan performed with the three installed skills;
- `reduce-system-complexity` not installed because no verified source was found;
- no application behavior or Dexie schema changed;
- any anomalies recorded but not fixed.

Add this manual checkpoint:

```text
Checkpoint manuel : aucune donnée du téléphone n’a été modifiée. Ouvrir
FitTrack, vérifier que l’accueil, l’historique et une séance existante
s’affichent comme avant. Aucun parcours fonctionnel neuf n’est attendu :
la phase 0 est une référence de mesure.
```

- [ ] **Step 3: Run the final verification gates**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
git status --short
```

Expected:

- all five gates exit `0`;
- only the baseline report and `PROGRESS.md` are uncommitted;
- `.tmp/history-benchmark.json` and the temporary HTML report are absent from Git status.

- [ ] **Step 4: Inspect the complete Phase 0 diff**

Run:

```powershell
git diff --stat refactor-phase-0-start-2026-07-28..HEAD
git diff refactor-phase-0-start-2026-07-28..HEAD
git diff -- docs/baselines/2026-07-28-refactor-baseline.md PROGRESS.md
```

Verify:

- no file under `src/features/`, `src/ui/`, `src/lib/`, or production repositories changed;
- `src/test/largeHistory.ts` is imported only by tests and benchmark code;
- no dependency or Dexie version changed;
- no assertion was weakened;
- the benchmark is opt-in.

- [ ] **Step 5: Commit the durable baseline**

Run:

```powershell
git add -- docs/baselines/2026-07-28-refactor-baseline.md PROGRESS.md
git commit -m "chore: établit la baseline de refactorisation"
```

Expected: one atomic `chore:` commit containing only the report and handoff update.

- [ ] **Step 6: Verify the final history and tag**

Run:

```powershell
git status --short --branch
git log -5 --oneline --decorate
git show --no-patch --decorate refactor-phase-0-start-2026-07-28
```

Expected: clean `master`; the local tag still points to the pre-implementation plan commit; later commits contain the dataset, benchmark, and baseline report separately.
