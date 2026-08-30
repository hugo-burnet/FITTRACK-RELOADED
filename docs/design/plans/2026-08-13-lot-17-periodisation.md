# Lot 17 — Periodization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build offline 4–12 week programs with a repeated split, weekly %1RM or RPE prescriptions, effective routine versions, planned deloads, and an explicit authority boundary with the Lot 18 Coach.

**Architecture:** Pure modules in `src/lib/programs/` own civil-calendar math, schedule resolution, suggestions, validation, and prescription projection. Dexie repositories own program persistence, routine publication, Coach supersession, and atomic workout creation. UI in `src/features/programs/` consumes repository projections and never imports `db`.

**Tech Stack:** React 19, TypeScript strict, Dexie/IndexedDB, dexie-react-hooks, React Router hash mode, Tailwind CSS v4, Vitest, Testing Library, fake-indexeddb.

## Global Constraints

- Programs are unlimited; only one may be active.
- A block lasts an integer from 4 through 12 weeks and begins on a local Monday.
- Calendar math uses civil dates and must survive DST.
- The weekly split repeats; prescriptions and deload markers vary by week.
- Routine and split changes are effective from a selected week and never rewrite earlier weeks.
- Programmed workouts snapshot their routine and targets.
- In a programmed workout, the program prescribes and the Coach only observes.
- Components never import `db`; French copy only lives in `src/i18n/fr.ts`.
- The whole path works offline and keeps ≥48 px touch targets.

---

### Task 1: Add persisted program contracts and Dexie v6

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/db.ts`
- Modify: `src/data/dbMigration.test.ts`
- Modify: routine constructors and typed fixtures that create `Routine`

**Interfaces:**
- Produces: `Program`, `ProgramWeek`, `ProgramScheduleRevision`, `ProgramScheduleEntry`, `RoutineVersionState`.
- Extends: `Workout`, `WorkoutSet`, and `CoachRecommendationStatus`.

- [ ] **Step 1: Write the failing migration assertions**

Seed a legacy routine in `dbMigration.test.ts`, then assert:

```ts
expect(db.verno).toBe(6);
expect(db.tables.map((table) => table.name)).toEqual(
  expect.arrayContaining([
    'programs',
    'programWeeks',
    'programScheduleRevisions',
    'programScheduleEntries',
  ]),
);
expect(await db.routines.get('legacy-routine')).toMatchObject({
  versionState: 'published',
});
```

- [ ] **Step 2: Verify the migration test fails**

Run: `npm run test:run -- src/data/dbMigration.test.ts`

Expected: FAIL because schema version 6 and the stores do not exist.

- [ ] **Step 3: Add the persisted types**

Add these exact contracts to `src/data/types.ts`:

```ts
export type RoutineVersionState = 'draft' | 'published';
export type ProgramStatus = 'draft' | 'active' | 'completed';
export type ProgramPrescriptionKind = 'percent_1rm' | 'target_rpe';

export interface Program extends Syncable {
  name: string;
  startsAt: number;
  durationWeeks: number;
  status: ProgramStatus;
}

export interface ProgramWeek extends Syncable {
  programId: string;
  weekIndex: number;
  prescriptionKind: ProgramPrescriptionKind;
  prescriptionValue: number;
  isDeload: 0 | 1;
  notes?: string;
}

export interface ProgramScheduleRevision extends Syncable {
  programId: string;
  effectiveFromWeekIndex: number;
}

export interface ProgramScheduleEntry extends Syncable {
  revisionId: string;
  routineId: string;
  dayOfWeek: number;
  order: number;
}
```

Make `Routine.versionState` required. Add optional `programId`, `programWeekIndex`, `programScheduleEntryId`, and `programIsDeload` to `Workout`; add `targetRpe` to `WorkoutSet`; add `'superseded'` to the Coach status union.

- [ ] **Step 4: Append Dexie version 6**

Do not edit versions 1–5. Add the four typed tables and:

```ts
this.version(6)
  .stores({
    programs: 'id, status, startsAt, updatedAt, deletedAt',
    programWeeks: 'id, programId, [programId+weekIndex], deletedAt',
    programScheduleRevisions:
      'id, programId, [programId+effectiveFromWeekIndex], deletedAt',
    programScheduleEntries:
      'id, revisionId, [revisionId+order], routineId, deletedAt',
  })
  .upgrade(async (tx) => {
    await tx.table<Routine>('routines').toCollection().modify((routine) => {
      routine.versionState = 'published';
    });
  });
