# Workout Deload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idempotent live-workout header action that reduces every remaining displayed load to 80%, rounds it to 2.5 kg, and records the deload in the exported workout notes.

**Architecture:** A pure `lib/` function owns the fixed percentage and rounding rule. A dedicated repository performs the set updates, note append, and workout marker in one Dexie transaction; a small confirmation sheet keeps async/error state out of the already-large workout screen. The existing live query and export note pipeline provide persistence and export without parallel state or export code.

**Tech Stack:** React 19, TypeScript strict, Dexie/IndexedDB, `dexie-react-hooks`, Vitest, Testing Library, Tailwind CSS v4.

## Global Constraints

- Apply exactly 80% and round to the nearest 2.5 kg.
- Modify only live, uncompleted sets; completed sets and non-weight fields never change.
- Resolve the source as `weight`, then `targetWeight`, then the previous workout's same displayed set rank.
- Apply only where the live grid has a load/added-load column; exclude timed/distance-only work and assisted-machine weight, where a lower number would make the set harder.
- Persist `Workout.deloadPercent = 80`; applying the action again must be a no-op.
- Append `Deload — charges réduites à 80 %.` without replacing existing workout notes.
- Keep every UI string in `src/i18n/fr.ts`; code, identifiers, and comments remain English.
- Access IndexedDB only through `src/data/repositories/*`; the feature remains fully offline.
- Keep the header target at least 48 px and preserve the current mobile-first layout.
- Do not add a Dexie schema migration: `deloadPercent` is not indexed.

---

## File Map

- Create `src/lib/deload.ts`: fixed deload constants and pure weight calculation.
- Create `src/lib/deload.test.ts`: calculation and rounding contract.
- Modify `src/data/types.ts`: optional persisted marker on `Workout`.
- Create `src/data/repositories/workoutDeload.ts`: atomic, idempotent application to a workout.
- Create `src/data/repositories/workoutDeload.test.ts`: source priority, exclusions, atomicity, persistence, and export integration.
- Modify `src/data/repositories/workouts.ts`: public repository export.
- Create `src/features/workout/DeloadSheet.tsx`: async confirmation and retryable write error.
- Create `src/features/workout/DeloadSheet.test.tsx`: confirmation success/failure behavior.
- Modify `src/features/workout/WorkoutScreen.tsx`: header action, eligibility, persisted active state, and sheet wiring.
- Modify `src/features/workout/WorkoutScreen.integration.test.tsx`: live UI application and remount persistence.
- Modify `src/ui/HeaderAction.tsx`: optional pressed/disabled semantics used by the new action.
- Modify `src/i18n/fr.ts`: French labels, explanation, note, and error copy.
- Modify `PROGRESS.md`: record the delivered feature and phone checkpoint.

---

### Task 1: Pure deload calculation and persisted marker

**Files:**
- Create: `src/lib/deload.test.ts`
- Create: `src/lib/deload.ts`
- Modify: `src/data/types.ts` (`Workout` interface)

**Interfaces:**
- Produces: `DELOAD_PERCENT = 80`, `DELOAD_INCREMENT_KG = 2.5`, and `calculateDeloadWeight(weightKg: number): number`.
- Produces: `Workout.deloadPercent?: number` for repository and UI consumers.

- [ ] **Step 1: Write the failing calculation tests**

Create `src/lib/deload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { calculateDeloadWeight } from './deload';

describe('calculateDeloadWeight', () => {
  it.each([
    [100, 80],
    [82.5, 65],
    [102.5, 82.5],
    [60, 47.5],
  ])('reduces %s kg to %s kg', (weightKg, expected) => {
    expect(calculateDeloadWeight(weightKg)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npm run test:run -- src/lib/deload.test.ts`

Expected: FAIL because `./deload` does not exist.

- [ ] **Step 3: Implement the fixed calculation and add the optional marker**

Create `src/lib/deload.ts`:

