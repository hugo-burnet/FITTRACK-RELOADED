# Workout Persistence Integration Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that values entered in the live workout survive a complete React remount and that
set completion is persisted immediately.

**Architecture:** Add one integration test at the `WorkoutScreen` interface. The test uses the
real React tree, React Router, repositories, Dexie and fake IndexedDB; it observes the UI and
repository results without mocking the persistence path. A temporary manual mutant proves the
test detects a disconnected write path.

**Tech Stack:** React 19, TypeScript strict, Vitest, Testing Library, React Router,
Dexie, fake-indexeddb, Zustand

## Global Constraints

- Preserve all current UI, repository, schema and data behaviour.
- Do not add dependencies or production interfaces.
- Do not mock Dexie, `useLiveQuery` or repositories.
- Use `resetDb` before every test that touches IndexedDB.
- Stop the singleton rest timer before and after the scenario.
- Use `waitFor` on asynchronous persistence; never add fixed sleeps.
- Keep all UI text in `src/i18n/fr.ts`; this test only consumes existing accessible labels.
- The final diff must not contain the temporary mutant.

---

### Task 1: Protect live workout persistence across a React remount

**Files:**
- Create: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Temporarily mutate, then restore: `src/features/workout/WorkoutScreen.tsx`
- Modify after verification: `PROGRESS.md`

**Interfaces:**
- Consumes: `createCustomExercise(data)`, `createRoutine(name)`,
  `addExercisesToRoutine(routineId, exerciseIds)`,
  `startWorkoutFromRoutine(routineId)`, `getWorkoutDetail(workoutId)`,
  `WorkoutScreen`, `useRestTimer.getState().stop()`
- Produces: one integration scenario named
  `persiste la saisie et la validation après un remontage complet`

- [ ] **Step 1: Confirm the clean behavioural baseline**

Run:

```powershell
npm.cmd run test:run
```

Expected: 58 test files and 775 tests pass before the new test exists.

- [ ] **Step 2: Create the integration test**

Create `src/features/workout/WorkoutScreen.integration.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import {
  addExercisesToRoutine,
  createRoutine,
} from '@/data/repositories/routines';
import {
  getWorkoutDetail,
  startWorkoutFromRoutine,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { useRestTimer } from '@/stores/restTimer';
import { resetDb } from '@/test/resetDb';
import { WorkoutScreen } from './WorkoutScreen';

async function seedActiveWorkout(): Promise<string> {
  const exercise = await createCustomExercise({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Poussée');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  return (await startWorkoutFromRoutine(routine.id)).id;
}

async function firstSet(workoutId: string): Promise<WorkoutSet> {
  const detail = await getWorkoutDetail(workoutId);
  const line = detail?.exercises[0];
  const set = line?.sets[0];
  if (set === undefined) throw new Error('série de séance absente');
  return set;
}

function renderWorkout() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/workout" element={<WorkoutScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('WorkoutScreen — persistance', () => {
  beforeEach(async () => {
    useRestTimer.getState().stop();
    await resetDb();
  });

  afterEach(() => useRestTimer.getState().stop());

  it('persiste la saisie et la validation après un remontage complet', async () => {
    const workoutId = await seedActiveWorkout();
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — kg' }), '80');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — reps' }), '10');

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({
        weight: 80,
        reps: 10,
        isCompleted: 0,
        performedAt: 0,
      });
    });

    mounted.unmount();
    renderWorkout();

    expect(await screen.findByRole('textbox', { name: 'Série 1 — kg' })).toHaveValue('80');
    expect(screen.getByRole('textbox', { name: 'Série 1 — reps' })).toHaveValue('10');

    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      const persisted = await firstSet(workoutId);
      expect(persisted).toMatchObject({ weight: 80, reps: 10, isCompleted: 1 });
      expect(persisted.performedAt).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 3: Run the new characterization test**

Run:

```powershell
npm.cmd run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx
```

Expected: one test passes with no React warning. Because this is existing behaviour, sensitivity
is established by the manual mutant in the next step rather than by inventing new production
behaviour.

- [ ] **Step 4: Kill a manual write-path mutant**

Temporarily replace this prop in `WorkoutScreen.tsx`:

```tsx
onWrite={(setId, values) => void updateSetValues(setId, values)}
```

with:

```tsx
onWrite={() => undefined}
```

Run:

```powershell
npm.cmd run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx
```

Expected: FAIL while waiting for Dexie to contain `weight: 80` and `reps: 10`.

Restore the original `onWrite` line with `apply_patch`. Do not use a destructive Git command and
do not retain the mutant.

- [ ] **Step 5: Confirm the restored path is green**

Run:

```powershell
npm.cmd run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx
git diff -- src/features/workout/WorkoutScreen.tsx
```

Expected: one test passes; the production file has no diff.

- [ ] **Step 6: Run every project gate**

Run each command and read its complete result:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: lint, typecheck, all 59 test files with 776 tests, build and whitespace validation pass.

- [ ] **Step 7: Record the tranche**

Prepend an entry to `PROGRESS.md` that records:

- the live-workout persistence scenario;
- the real layers crossed by the test;
- the killed `onWrite` mutant;
- the fresh gate counts;
- no production, schema, data, dependency or UI change;
- the next phase-6 slice: compose a complete routine through its three screens.

- [ ] **Step 8: Inspect and commit the proof**

Run:

```powershell
git status --short
git diff -- src/features/workout/WorkoutScreen.integration.test.tsx PROGRESS.md
git diff --check
```

Confirm the only uncommitted files are the new integration test and `PROGRESS.md`, then commit:

```powershell
git add src/features/workout/WorkoutScreen.integration.test.tsx PROGRESS.md
git commit -m "test: protège la reprise d’une séance en cours"
```