```

- [ ] **Step 5: Update every routine constructor**

Normal routines and copies receive `versionState: 'published'`; normal duplication remains version 1 without `originRoutineId`.

- [ ] **Step 6: Verify**

Run:

```bash
npm run test:run -- src/data/dbMigration.test.ts src/data/repositories/routines.test.ts src/data/repositories/hevyRoutineImport.test.ts src/data/repositories/csvRoundTrip.test.ts src/data/seed/routineTemplates.test.ts
npm run typecheck
```

Expected: PASS and zero type errors.

- [ ] **Step 7: Commit**

```bash
git add src/data
git add src/features/routines/RoutineCollection.test.tsx
git commit -m "feat(lot-17): add program persistence contracts"
```

### Task 2: Implement civil program calendar math

**Files:**
- Create: `src/lib/programs/calendar.ts`
- Create: `src/lib/programs/calendar.test.ts`
- Create: `src/lib/programs/index.ts`

**Interfaces:**
- Produces: `programPosition`, `shiftLocalDate`, `isoDayOfWeek`.

- [ ] **Step 1: Write failing tests**

```ts
const monday = new Date(2026, 7, 10).getTime();
expect(programPosition(monday, 4, new Date(2026, 7, 9).getTime()))
  .toEqual({ phase: 'before' });
expect(programPosition(monday, 4, new Date(2026, 7, 24).getTime()))
  .toMatchObject({ phase: 'active', weekIndex: 2 });
expect(programPosition(monday, 4, new Date(2026, 8, 7).getTime()))
  .toEqual({ phase: 'after' });
expect(new Date(shiftLocalDate(new Date(2026, 2, 23).getTime(), 7)).getDate())
  .toBe(30);
expect(isoDayOfWeek(monday)).toBe(1);
```

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/lib/programs/calendar.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement using civil ordinals**

```ts
const civilOrdinal = (timestamp: number): number => {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
};

export type ProgramPosition =
  | { phase: 'before' }
  | { phase: 'active'; weekIndex: number; dayOfWeek: number }
  | { phase: 'after' };
```

`programPosition` divides the difference of civil ordinals by 7. `shiftLocalDate` uses `setDate`, never raw milliseconds.

- [ ] **Step 4: Verify and commit**

```bash
npm run test:run -- src/lib/programs/calendar.test.ts
git add src/lib/programs
git commit -m "feat(lot-17): calculate program weeks by civil date"
```

### Task 3: Resolve schedules, validate drafts, and pick sessions

**Files:**
- Create: `src/lib/programs/schedule.ts`
- Create: `src/lib/programs/schedule.test.ts`
- Create: `src/lib/programs/validation.ts`
- Create: `src/lib/programs/validation.test.ts`
- Modify: `src/lib/programs/index.ts`

**Interfaces:**
- Produces: `resolveSchedule`, `pickProgramSession`, `validateProgramDraft`.

- [ ] **Step 1: Write schedule truth-table tests**

Use:

```ts
export interface ProgramSessionCandidate {
  entryId: string;
  routineId: string;
  weekIndex: number;
  dayOfWeek: number;
  order: number;
  completed: boolean;
}

export type ProgramSessionPick =
  | { kind: 'today' | 'missed' | 'upcoming'; session: ProgramSessionCandidate }
  | { kind: 'next_week'; weekIndex: number }
  | { kind: 'none' };
```

Test latest revision where `effectiveFromWeekIndex <= weekIndex`, then today → missed → upcoming → next week.

- [ ] **Step 2: Write validation tests**

Use exact codes:

```ts
export type ProgramValidationCode =
  | 'duration_out_of_range'
  | 'start_not_monday'
  | 'missing_week'
  | 'invalid_percent_1rm'
  | 'invalid_target_rpe'
  | 'empty_schedule'
  | 'missing_routine';