```ts
export const DELOAD_PERCENT = 80;
export const DELOAD_INCREMENT_KG = 2.5;

export function calculateDeloadWeight(weightKg: number): number {
  const reduced = weightKg * (DELOAD_PERCENT / 100);
  const rounded = Math.round(reduced / DELOAD_INCREMENT_KG) * DELOAD_INCREMENT_KG;
  return Number(rounded.toFixed(10));
}
```

Add this non-indexed field beside `Workout.notes` in `src/data/types.ts`:

```ts
  notes?: string;
  /** Applied once to remaining live-workout loads; absent when no deload was applied. */
  deloadPercent?: number;
```

- [ ] **Step 4: Run the focused test and typecheck**

Run: `npm run test:run -- src/lib/deload.test.ts`

Expected: PASS, 4 cases.

Run: `npm run typecheck`

Expected: exit 0.

- [ ] **Step 5: Commit the pure contract**

```bash
git add src/lib/deload.ts src/lib/deload.test.ts src/data/types.ts
git commit -m "feat(workout): add deload weight calculation"
```

---

### Task 2: Atomic workout deload repository and export trace

**Files:**
- Create: `src/data/repositories/workoutDeload.test.ts`
- Create: `src/data/repositories/workoutDeload.ts`
- Modify: `src/data/repositories/workouts.ts`

**Interfaces:**
- Consumes: `calculateDeloadWeight(weightKg: number): number` and `DELOAD_PERCENT` from Task 1.
- Produces: `applyWorkoutDeload(workoutId: string, note: string): Promise<Workout | null>`; the updated workout lets the screen synchronize its notes draft, while `null` means absent/inactive/already marked or no applicable load.

- [ ] **Step 1: Write failing repository tests for all source and safety rules**

Create `src/data/repositories/workoutDeload.test.ts` with these imports and helpers:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { listHistoricalWorkouts } from './historicalWorkouts';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import { createCustomExercise } from './exercises';
import {
  addSet,
  addWorkoutExercise,
  applyWorkoutDeload,
  completeSet,
  finishWorkout,
  getWorkoutDetail,
  startWorkout,
} from './workouts';

const NOTE = 'Deload — charges réduites à 80 %.';