```

Valid domains: %1RM 1–100; RPE 6–10 in 0.5 increments.

- [ ] **Step 3: Verify failure**

Run: `npm run test:run -- src/lib/programs/schedule.test.ts src/lib/programs/validation.test.ts`

Expected: FAIL because the modules are absent.

- [ ] **Step 4: Implement**

`resolveSchedule` selects the greatest effective index not after the requested week and returns that revision’s entries sorted by day, order, then id. `validateProgramDraft` returns codes only—never French text.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- src/lib/programs/schedule.test.ts src/lib/programs/validation.test.ts
npm run typecheck
git add src/lib/programs
git commit -m "feat(lot-17): resolve and validate program schedules"
```

### Task 4: Project weekly prescriptions

**Files:**
- Modify: `src/lib/loadIncrement.ts`
- Modify: `src/lib/loadIncrement.test.ts`
- Create: `src/lib/programs/prescription.ts`
- Create: `src/lib/programs/prescription.test.ts`
- Modify: `src/lib/programs/index.ts`

**Interfaces:**
- Produces: `roundLoadToIncrement`, `projectProgramPrescription`.

- [ ] **Step 1: Test load-grid rounding**

```ts
expect(roundLoadToIncrement(76.2, 2.5)).toBe(75);
expect(roundLoadToIncrement(77, 2.5)).toBe(77.5);
expect(roundLoadToIncrement(41, 2)).toBe(42);
expect(roundLoadToIncrement(Number.NaN, 2.5)).toBeUndefined();
```

- [ ] **Step 2: Test projection**

Use:

```ts
export type ProgramPrescriptionWarningCode =
  | 'missing_one_rep_max'
  | 'unsupported_measurement'
  | 'assistance_not_supported';

export interface ProgramPrescriptionWarning {
  code: ProgramPrescriptionWarningCode;
  exerciseId: string;
}
```

Cover %1RM, exercise increment, fallback to routine targets, assisted exercise warning, RPE target, and untouched warm-ups.

- [ ] **Step 3: Verify failure**

Run: `npm run test:run -- src/lib/loadIncrement.test.ts src/lib/programs/prescription.test.ts`

- [ ] **Step 4: Implement**

For working sets under %1RM, project `oneRepMax * value / 100` onto the exercise increment. For RPE, retain routine targets and set `targetRpe`. Never write performed `weight`, `reps`, or `rpe`.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- src/lib/loadIncrement.test.ts src/lib/programs/prescription.test.ts
git add src/lib/loadIncrement.ts src/lib/loadIncrement.test.ts src/lib/programs
git commit -m "feat(lot-17): project weekly prescriptions"
```
### Task 5: Build program lifecycle and schedule repositories

**Files:**
- Create: `src/data/repositories/programLifecycle.ts`
- Create: `src/data/repositories/programSchedules.ts`
- Create: `src/data/repositories/programs.ts`
- Create: `src/data/repositories/programs.test.ts`

**Interfaces:**
- Produces:

```ts
createProgramDraft(input): Promise<Program>
replaceProgramWeeks(programId, weeks): Promise<void>
createScheduleRevision(programId, effectiveFromWeekIndex, entries): Promise<ProgramScheduleRevision>
getProgramDetail(programId): Promise<ProgramDetail | null>
listPrograms(): Promise<ProgramSummary[]>
getActiveProgramDetail(at?): Promise<ActiveProgramDetail | null>
activateProgram(programId): Promise<void>
completeProgram(programId): Promise<void>
shiftProgram(programId, days): Promise<void>
```

- [ ] **Step 1: Write failing repository tests**

Cover draft creation, complete week replacement, full schedule revision, one-active rejection, 4–12 validation, shift without rewriting workouts, and soft-delete cascade.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/data/repositories/programs.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement typed repository errors**

```ts
export type ProgramRepositoryErrorCode =
  | 'program_not_found'
  | 'program_invalid'
  | 'another_program_active'
  | 'retroactive_revision'
  | 'routine_missing';

export class ProgramRepositoryError extends Error {
  constructor(readonly code: ProgramRepositoryErrorCode) {
    super(code);
  }
}
```

Activation loads program, weeks, revisions, entries, and routines in one transaction, calls `validateProgramDraft`, then changes status.

- [ ] **Step 4: Implement projections**

`ProgramDetail` returns ordered weeks and every revision with entries. `ActiveProgramDetail` adds current position, resolved entries, and completed workouts matched by persisted program context.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- src/data/repositories/programs.test.ts
npm run typecheck
git add src/data/repositories/programLifecycle.ts src/data/repositories/programSchedules.ts src/data/repositories/programs.ts src/data/repositories/programs.test.ts
git commit -m "feat(lot-17): persist program lifecycle"
```

### Task 6: Add effective routine versions

**Files:**
- Create: `src/data/repositories/routineVersions.ts`
- Modify: `src/data/repositories/routineLifecycle.ts`
- Modify: `src/data/repositories/routines.ts`
- Modify: `src/data/repositories/routines.test.ts`

**Interfaces:**
- Produces:

```ts
createRoutineVersionDraft(sourceRoutineId: string): Promise<Routine>
publishRoutineVersion(input: {
  draftRoutineId: string;
  programId: string;
  effectiveFromWeekIndex: number;
}): Promise<Routine>
isRoutineSealed(routineId: string): Promise<boolean>
listRoutineLineage(routineId: string): Promise<Routine[]>
```

- [ ] **Step 1: Write failing version tests**

Assert deep-copy fresh ids, root lineage, sequential version numbers, draft exclusion from normal summaries, atomic publication into a full schedule revision, and deletion refusal for referenced routines.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/data/repositories/routines.test.ts`

- [ ] **Step 3: Implement draft creation**

```ts
const rootId = source.originRoutineId ?? source.id;
const version = Math.max(...lineage.map((item) => item.version)) + 1;
const draft = newEntity<Routine>({
  name: source.name,
  subtitle: source.subtitle,
  folderId: source.folderId,
  order: source.order,
  notes: source.notes,
  version,
  originRoutineId: rootId,
  versionState: 'draft',
});
```

Deep-copy exercises and sets using fresh UUIDs.

- [ ] **Step 4: Publish atomically**

Load the effective full split, replace every occurrence of the source lineage with the draft id, create a new full revision, and mark the draft published in one transaction.

- [ ] **Step 5: Filter routine summaries**

Group by `originRoutineId ?? id`, return only the greatest published version per lineage, and expose drafts via a separate query.

- [ ] **Step 6: Guard deletion**

Throw a dedicated `RoutineReferencedError` when any live schedule entry references the routine. Do not silently break a program.

- [ ] **Step 7: Verify and commit**

```bash
npm run test:run -- src/data/repositories/routines.test.ts src/data/repositories/programs.test.ts
npm run typecheck
git add src/data/repositories/routineVersions.ts src/data/repositories/routineLifecycle.ts src/data/repositories/routines.ts src/data/repositories/routines.test.ts
git commit -m "feat(lot-17): publish effective routine versions"
```

### Task 7: Integrate program authority with the Coach

**Files:**
- Modify: `src/lib/coach/types.ts`
- Modify: `src/lib/coach/fromWorkout.ts`
- Modify: `src/lib/coach/evaluate.ts`
- Modify: `src/lib/coach/evaluate.test.ts`
- Modify: `src/data/repositories/coachRecommendations.ts`
- Modify: `src/data/repositories/coachRecommendations.test.ts`
- Modify: `src/data/repositories/coachEvaluate.ts`
- Modify: `src/data/repositories/coachEvaluate.test.ts`
- Modify: `src/data/repositories/programLifecycle.ts`
- Modify: `src/data/repositories/programs.test.ts`
- Modify: `src/data/repositories/routineVersions.ts`
- Modify: `src/data/repositories/routines.test.ts`
- Modify: `src/features/workout/coachCopy.ts`
- Modify: `src/features/workout/coachCopy.test.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: `supersedePendingLoadRecommendations(exerciseIds, resolvedAt?)`.
- Consumes: `Workout.programId`, `Workout.programIsDeload`.