async function liveSet(workoutId: string, exerciseId = 'bench') {
  const row = await addWorkoutExercise(workoutId, exerciseId);
  const detail = await getWorkoutDetail(workoutId);
  const set = detail?.exercises.find((line) => line.row.id === row.id)?.sets[0];
  if (set === undefined) throw new Error('missing live set');
  return { row, set };
}
```

Add exact tests covering:

```ts
describe('applyWorkoutDeload', () => {
  beforeEach(resetDb);

  it('uses typed, target, then previous loads and leaves completed sets intact', async () => {
    await seedWorkout({
      exerciseId: 'bench',
      performedAt: Date.now() - 86_400_000,
      sets: [[50, 5], [60, 5], [70, 5], [80, 5]],
    });
    const workout = await startWorkout('', 'Poussée');
    const { row, set: first } = await liveSet(workout.id);
    await db.workoutSets.update(first.id, { weight: 110, targetWeight: 120 });
    await completeSet(first.id, { weight: 110, reps: 5 });
    const typed = await addSet(row.id, { weight: 90, targetWeight: 100 });
    const targeted = await addSet(row.id, { targetWeight: 82.5 });
    const previousOnly = await addSet(row.id);

    await expect(applyWorkoutDeload(workout.id, NOTE)).resolves.toMatchObject({
      deloadPercent: 80,
      notes: NOTE,
    });

    expect((await db.workoutSets.get(first.id))?.weight).toBe(110);
    expect((await db.workoutSets.get(typed.id))?.weight).toBe(72.5);
    expect((await db.workoutSets.get(targeted.id))?.targetWeight).toBe(65);
    expect((await db.workoutSets.get(previousOnly.id))?.targetWeight).toBe(65);
    expect(await db.workouts.get(workout.id)).toMatchObject({
      deloadPercent: 80,
      notes: NOTE,
    });
  });

  it('appends the note once and cannot reduce the workout twice', async () => {
    const workout = await startWorkout('', 'Poussée');
    await db.workouts.update(workout.id, { notes: 'Épaule sensible.' });
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100 });

    expect(await applyWorkoutDeload(workout.id, NOTE)).not.toBeNull();
    expect(await applyWorkoutDeload(workout.id, NOTE)).toBeNull();

    expect(await db.workouts.get(workout.id)).toMatchObject({
      deloadPercent: 80,
      notes: `Épaule sensible.\n\n${NOTE}`,
    });
    expect((await db.workoutSets.get(set.id))?.targetWeight).toBe(80);
  });

  it('does not touch hidden or assisted weights', async () => {
    const timed = await createCustomExercise({
      name: 'Planche',
      primaryMuscle: 'abs',
      secondaryMuscles: [],
      equipment: 'bodyweight',
      measurementType: 'time_only',
      isUnilateral: 0,
    });
    const assisted = await createCustomExercise({
      name: 'Tractions assistées',
      primaryMuscle: 'lats',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'assisted_weight_reps',
      isUnilateral: 0,
    });
    const workout = await startWorkout('', 'Technique');
    const timedSet = (await liveSet(workout.id, timed.id)).set;
    const assistedSet = (await liveSet(workout.id, assisted.id)).set;
    await db.workoutSets.update(timedSet.id, { targetWeight: 100 });
    await db.workoutSets.update(assistedSet.id, { targetWeight: 40 });

    expect(await applyWorkoutDeload(workout.id, NOTE)).toBeNull();
    expect((await db.workouts.get(workout.id))?.deloadPercent).toBeUndefined();
    expect((await db.workoutSets.get(timedSet.id))?.targetWeight).toBe(100);
    expect((await db.workoutSets.get(assistedSet.id))?.targetWeight).toBe(40);
  });

  it('rolls every write back when the workout update fails', async () => {
    const workout = await startWorkout('', 'Poussée');
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100 });
    vi.spyOn(db.workouts, 'put').mockRejectedValueOnce(new Error('write failed'));

    await expect(applyWorkoutDeload(workout.id, NOTE)).rejects.toThrow('write failed');
    expect((await db.workoutSets.get(set.id))?.targetWeight).toBe(100);
    expect((await db.workouts.get(workout.id))?.deloadPercent).toBeUndefined();
  });

  it('carries the automatic note through the real Markdown export pipeline', async () => {
    const workout = await startWorkout('', 'Poussée');
    const { set } = await liveSet(workout.id);
    await db.workoutSets.update(set.id, { targetWeight: 100, targetReps: 5 });
    await applyWorkoutDeload(workout.id, NOTE);
    await completeSet(set.id, { weight: 80, reps: 5 });
    await finishWorkout(workout.id);

    const scope = { kind: 'workout', workoutId: workout.id } as const;
    const source = await listHistoricalWorkouts(scope);
    const markdown = serializeMarkdown(
      projectCoachExport(scope, source, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );

    expect(markdown).toContain(NOTE);
  });
});
```

- [ ] **Step 2: Run the repository test and verify the red state**

Run: `npm run test:run -- src/data/repositories/workoutDeload.test.ts`

Expected: FAIL because `applyWorkoutDeload` is not exported.

- [ ] **Step 3: Implement the transaction and public export**

Create `src/data/repositories/workoutDeload.ts`:

```ts
import { db } from '@/data/db';
import type { Workout, WorkoutSet } from '@/data/types';
import { calculateDeloadWeight, DELOAD_PERCENT } from '@/lib/deload';
import { measurementShape } from '@/lib/measurement';
import { alive, touch } from './base';
import { getLastPerformance } from './workoutHistory';