- [ ] **Step 1: Write failing supersession tests**

Only pending rows with `nextLoadKg` become `superseded`; observations stay pending; identical later proposals remain recordable because supersession is not dismissal.

- [ ] **Step 2: Write program Coach tests**

For a programmed workout, assert `range_completed`, `range_missed`, and `plateau` are absent, while `intra_session_drop` and correlated `long_rest` may remain. Assert `programIsDeload: 1` is a deload without `deloadPercent: 80`.

- [ ] **Step 3: Verify failure**

```bash
npm run test:run -- src/data/repositories/coachRecommendations.test.ts src/data/repositories/coachEvaluate.test.ts src/lib/coach/evaluate.test.ts src/features/workout/coachCopy.test.ts
```

- [ ] **Step 4: Extend Coach input**

```ts
function isDeloadLine(line: CoachExerciseLine): boolean {
  return line.programIsDeload === 1 ||
    (typeof line.deloadPercent === 'number' &&
      line.deloadPercent > 0 &&
      line.deloadPercent < 100);
}
```

Project `programId` and `programIsDeload` through `coachLineFromSource`.

- [ ] **Step 5: Filter program-owned signals**

At the repository boundary:

```ts
const PROGRAM_ALLOWED_CODES = new Set<CoachSignalCode>([
  'intra_session_drop',
  'long_rest',
]);

return detail.workout.programId === undefined
  ? signals
  : signals.filter((signal) => PROGRAM_ALLOWED_CODES.has(signal.code));
```

- [ ] **Step 6: Add superseded copy**

Add `coach.statusSuperseded: 'Remplacée par le programme'` and keep `sameProposal` restricted to user-dismissed rows.

- [ ] **Step 7: Supersede at the two ownership boundaries**

During `activateProgram`, resolve every exercise used by the first schedule and supersede its pending numeric recommendations in the same transaction. During `publishRoutineVersion`, do the same for every exercise introduced by the new effective revision. Starting a workout remains a defensive filter, not the state transition.

- [ ] **Step 8: Verify and commit**

```bash
npm run test:run -- src/data/repositories/coachRecommendations.test.ts src/data/repositories/coachEvaluate.test.ts src/lib/coach/evaluate.test.ts src/features/workout/coachCopy.test.ts
npm run typecheck
git add src/lib/coach src/data/repositories/coachRecommendations.ts src/data/repositories/coachRecommendations.test.ts src/data/repositories/coachEvaluate.ts src/data/repositories/coachEvaluate.test.ts src/data/repositories/programLifecycle.ts src/data/repositories/programs.test.ts src/data/repositories/routineVersions.ts src/data/repositories/routines.test.ts src/features/workout/coachCopy.ts src/features/workout/coachCopy.test.ts src/i18n/fr.ts
git commit -m "feat(lot-17): give programs authority over coach"
```

### Task 8: Start programmed workouts atomically

**Files:**
- Create: `src/data/repositories/programWorkout.ts`
- Create: `src/data/repositories/programWorkout.test.ts`
- Modify: `src/data/repositories/workoutLifecycle.ts`
- Modify: `src/data/repositories/workouts.ts`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutRpeField.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces:

```ts
startWorkoutFromProgram(input: {
  programId: string;
  programScheduleEntryId: string;
  at?: number;
}): Promise<{
  workout: Workout;
  warnings: ProgramPrescriptionWarning[];
}>
```

- [ ] **Step 1: Write failing integration tests**

Cover correct week/revision/routine, %1RM targets, RPE target versus performed RPE, warm-up preservation, missing-record warning, program context, programmed deload, active-workout collision, and immutability after routine editing.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/data/repositories/programWorkout.test.ts`

- [ ] **Step 3: Extract the existing workout entity builder**

Refactor `startWorkoutFromRoutine` to call a shared builder receiving routine detail, workout fields, and optional projected targets. Preserve all existing behavior and tests.

- [ ] **Step 4: Implement programmed start**

At click time, recalculate position, resolve the exact entry, load current `best_1rm` records, project targets, set program context, and insert workout/exercises/sets transactionally. Numeric Coach objectives should already be superseded; the live screen still filters them as defence in depth.

- [ ] **Step 5: Render live prescription**

Show a quiet program card above exercises and pass `targetRpe` to `WorkoutRpeField` as read-only guidance. Filter numeric pending Coach cards as defence in depth.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:run -- src/data/repositories/programWorkout.test.ts src/data/repositories/workouts.test.ts src/features/workout/WorkoutScreen.integration.test.tsx
npm run typecheck
git add src/data/repositories/programWorkout.ts src/data/repositories/programWorkout.test.ts src/data/repositories/workoutLifecycle.ts src/data/repositories/workouts.ts src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutRpeField.tsx src/i18n/fr.ts
git commit -m "feat(lot-17): start programmed workouts"
```
### Task 9: Build the three-step program editor

**Files:**
- Create: `src/features/programs/ProgramEditorScreen.tsx`
- Create: `src/features/programs/ProgramBasicsStep.tsx`
- Create: `src/features/programs/ProgramSplitStep.tsx`
- Create: `src/features/programs/ProgramWeeksStep.tsx`
- Create: `src/features/programs/ProgramFlow.integration.test.tsx`
- Modify: `src/router.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: Task 5 repository APIs.
- Produces: `/programs/new` and `/programs/:id/edit`.

- [ ] **Step 1: Invoke the frontend-design skill**

Apply the established FitTrack language: reading-first hierarchy, one sticky action, quiet surfaces, no generic dashboard grid, no nested rounded cards, and ≥48 px controls.

- [ ] **Step 2: Write the failing creation-flow test**

Create an eight-week draft, select Monday/Thursday routines, mark week 5 as deload, activate, and assert navigation to `/programs/:id`.

- [ ] **Step 3: Verify failure**

Run: `npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx`

- [ ] **Step 4: Implement the editor state**

```ts
type ProgramEditorStep = 'basics' | 'split' | 'weeks';

interface ProgramBasicsDraft {
  name: string;
  startsAt: number;
  durationWeeks: number;
}

interface ProgramSplitDraftEntry {
  routineId: string;
  dayOfWeek: number;
  order: number;
}
```

Persist each completed step. Footer reads `Continuer` then `Activer le bloc`. Back moves between steps before leaving.

- [ ] **Step 5: Implement compact week editing**

One Card contains week rows. Each row displays week number, prescription, and a textual `Décharge` mark. A sheet edits kind, value, and deload state.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx
npm run typecheck
git add src/features/programs src/router.tsx src/i18n/fr.ts
git commit -m "feat(lot-17): create multi-week programs"
```

### Task 10: Build program list, current block, and actions

**Files:**
- Create: `src/features/programs/ProgramListScreen.tsx`
- Create: `src/features/programs/ProgramDetailScreen.tsx`
- Create: `src/features/programs/ProgramSessionList.tsx`
- Create: `src/features/programs/ProgramActionsSheet.tsx`
- Modify: `src/features/programs/ProgramFlow.integration.test.tsx`
- Modify: `src/router.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: list/detail/start/shift/complete APIs.
- Produces: `/programs` and `/programs/:id`.

- [ ] **Step 1: Extend the integration test**

Assert current week, today/missed/upcoming states, start disabled during an active workout, shift confirmation, completion confirmation, and draft/active/completed labels.

- [ ] **Step 2: Verify failure**

Run: `npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx`

- [ ] **Step 3: Implement the detail hierarchy**

```tsx
<ProgramProgressReading />
<CurrentPrescription />
<ProgramSessionList />
<UpcomingWeeks />
```

Only session start is primary. Shift, future edit, and completion live in `ProgramActionsSheet`.

- [ ] **Step 4: Implement guards**

Shift uses whole civil days and warns after the block starts. Completion keeps all data. A missing routine blocks only its row and links to repair.

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx
npm run typecheck
git add src/features/programs src/router.tsx src/i18n/fr.ts
git commit -m "feat(lot-17): follow the current block"
```

### Task 11: Prioritize programs on Home and expose effective versions