const byOrder = (left: WorkoutSet, right: WorkoutSet): number => left.order - right.order;

function appendNote(notes: string | undefined, note: string): string | undefined {
  const current = notes?.trim();
  const addition = note.trim();
  if (addition === '') return current;
  if (current?.includes(addition)) return current;
  return current === undefined || current === '' ? addition : `${current}\n\n${addition}`;
}

export async function applyWorkoutDeload(
  workoutId: string,
  note: string,
): Promise<Workout | null> {
  return db.transaction(
    'rw',
    db.workouts,
    db.workoutExercises,
    db.workoutSets,
    db.exercises,
    async () => {
      const workout = await db.workouts.get(workoutId);
      if (
        workout === undefined ||
        workout.deletedAt !== 0 ||
        workout.status !== 'active' ||
        workout.deloadPercent !== undefined
      ) {
        return null;
      }

      const rows = alive(
        await db.workoutExercises.where('workoutId').equals(workoutId).toArray(),
      );
      const found = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
      const library = new Map(
        found
          .filter((exercise) => exercise !== undefined)
          .map((exercise) => [exercise.id, exercise]),
      );
      const eligibleRows = new Set(
        rows.flatMap((row) => {
          const type = library.get(row.exerciseId)?.measurementType ?? 'weight_reps';
          const role = measurementShape(type).weightRole;
          return role !== undefined && role !== 'assist' ? [row.id] : [];
        }),
      );
      const live = alive(
        await db.workoutSets.where('workoutId').equals(workoutId).toArray(),
      ).filter((set) => eligibleRows.has(set.workoutExerciseId));
      const blocks = new Map<string, WorkoutSet[]>();
      for (const set of live) {
        const block = blocks.get(set.workoutExerciseId);
        if (block === undefined) blocks.set(set.workoutExerciseId, [set]);
        else block.push(set);
      }

      const exerciseIds = [...new Set(live.map((set) => set.exerciseId))];
      const previous = new Map(
        await Promise.all(
          exerciseIds.map(async (exerciseId) => [
            exerciseId,
            await getLastPerformance(exerciseId, workoutId),
          ] as const),
        ),
      );

      const changed: WorkoutSet[] = [];
      for (const sets of blocks.values()) {
        sets.sort(byOrder);
        sets.forEach((set, index) => {
          if (set.isCompleted === 1) return;
          const source =
            set.weight ?? set.targetWeight ?? previous.get(set.exerciseId)?.[index]?.weight;
          if (source === undefined) return;
          const reduced = calculateDeloadWeight(source);
          changed.push(
            set.weight === undefined
              ? touch(set, { targetWeight: reduced })
              : touch(set, { weight: reduced }),
          );
        });
      }

      if (changed.length === 0) return null;

      await db.workoutSets.bulkPut(changed);
      const updated = touch(workout, {
        deloadPercent: DELOAD_PERCENT,
        notes: appendNote(workout.notes, note),
      });
      await db.workouts.put(updated);
      return updated;
    },
  );
}
```

Add this export to `src/data/repositories/workouts.ts`:

```ts
export { applyWorkoutDeload } from './workoutDeload';
```

- [ ] **Step 4: Run repository tests, then the existing workout repository suite**

Run: `npm run test:run -- src/data/repositories/workoutDeload.test.ts`

Expected: PASS, 5 tests.

Run: `npm run test:run -- src/data/repositories/workouts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the atomic repository behavior**

```bash
git add src/data/repositories/workoutDeload.ts src/data/repositories/workoutDeload.test.ts src/data/repositories/workouts.ts
git commit -m "feat(workout): apply deload atomically"
```

---

### Task 3: Header action and retryable confirmation