**Files:**
- Create: `src/features/home/HomeProgramCard.tsx`
- Create: `src/features/home/HomeProgramCard.test.tsx`
- Modify: `src/data/repositories/home.ts`
- Modify: `src/data/repositories/home.test.ts`
- Modify: `src/features/home/useHomeDashboard.ts`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/routines/RoutineEditorScreen.tsx`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Extends `HomeDashboardData` with `activeProgram`.
- Consumes: precomputed program suggestion and routine version APIs.

- [ ] **Step 1: Write failing Home tests**

An active in-date program replaces generic suggestion; completed blocks do not; a future block announces its date without starting early; a broken program row does not break history or regularity.

- [ ] **Step 2: Write routine-version UI tests**

Routines exposes `Programmes`; a sealed routine is read-only; `Créer une version` opens an editable draft; publication asks for an effective week.

- [ ] **Step 3: Verify failure**

```bash
npm run test:run -- src/data/repositories/home.test.ts src/features/home/HomeProgramCard.test.tsx src/features/routines/RoutineFlow.integration.test.tsx
```

- [ ] **Step 4: Wire Home**

`getHomeDashboard` returns a ready-made program pick. `HomeProgramCard` never ranks sessions; it starts the exact persisted entry. Fall back to the existing generic card when no active program projection exists.

- [ ] **Step 5: Add the Routines entry**

Place a full-width `ListRow` above routine folders. Its hint is the current week or `Aucun bloc actif`.

- [ ] **Step 6: Implement sealed and draft states**

Referenced published routines render readings plus `Créer une version`. Draft versions keep the current write-through editor and replace `Démarrer` with `Utiliser à partir de la semaine N`.

- [ ] **Step 7: Verify and commit**

```bash
npm run test:run -- src/data/repositories/home.test.ts src/features/home/HomeProgramCard.test.tsx src/features/routines/RoutineFlow.integration.test.tsx src/features/routines/RoutineCollection.test.tsx
npm run typecheck
git add src/features/home src/data/repositories/home.ts src/data/repositories/home.test.ts src/features/routines/RoutinesScreen.tsx src/features/routines/RoutineEditorScreen.tsx src/features/routines/RoutineFlow.integration.test.tsx src/i18n/fr.ts
git commit -m "feat(lot-17): surface programs across the app"
```

### Task 12: Verify the whole path and record the checkpoint

**Files:**
- Modify: `PROGRESS.md`
- Modify only on discovered defects: files owned by Tasks 1–11

- [ ] **Step 1: Run focused whole-path tests**

```bash
npm run test:run -- src/lib/programs src/data/repositories/programs.test.ts src/data/repositories/programWorkout.test.ts src/data/repositories/routines.test.ts src/data/repositories/coachEvaluate.test.ts src/data/repositories/coachRecommendations.test.ts src/features/programs/ProgramFlow.integration.test.tsx src/features/home/HomeProgramCard.test.tsx src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run every project gate**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: zero lint/type errors, every test passing, successful PWA build.

- [ ] **Step 3: Inspect 375 px paths**

Check creation, current block, Home card, sealed routine, and live programmed workout. Confirm no horizontal overflow, ≥48 px targets, and no content hidden by ActionBand or bottom navigation.

- [ ] **Step 4: Update progress memory**

Add:

```markdown
**Dernière mise à jour :** 2026-08-13 (**Lot 17 — périodisation et programmes multi-semaines**).

Livré : blocs de 4 à 12 semaines, split hebdomadaire versionné, prescriptions %1RM ou RPE,
décharges planifiées, démarrage depuis l’accueil et autorité explicite face au Coach du Lot 18.

Checkpoint téléphone restant : bloc de 8 semaines, décharge semaine 5, version effective d’une
routine, décalage du bloc et reprise complète en mode avion.
```

Set Lot 17 to `🟨 en cours` until the user validates the phone checkpoint.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(lot-17): record periodization checkpoint"
```

- [ ] **Step 6: Announce the phone checkpoint**

Ask the user to create an eight-week block, mark week 5 as deload, verify today’s target, finish one programmed workout, publish a future routine version, confirm past data stayed unchanged, shift the block, and reopen in airplane mode.