**Files:**
- Create: `src/features/workout/DeloadSheet.test.tsx`
- Create: `src/features/workout/DeloadSheet.tsx`
- Modify: `src/ui/HeaderAction.tsx`
- Modify: `src/i18n/fr.ts` (`workout` section)
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`

**Interfaces:**
- Consumes: `applyWorkoutDeload(workoutId, note): Promise<Workout | null>` and `Workout.deloadPercent` from Task 2.
- Produces: `DeloadSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: () => Promise<unknown> })`.
- Extends: `HeaderAction` with optional `pressed?: boolean` and `disabled?: boolean` props.

- [ ] **Step 1: Write the failing sheet behavior tests**

Create `src/features/workout/DeloadSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeloadSheet } from './DeloadSheet';

describe('DeloadSheet', () => {
  it('applies and closes after a successful write', async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('stays open and offers retry when IndexedDB rejects the write', async () => {
    const onApply = vi.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    const onClose = vi.fn();
    render(<DeloadSheet open onClose={onClose} onApply={onApply} />);

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le deload n’a pas pu être appliqué. Réessaie.',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Add the failing workout-screen integration test**

In `src/features/workout/WorkoutScreen.integration.test.tsx`, import `db`, then add:

```tsx
it('applique le deload depuis le header et garde son état après remontage', async () => {
  const workoutId = await seedActiveWorkout();
  const initial = await firstSet(workoutId);
  await db.workoutSets.update(initial.id, { targetWeight: 100, targetReps: 5 });
  const user = userEvent.setup();
  const mounted = renderWorkout();

  await screen.findByText('Développé couché');
  await user.click(screen.getByRole('button', { name: 'Activer le deload à 80 %' }));
  expect(screen.getByText('Les séries restantes passeront à 80 %, arrondies à 2,5 kg.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Appliquer' }));

  await waitFor(() => {
    expect(screen.getByRole('textbox', { name: 'Série 1 — kg' })).toHaveAttribute(
      'placeholder',
      '80',
    );
  });
  expect(screen.getByRole('button', { name: 'Deload actif à 80 %' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Options de la séance' }));
  await user.click(screen.getByRole('button', { name: 'Notes de la séance' }));
  expect(screen.getByRole('textbox', { name: 'Notes de la séance' })).toHaveValue(
    'Deload — charges réduites à 80 %.',
  );

  mounted.unmount();
  renderWorkout();
  expect(await screen.findByRole('button', { name: 'Deload actif à 80 %' })).toBeDisabled();
});
```

- [ ] **Step 3: Run both focused tests and verify the red state**

Run: `npm run test:run -- src/features/workout/DeloadSheet.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx`

Expected: FAIL because `DeloadSheet` and the header action do not exist.

- [ ] **Step 4: Add all French copy**

Add these keys inside `fr.workout` in `src/i18n/fr.ts`:

```ts
    deloadAction: 'Activer le deload à 80 %',
    deloadActive: 'Deload actif à 80 %',
    deloadTitle: 'Deload à 80 %',
    deloadBody: 'Les séries restantes passeront à 80 %, arrondies à 2,5 kg.',
    deloadConfirm: 'Appliquer',
    deloadNote: 'Deload — charges réduites à 80 %.',
    deloadError: 'Le deload n’a pas pu être appliqué. Réessaie.',
```

- [ ] **Step 5: Implement the async confirmation sheet**

Create `src/features/workout/DeloadSheet.tsx`:

```tsx
import { useState } from 'react';
import { t } from '@/i18n/fr';
import { Button, Sheet } from '@/ui';

export function DeloadSheet({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => Promise<unknown>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFailed(false);
  }

  const apply = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await onApply();
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.deloadTitle')}>
      <p className="mb-6 text-base leading-relaxed text-[var(--text-2)]">
        {t('workout.deloadBody')}
      </p>
      {failed && (
        <p role="alert" className="mb-4 text-sm text-[var(--danger-ink)]">
          {t('workout.deloadError')}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} fullWidth>
          {t('exercise.cancel')}
        </Button>
        <Button size="lg" disabled={submitting} onClick={() => void apply()} fullWidth>
          {t('workout.deloadConfirm')}
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 6: Extend the shared header action semantics**

Change `HeaderAction`'s props and button attributes in `src/ui/HeaderAction.tsx`:

```tsx
export function HeaderAction({
  label,
  onClick,
  children,
  pressed,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`-mr-2 flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] active:bg-[var(--surface-1)] disabled:opacity-60
        ${pressed ? 'bg-[var(--surface-2)]' : ''}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 7: Wire eligibility, active state, action, and sheet into `WorkoutScreen`**

In `src/features/workout/WorkoutScreen.tsx`:

```tsx
// Add to the repository import:
applyWorkoutDeload,

// Add the component import:
import { DeloadSheet } from './DeloadSheet';

// Add the measurement helper import:
import { measurementShape } from '@/lib/measurement';

// Add to SheetState:
| { kind: 'deload' }

// Immediately after `const { workout, exercises } = detail;`:
const deloadActive = workout.deloadPercent === 80;
const canDeload = exercises.some((line) =>
  (() => {
    const role = measurementShape(line.exercise?.measurementType ?? 'weight_reps').weightRole;
    return (
      role !== undefined &&
      role !== 'assist' &&
      line.sets.some(
        (set, index) =>
          set.isCompleted === 0 &&
          (set.weight ?? set.targetWeight ?? line.previous[index]?.weight) !== undefined,
      )
    );
  })(),
);
```

Insert this action before `ElapsedTime` in the header action row:

```tsx
<HeaderAction
  label={t(deloadActive ? 'workout.deloadActive' : 'workout.deloadAction')}
  pressed={deloadActive}
  disabled={deloadActive || !canDeload}
  onClick={() => setSheet({ kind: 'deload' })}
>
  <span className="metric text-xs font-bold" aria-hidden="true">80%</span>
</HeaderAction>
```

Render this sheet beside the other workout-level sheets:

```tsx
<DeloadSheet
  open={sheet?.kind === 'deload'}
  onClose={() => setSheet(null)}
  onApply={async () => {
    const updated = await applyWorkoutDeload(workout.id, t('workout.deloadNote'));
    if (updated !== null) {
      setDraft({ id: updated.id, name: updated.name, notes: updated.notes ?? '' });
    }
  }}
/>
```

- [ ] **Step 8: Run focused UI tests and lint the touched UI**

Run: `npm run test:run -- src/features/workout/DeloadSheet.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx`

Expected: PASS.

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 9: Commit the live-workout UI**

```bash
git add src/features/workout/DeloadSheet.tsx src/features/workout/DeloadSheet.test.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/ui/HeaderAction.tsx src/i18n/fr.ts
git commit -m "feat(workout): add deload header action"
```

---

### Task 4: Full verification and session record

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: the completed feature and its automated evidence.
- Produces: a reproducible project checkpoint and clean committed worktree.

- [ ] **Step 1: Run every required quality gate**

Run each command separately:

```bash
npm run typecheck
npm run test:run
npm run build
npm run lint
```

Expected: all four commands exit 0; no test failures or TypeScript errors.

- [ ] **Step 2: Update `PROGRESS.md` with the delivered behavior**

Add a dated entry stating:

```markdown
- Bouton `80%` ajouté au header de la séance en cours : confirmation, réduction des seules séries
  restantes au pas de 2,5 kg, protection contre la double application et reprise après fermeture.
- Le deload ajoute sans écraser la note `Deload — charges réduites à 80 %.` ; l'export Markdown la
  restitue par son pipeline de notes existant.
- Checkpoint téléphone : valider une première série, activer `80%`, vérifier que seules les séries
  restantes changent, tuer/reprendre l'app puis partager la séance et contrôler la note.
```

- [ ] **Step 3: Commit the session record**

```bash
git add PROGRESS.md
git commit -m "docs: consigne le bouton deload en séance"
```

- [ ] **Step 4: Confirm the final repository state**

Run: `git status --short`

Expected: no output.
