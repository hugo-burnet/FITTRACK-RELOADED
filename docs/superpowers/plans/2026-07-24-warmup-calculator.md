# RF-29 Warm-up Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user calculate an editable percentage-based warm-up ramp and atomically insert its
sets before the working sets of a live exercise.

**Architecture:** A pure `lib/warmup.ts` engine owns validation and downward rounding. A focused
workout context helper decides whether the action applies and supplies the initial/minimum load.
The existing workout repository performs one Dexie transaction for bulk insertion and
renumbering. A dedicated sheet owns only editable draft state and delegates persistence through a
callback.

**Tech Stack:** React 19, TypeScript strict, Dexie/IndexedDB, Tailwind CSS v4, Vitest,
Testing Library, `fake-indexeddb`, in-app browser control.

## Global Constraints

- Scope is RF-29 only; do not implement RF-31 or change the configurable bar weight.
- Generated rows use `setType: 'warmup'`, `targetWeight`, `targetReps`, `isCompleted: 0`,
  `performedAt: 0`, and never pre-fill performed `weight` or `reps`.
- Warm-up rows are inserted before all live existing rows in one Dexie transaction.
- No artificial limit on the number of warm-up steps or generated rows.
- Every UI string belongs in `src/i18n/fr.ts`.
- The live grid receives no new column or badge.
- Every interactive target is at least 48 px high; validate at a 375 × 812 viewport.
- The sheet uses neutral tokens only; accent remains reserved for records and completed sets.
- Preserve untracked `.agents/`, `.codex/`, and `AGENTS.md`; never stage them.
- Use TDD for `src/lib/warmup.ts`, repository ordering, and all new business rules.
- Run `typecheck`, `lint`, `test:run`, and `build` before the final feature commit.

---

## File Map

### Create

- `src/lib/warmup.ts` — pure validation, percentage calculation, and rounding.
- `src/lib/warmup.test.ts` — engine red/green coverage.
- `src/features/workout/warmupContext.ts` — eligibility, initial target, and physical minimum.
- `src/features/workout/warmupContext.test.ts` — context business rules.
- `src/features/workout/WarmupSheet.tsx` — local draft state, preview, validation feedback, and
  insertion gesture.

### Modify

- `src/data/repositories/workouts.ts` — atomic `insertWarmupSets`.
- `src/data/repositories/workouts.test.ts` — transaction, ordering, concurrency, and rollback.
- `src/features/workout/WorkoutScreen.tsx` — menu action, sheet state, and repository callback.
- `src/ui/NumberInput.tsx` — optional neutral focus tone, preserving accent as the default.
- `src/i18n/fr.ts` — all calculator copy.
- `PROGRESS.md` — RF-29 decisions, red/green evidence, browser measurements, and checkpoint.

No database schema migration is required because every generated value already exists on
`WorkoutSet`.

---

### Task 1: Pure warm-up engine

**Files:**

- Create: `src/lib/warmup.test.ts`
- Create: `src/lib/warmup.ts`

**Interfaces:**

- Consumes: numbers in kilograms and an arbitrary ordered `readonly WarmupStep[]`.
- Produces:

```ts
export const DEFAULT_WARMUP_INCREMENT_KG = 2.5;
export const DEFAULT_WARMUP_STEPS: readonly WarmupStep[];
export function calculateWarmupSets(input: WarmupInput): WarmupSetSuggestion[];
```

- [ ] **Step 1: Write the failing engine tests**

Create `src/lib/warmup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  DEFAULT_WARMUP_STEPS,
} from './warmup';

describe('calculateWarmupSets', () => {
  it('calcule la rampe par défaut', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 100,
        incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 40, reps: 10 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it('arrondit chaque charge vers le bas au pas disponible', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 102.5,
        incrementKg: 2.5,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 40, reps: 10 },
      { weightKg: 60, reps: 5 },
      { weightKg: 80, reps: 3 },
    ]);
  });

  it('garde des décimales exactes sans fantôme flottant', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 82.5,
        incrementKg: 0.5,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 33, reps: 10 },
      { weightKg: 49.5, reps: 5 },
      { weightKg: 66, reps: 3 },
    ]);
  });

  it('respecte la charge physique minimale', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 40,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 22.5, reps: 5 },
      { weightKg: 30, reps: 3 },
    ]);
  });

  it('écarte les résultats nuls ou qui atteignent la charge de travail', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 20,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([]);
  });

  it('conserve deux étapes explicitement demandées au même poids', () => {
    expect(
      calculateWarmupSets({
        targetWeightKg: 25,
        incrementKg: 2.5,
        minimumWeightKg: 20,
        steps: DEFAULT_WARMUP_STEPS,
      }),
    ).toEqual([
      { weightKg: 20, reps: 10 },
      { weightKg: 20, reps: 5 },
      { weightKg: 20, reps: 3 },
    ]);
  });

  it('accepte une liste vide et une liste arbitrairement longue', () => {
    expect(
      calculateWarmupSets({ targetWeightKg: 100, incrementKg: 2.5, steps: [] }),
    ).toEqual([]);

    const steps = Array.from({ length: 20 }, (_, index) => ({
      percentage: index + 1,
      reps: 1,
    }));
    expect(
      calculateWarmupSets({ targetWeightKg: 100, incrementKg: 0.5, steps }),
    ).toHaveLength(20);
  });

  it.each([
    [{ targetWeightKg: 0, incrementKg: 2.5, steps: [] }, 'targetWeightKg'],
    [{ targetWeightKg: Number.NaN, incrementKg: 2.5, steps: [] }, 'targetWeightKg'],
    [{ targetWeightKg: 100, incrementKg: 0, steps: [] }, 'incrementKg'],
    [{ targetWeightKg: 100, incrementKg: 2.5, minimumWeightKg: -1, steps: [] }, 'minimumWeightKg'],
    [{ targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 0, reps: 5 }] }, 'percentage'],
    [{ targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 100, reps: 5 }] }, 'percentage'],
    [{ targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 40, reps: 0 }] }, 'reps'],
    [{ targetWeightKg: 100, incrementKg: 2.5, steps: [{ percentage: 40, reps: 2.5 }] }, 'reps'],
  ])('refuse une entrée invalide : %s', (input, field) => {
    expect(() => calculateWarmupSets(input)).toThrow(new RangeError(field));
  });
});
```

- [ ] **Step 2: Run the engine tests and verify RED**

Run:

```powershell
npm run test:run -- src/lib/warmup.test.ts
```

Expected: FAIL because `./warmup` does not exist.

- [ ] **Step 3: Implement the minimal pure engine**

Create `src/lib/warmup.ts`:

```ts
export interface WarmupStep {
  percentage: number;
  reps: number;
}

export interface WarmupInput {
  targetWeightKg: number;
  incrementKg: number;
  minimumWeightKg?: number;
  steps: readonly WarmupStep[];
}

export interface WarmupSetSuggestion {
  weightKg: number;
  reps: number;
}

export const DEFAULT_WARMUP_INCREMENT_KG = 2.5;

export const DEFAULT_WARMUP_STEPS: readonly WarmupStep[] = [
  { percentage: 40, reps: 10 },
  { percentage: 60, reps: 5 },
  { percentage: 80, reps: 3 },
];

const CENTS_PER_KG = 100;

function positiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(field);
}

export function calculateWarmupSets(input: WarmupInput): WarmupSetSuggestion[] {
  positiveFinite(input.targetWeightKg, 'targetWeightKg');
  positiveFinite(input.incrementKg, 'incrementKg');

  const minimum = input.minimumWeightKg ?? 0;
  if (!Number.isFinite(minimum) || minimum < 0) throw new RangeError('minimumWeightKg');

  const targetCents = Math.round(input.targetWeightKg * CENTS_PER_KG);
  const incrementCents = Math.round(input.incrementKg * CENTS_PER_KG);
  const minimumCents = Math.round(minimum * CENTS_PER_KG);

  return input.steps.flatMap((step) => {
    if (!Number.isFinite(step.percentage) || step.percentage <= 0 || step.percentage >= 100) {
      throw new RangeError('percentage');
    }
    if (!Number.isInteger(step.reps) || step.reps <= 0) throw new RangeError('reps');

    const rawCents = Math.floor((targetCents * step.percentage) / 100);
    const roundedCents = Math.floor(rawCents / incrementCents) * incrementCents;
    const weightCents = Math.max(roundedCents, minimumCents);

    if (weightCents <= 0 || weightCents >= targetCents) return [];
    return [{ weightKg: weightCents / CENTS_PER_KG, reps: step.reps }];
  });
}
```

- [ ] **Step 4: Run the engine tests and verify GREEN**

Run:

```powershell
npm run test:run -- src/lib/warmup.test.ts
```

Expected: 8 tests pass with no warning or error.

- [ ] **Step 5: Run focused typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0.

---

### Task 2: Atomic repository insertion

**Files:**

- Modify: `src/data/repositories/workouts.test.ts`
- Modify: `src/data/repositories/workouts.ts`

**Interfaces:**

- Consumes: `readonly WarmupSetSuggestion[]` from `src/lib/warmup.ts`.
- Produces:

```ts
export async function insertWarmupSets(
  workoutExerciseId: string,
  suggestions: readonly WarmupSetSuggestion[],
): Promise<WorkoutSet[]>;
```

- [ ] **Step 1: Add the repository import and failing tests**

Add `insertWarmupSets` to the existing import from `./workouts` and
`WarmupSetSuggestion` to the type imports. Add `vi` to the existing Vitest import. Append this
describe block:

```ts
describe('insertWarmupSets', () => {
  beforeEach(resetDb);

  const ramp: readonly WarmupSetSuggestion[] = [
    { weightKg: 40, reps: 10 },
    { weightKg: 60, reps: 5 },
    { weightKg: 80, reps: 3 },
  ];

  it('insère des cibles échauffement avant les séries de travail', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const parent = await addExercise(workout.id, 'bench');
    const working = await addSet(parent.id, {
      setType: 'failure',
      weight: 100,
      reps: 5,
      targetWeight: 100,
      targetReps: 5,
    });

    const inserted = await insertWarmupSets(parent.id, ramp);
    const detail = await getWorkoutDetail(workout.id);
    const sets = detail!.exercises[0]!.sets;

    expect(inserted.map((set) => ({
      setType: set.setType,
      targetWeight: set.targetWeight,
      targetReps: set.targetReps,
      weight: set.weight,
      reps: set.reps,
      isCompleted: set.isCompleted,
      performedAt: set.performedAt,
    }))).toEqual([
      {
        setType: 'warmup',
        targetWeight: 40,
        targetReps: 10,
        weight: undefined,
        reps: undefined,
        isCompleted: 0,
        performedAt: 0,
      },
      {
        setType: 'warmup',
        targetWeight: 60,
        targetReps: 5,
        weight: undefined,
        reps: undefined,
        isCompleted: 0,
        performedAt: 0,
      },
      {
        setType: 'warmup',
        targetWeight: 80,
        targetReps: 3,
        weight: undefined,
        reps: undefined,
        isCompleted: 0,
        performedAt: 0,
      },
    ]);
    expect(sets.map((set) => set.order)).toEqual([0, 1, 2, 3]);
    expect(sets[3]).toMatchObject({
      id: working.id,
      setType: 'failure',
      weight: 100,
      reps: 5,
      targetWeight: 100,
      targetReps: 5,
    });
  });

  it('ignore les lignes soft-deleted lors de la renumérotation', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const parent = await addExercise(workout.id, 'bench');
    const gone = await addSet(parent.id);
    const living = await addSet(parent.id, { targetWeight: 100, targetReps: 5 });
    await deleteSet(gone.id);

    await insertWarmupSets(parent.id, ramp.slice(0, 1));

    const rows = (await db.workoutSets.where('workoutExerciseId').equals(parent.id).toArray())
      .filter((set) => set.deletedAt === 0)
      .sort((a, b) => a.order - b.order);
    expect(rows.map((set) => [set.id, set.order])).toEqual([
      [expect.any(String), 0],
      [living.id, 1],
    ]);
  });

  it('sérialise deux insertions lancées dans le même tick', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const parent = await addExercise(workout.id, 'bench');
    await addSet(parent.id, { targetWeight: 100, targetReps: 5 });

    await Promise.all([
      insertWarmupSets(parent.id, ramp.slice(0, 2)),
      insertWarmupSets(parent.id, ramp.slice(2)),
    ]);

    const rows = (await db.workoutSets.where('workoutExerciseId').equals(parent.id).toArray())
      .filter((set) => set.deletedAt === 0)
      .sort((a, b) => a.order - b.order);
    expect(rows.map((set) => set.order)).toEqual([0, 1, 2, 3]);
    expect(new Set(rows.map((set) => set.order)).size).toBe(4);
    expect(rows.filter((set) => set.setType === 'warmup')).toHaveLength(3);
  });

  it('refuse une ligne parente absente sans écrire', async () => {
    await expect(insertWarmupSets('absente', ramp)).rejects.toThrow(
      'Ligne d’exercice introuvable',
    );
    expect(await db.workoutSets.count()).toBe(0);
  });

  it('annule aussi les ajouts si la renumérotation échoue', async () => {
    const workout = await startWorkout('', 'Séance libre');
    const parent = await addExercise(workout.id, 'bench');
    const working = await addSet(parent.id, { targetWeight: 100, targetReps: 5 });
    const fail = vi
      .spyOn(db.workoutSets, 'bulkPut')
      .mockRejectedValueOnce(new Error('échec injecté'));

    try {
      await expect(insertWarmupSets(parent.id, ramp)).rejects.toThrow('échec injecté');
    } finally {
      fail.mockRestore();
    }

    const rows = (await db.workoutSets.where('workoutExerciseId').equals(parent.id).toArray())
      .filter((set) => set.deletedAt === 0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: working.id, order: 0, setType: 'normal' });
  });
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```powershell
npm run test:run -- src/data/repositories/workouts.test.ts
```

Expected: FAIL because `insertWarmupSets` is not exported.

- [ ] **Step 3: Implement the transaction**

Add the type import:

```ts
import type { WarmupSetSuggestion } from '@/lib/warmup';
```

Add after `duplicateLastSet`:

```ts
export async function insertWarmupSets(
  workoutExerciseId: string,
  suggestions: readonly WarmupSetSuggestion[],
): Promise<WorkoutSet[]> {
  return db.transaction('rw', db.workoutExercises, db.workoutSets, async () => {
    const parent = await db.workoutExercises.get(workoutExerciseId);
    if (parent === undefined) {
      throw new Error(`Ligne d’exercice introuvable : ${workoutExerciseId}`);
    }

    const siblings = await liveSetsOf(workoutExerciseId);
    const inserted = suggestions.map((suggestion, order) =>
      newEntity<WorkoutSet>({
        workoutExerciseId,
        exerciseId: parent.exerciseId,
        workoutId: parent.workoutId,
        order,
        setType: 'warmup',
        side: 'both',
        targetWeight: suggestion.weightKg,
        targetReps: suggestion.reps,
        isCompleted: 0,
        performedAt: 0,
      }),
    );

    const shifted = siblings.map((set, index) =>
      touch(set, { order: inserted.length + index }),
    );

    if (inserted.length > 0) await db.workoutSets.bulkAdd(inserted);
    if (shifted.length > 0) await db.workoutSets.bulkPut(shifted);
    return inserted;
  });
}
```

- [ ] **Step 4: Run repository tests and verify GREEN**

Run:

```powershell
npm run test:run -- src/data/repositories/workouts.test.ts
```

Expected: all repository tests pass, including the four new cases.

- [ ] **Step 5: Run engine and repository tests together**

Run:

```powershell
npm run test:run -- src/lib/warmup.test.ts src/data/repositories/workouts.test.ts
```

Expected: exit code 0.

---

### Task 3: Eligibility and prefill context

**Files:**

- Create: `src/features/workout/warmupContext.test.ts`
- Create: `src/features/workout/warmupContext.ts`

**Interfaces:**

- Consumes: `WorkoutExerciseDetail`.
- Produces:

```ts
export interface WarmupContext {
  targetWeightKg: number | undefined;
  minimumWeightKg: number;
}

export function warmupContextFor(line: WorkoutExerciseDetail): WarmupContext | null;
```

- [ ] **Step 1: Write failing context tests**

Create `src/features/workout/warmupContext.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { warmupContextFor } from './warmupContext';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const row: WorkoutExercise = {
  id: 'row',
  workoutId: 'workout',
  exerciseId: 'exercise',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
  id: crypto.randomUUID(),
  workoutExerciseId: row.id,
  exerciseId: exercise().id,
  workoutId: row.workoutId,
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 0,
  performedAt: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const detail = (
  currentExercise: Exercise | undefined,
  sets: WorkoutSet[],
): WorkoutExerciseDetail => ({
  row,
  exercise: currentExercise,
  sets,
  previous: [],
});

describe('warmupContextFor', () => {
  it('prend la valeur réalisée de la première série de travail avant sa cible', () => {
    expect(
      warmupContextFor(
        detail(exercise(), [
          set({ setType: 'warmup', weight: 40, targetWeight: 45 }),
          set({ order: 1, weight: 102.5, targetWeight: 100 }),
          set({ order: 2, weight: 110 }),
        ]),
      ),
    ).toEqual({ targetWeightKg: 102.5, minimumWeightKg: 20 });
  });

  it('retombe sur la cible de la première série de travail', () => {
    expect(
      warmupContextFor(detail(exercise(), [set({ targetWeight: 100, targetReps: 5 })])),
    ).toEqual({ targetWeightKg: 100, minimumWeightKg: 20 });
  });

  it('laisse la cible vide quand aucune série de travail ne porte de charge', () => {
    expect(warmupContextFor(detail(exercise(), [set({})]))).toEqual({
      targetWeightKg: undefined,
      minimumWeightKg: 20,
    });
  });

  it('utilise zéro comme minimum pour une machine ou un haltère fixe', () => {
    expect(
      warmupContextFor(
        detail(exercise({ equipment: 'machine' }), [set({ targetWeight: 80 })]),
      ),
    ).toEqual({ targetWeightKg: 80, minimumWeightKg: 0 });
  });

  it.each(['reps_only', 'assisted_weight_reps', 'time_only', 'distance_time'] as const)(
    'n’offre pas le calculateur pour %s',
    (measurementType) => {
      expect(
        warmupContextFor(detail(exercise({ measurementType }), [set({ targetWeight: 20 })])),
      ).toBeNull();
    },
  );

  it('n’offre rien pour un exercice supprimé de la bibliothèque', () => {
    expect(warmupContextFor(detail(undefined, [set({ targetWeight: 100 })]))).toBeNull();
  });
});
```

- [ ] **Step 2: Run context tests and verify RED**

Run:

```powershell
npm run test:run -- src/features/workout/warmupContext.test.ts
```

Expected: FAIL because `./warmupContext` does not exist.

- [ ] **Step 3: Implement context derivation**

Create `src/features/workout/warmupContext.ts`:

```ts
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { measurementShape } from '@/lib/measurement';
import { platesConfigFor } from './plateConfig';

export interface WarmupContext {
  targetWeightKg: number | undefined;
  minimumWeightKg: number;
}

export function warmupContextFor(line: WorkoutExerciseDetail): WarmupContext | null {
  const exercise = line.exercise;
  if (exercise === undefined) return null;
  if (measurementShape(exercise.measurementType).weightRole !== 'load') return null;

  const working = line.sets.find((set) => set.setType !== 'warmup');
  const targetWeightKg = working?.weight ?? working?.targetWeight;
  const minimumWeightKg = platesConfigFor(exercise)?.barWeight ?? 0;

  return { targetWeightKg, minimumWeightKg };
}
```

- [ ] **Step 4: Run context tests and verify GREEN**

Run:

```powershell
npm run test:run -- src/features/workout/warmupContext.test.ts
```

Expected: 6 tests pass.

---

### Task 4: Warm-up sheet and live-workout integration

**Files:**

- Create: `src/features/workout/WarmupSheet.tsx`
- Modify: `src/ui/NumberInput.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**

- Consumes:

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  initialTargetWeightKg: number | undefined;
  minimumWeightKg: number;
  onInsert: (suggestions: readonly WarmupSetSuggestion[]) => Promise<void>;
}
```

- Produces no persistent state. The sheet passes suggestions to its callback.

- [ ] **Step 1: Add neutral focus support without changing existing callers**

Extend `NumberInput` props:

```ts
focusTone?: 'accent' | 'neutral';
```

Destructure with the default:

```ts
focusTone = 'accent',
```

Replace the hard-coded input focus class with:

```ts
${focusTone === 'neutral'
  ? 'focus:ring-2 focus:ring-[var(--text-2)]'
  : 'focus:ring-2 focus:ring-[var(--accent-ink)]'}
```

Add the same conditional tone to the `stepper` class. Its neutral branch uses
`focus-visible:[outline-color:var(--text-2)]`. Existing callers retain the accent default. The
working-load field in `WarmupSheet` passes `focusTone="neutral"`.

Move the two existing stepper labels out of the component: add `decrease: 'Diminuer'` and
`increase: 'Augmenter'` inside `fr.common`, import `t` in `NumberInput.tsx`, and replace the two
hard-coded `aria-label` values with `t('common.decrease')` and `t('common.increase')`.

- [ ] **Step 2: Add the French copy**

Add these properties inside the existing `fr.workout` object:

```ts
warmupAction: 'Calculer l’échauffement',
warmupTitle: 'Échauffement',
warmupTarget: 'Charge de travail',
warmupStepPercentage: 'Pourcentage',
warmupStepReps: 'Répétitions',
warmupStepWeight: 'Charge proposée',
warmupStepPercentageShort: '%',
warmupStepRepsShort: 'reps',
warmupStepWeightShort: 'kg',
warmupRemoveStep: 'Supprimer cette étape',
warmupAddStep: 'Ajouter une étape',
warmupInsert: 'Insérer les séries',
warmupInvalidTarget: 'Renseigne une charge de travail positive.',
warmupInvalidSteps:
  'Chaque étape demande un pourcentage entre 0 et 100 et des répétitions entières.',
warmupNoSuggestion: 'Aucune charge d’approche inférieure n’est disponible avec ce pas.',
warmupInsertError: 'Les séries n’ont pas été insérées. Réessaie.',
warmupPreviewEmpty: '—',
```

- [ ] **Step 3: Create the dedicated sheet**

Create `src/features/workout/WarmupSheet.tsx` with:

```tsx
import { useState } from 'react';
import { t } from '@/i18n/fr';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  DEFAULT_WARMUP_STEPS,
} from '@/lib/warmup';
import type { WarmupSetSuggestion } from '@/lib/warmup';
import { AddRow, Button, NumberInput, Sheet } from '@/ui';
import { CloseIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';

interface DraftStep {
  id: string;
  percentage: number | undefined;
  reps: number | undefined;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialTargetWeightKg: number | undefined;
  minimumWeightKg: number;
  onInsert: (suggestions: readonly WarmupSetSuggestion[]) => Promise<void>;
}

const defaultSteps = (): DraftStep[] =>
  DEFAULT_WARMUP_STEPS.map((step) => ({
    id: crypto.randomUUID(),
    percentage: step.percentage,
    reps: step.reps,
  }));

function DraftIntegerInput({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      enterKeyHint="done"
      value={value ?? ''}
      aria-label={label}
      onChange={(event) => {
        if (!/^\d*$/.test(event.target.value)) return;
        onChange(event.target.value === '' ? undefined : Number(event.target.value));
      }}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
      className="metric min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-2 text-center
        text-base font-semibold text-[var(--text-1)] outline-none
        focus:ring-2 focus:ring-[var(--text-2)]"
    />
  );
}

export function WarmupSheet({
  open,
  onClose,
  initialTargetWeightKg,
  minimumWeightKg,
  onInsert,
}: Props) {
  const [targetWeightKg, setTargetWeightKg] = useState(initialTargetWeightKg);
  const [steps, setSteps] = useState(defaultSteps);
  const [wasOpen, setWasOpen] = useState(open);
  const [submitting, setSubmitting] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTargetWeightKg(initialTargetWeightKg);
      setSteps(defaultSteps());
      setWriteFailed(false);
    }
  }

  const targetValid =
    targetWeightKg !== undefined && Number.isFinite(targetWeightKg) && targetWeightKg > 0;
  const stepsValid =
    steps.length > 0 &&
    steps.every(
      (step) =>
        step.percentage !== undefined &&
        step.percentage > 0 &&
        step.percentage < 100 &&
        step.reps !== undefined &&
        Number.isInteger(step.reps) &&
        step.reps > 0,
    );

  const suggestionFor = (step: DraftStep): WarmupSetSuggestion | undefined => {
    if (
      !targetValid ||
      step.percentage === undefined ||
      step.percentage <= 0 ||
      step.percentage >= 100 ||
      step.reps === undefined ||
      !Number.isInteger(step.reps) ||
      step.reps <= 0
    ) {
      return undefined;
    }
    return calculateWarmupSets({
      targetWeightKg,
      incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
      minimumWeightKg,
      steps: [{ percentage: step.percentage, reps: step.reps }],
    })[0];
  };

  const previews = steps.map(suggestionFor);
  const suggestions = previews.filter(
    (suggestion): suggestion is WarmupSetSuggestion => suggestion !== undefined,
  );

  const validationMessage = !targetValid
    ? t('workout.warmupInvalidTarget')
    : !stepsValid
      ? t('workout.warmupInvalidSteps')
      : suggestions.length === 0
        ? t('workout.warmupNoSuggestion')
        : null;

  const insert = async () => {
    if (validationMessage !== null || submitting) return;
    setSubmitting(true);
    setWriteFailed(false);
    try {
      await onInsert(suggestions);
      onClose();
    } catch {
      setWriteFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.warmupTitle')}>
      <div className="flex flex-col gap-5 pb-2">
        <label className="flex flex-col gap-2">
          <span className="label-xs font-semibold text-[var(--text-2)]">
            {t('workout.warmupTarget')}
          </span>
          <NumberInput
            value={targetWeightKg}
            onChange={setTargetWeightKg}
            min={0}
            step={DEFAULT_WARMUP_INCREMENT_KG}
            suffix={t('units.kg')}
            focusTone="neutral"
            aria-label={t('workout.warmupTarget')}
          />
        </label>

        <div className="flex flex-col gap-3">
          <div
            aria-hidden="true"
            className="grid grid-cols-[4.25rem_3.5rem_minmax(0,1fr)_3rem] gap-2"
          >
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepPercentageShort')}
            </span>
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepRepsShort')}
            </span>
            <span className="label-xs text-center text-[var(--text-2)]">
              {t('workout.warmupStepWeightShort')}
            </span>
          </div>
          {steps.map((step, index) => {
            const suggestion = previews[index];
            return (
              <div
                key={step.id}
                className="grid grid-cols-[4.25rem_3.5rem_minmax(0,1fr)_3rem]
                  items-end gap-2"
              >
                <DraftIntegerInput
                  value={step.percentage}
                  onChange={(percentage) =>
                    setSteps((current) =>
                      current.map((item) => item.id === step.id ? { ...item, percentage } : item),
                    )
                  }
                  label={t('workout.warmupStepPercentage')}
                />
                <DraftIntegerInput
                  value={step.reps}
                  onChange={(reps) =>
                    setSteps((current) =>
                      current.map((item) => item.id === step.id ? { ...item, reps } : item),
                    )
                  }
                  label={t('workout.warmupStepReps')}
                />
                <p className="metric flex min-h-12 items-center justify-center rounded-lg
                  bg-[var(--surface-2)] text-sm text-[var(--text-1)]">
                  {suggestion === undefined
                    ? t('workout.warmupPreviewEmpty')
                    : formatNumber(suggestion.weightKg)}
                </p>
                <button
                  type="button"
                  aria-label={t('workout.warmupRemoveStep')}
                  onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))}
                  className="flex size-12 items-center justify-center rounded-lg
                    text-[var(--text-2)] active:bg-[var(--surface-2)]
                    focus-visible:[outline-color:var(--text-2)]"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>

        <AddRow
          label={t('workout.warmupAddStep')}
          onClick={() =>
            setSteps((current) => [
              ...current,
              { id: crypto.randomUUID(), percentage: undefined, reps: undefined },
            ])
          }
        />

        {validationMessage !== null && (
          <p className="text-sm text-[var(--text-2)]">{validationMessage}</p>
        )}
        {writeFailed && (
          <p role="alert" className="text-sm text-[var(--danger-ink)]">
            {t('workout.warmupInsertError')}
          </p>
        )}

        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={validationMessage !== null || submitting}
          onClick={() => void insert()}
        >
          {t('workout.warmupInsert')}
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Wire the action and repository callback**

In `WorkoutScreen.tsx`:

1. Import `insertWarmupSets`, `WarmupSheet`, and `warmupContextFor`.
2. Extend `SheetState`:

```ts
| { kind: 'warmup'; rowId: string }
```

3. Derive the selected line and context next to `lineOf`:

```ts
const warmupLine = sheet?.kind === 'warmup' ? lineOf(sheet.rowId) : null;
const warmupContext = warmupLine === null ? null : warmupContextFor(warmupLine);
```

4. Add this helper next to `lineOf`:

```ts
const warmupContextOf = (rowId: string) => {
  const line = lineOf(rowId);
  return line === null ? null : warmupContextFor(line);
};
```

Then insert this conditional spread in the exercise action array immediately after
`addSetAction`:

```ts
...(
  sheet?.kind === 'exercise' && warmupContextOf(sheet.rowId) !== null
    ? [{
        label: t('workout.warmupAction'),
        onSelect: () => setSheet({ kind: 'warmup', rowId: sheet.rowId }),
      }]
    : []
),
```

5. Render the sheet:

```tsx
<WarmupSheet
  open={sheet?.kind === 'warmup' && warmupContext !== null}
  onClose={() => setSheet(null)}
  initialTargetWeightKg={warmupContext?.targetWeightKg}
  minimumWeightKg={warmupContext?.minimumWeightKg ?? 0}
  onInsert={async (suggestions) => {
    if (sheet?.kind !== 'warmup') return;
    await insertWarmupSets(sheet.rowId, suggestions);
  }}
/>
```

- [ ] **Step 5: Run focused tests, typecheck, and lint**

Run:

```powershell
npm run test:run -- src/lib/warmup.test.ts src/features/workout/warmupContext.test.ts src/data/repositories/workouts.test.ts
npm run typecheck
npm run lint
```

Expected: every command exits 0 with no warning.

---

### Task 5: Real 375 px verification, project gates, progress, and atomic commit

**Files:**

- Modify: `PROGRESS.md`
- Verify all RF-29 files above.

**Interfaces:**

- No new interface. This task proves the completed behavior and records the checkpoint.

- [ ] **Step 1: Start or reuse the main development server**

Read the current terminal first. If port 5173 is not already serving this repository, run:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Use:

```text
http://127.0.0.1:5173/FITTRACK-RELOADED/#/
```

- [ ] **Step 2: Drive the real app at 375 × 812**

Create or reuse an active workout with a `weight_reps` barbell exercise and a 100 kg working
target. Open the exercise menu and the warm-up sheet.

Record from the DOM:

```js
({
  viewport: [innerWidth, innerHeight],
  scroll: [document.documentElement.scrollWidth, innerWidth],
  controls: [...document.querySelectorAll('[role="dialog"] button, [role="dialog"] input')]
    .filter((node) => node.getBoundingClientRect().width > 0)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        label: node.getAttribute('aria-label') ?? node.textContent?.trim(),
        width: rect.width,
        height: rect.height,
        color: style.color,
        background: style.backgroundColor,
        outline: style.outlineColor,
      };
    }),
})
```

Assert:

- viewport is 375 × 812;
- no horizontal overflow;
- every visible interactive control is at least 48 px high;
- no calculator control uses computed accent colours;
- the sheet can scroll to its insertion action.

- [ ] **Step 3: Insert and verify IndexedDB before and after reload**

Insert the default 40/60/80 ramp for 100 kg. Read the active exercise rows through the app’s Dexie
module in the Vite page and record:

```js
const { db } = await import('/FITTRACK-RELOADED/src/data/db.ts');
const active = (await db.workouts.where('status').equals('active').toArray())
  .filter((workout) => workout.deletedAt === 0)
  .sort((a, b) => b.startedAt - a.startedAt)[0];
const parent = (await db.workoutExercises.where('workoutId').equals(active.id).toArray())
  .filter((row) => row.deletedAt === 0)
  .sort((a, b) => a.order - b.order)[0];
const rows = await db.workoutSets
  .where('workoutExerciseId')
  .equals(parent.id)
  .toArray();
rows
  .filter((row) => row.deletedAt === 0)
  .sort((a, b) => a.order - b.order)
  .map(({ order, setType, targetWeight, targetReps, weight, reps, isCompleted, performedAt }) => ({
    order,
    setType,
    targetWeight,
    targetReps,
    weight,
    reps,
    isCompleted,
    performedAt,
  }));
```

Expected first rows:

```js
[
  { order: 0, setType: 'warmup', targetWeight: 40, targetReps: 10,
    weight: undefined, reps: undefined, isCompleted: 0, performedAt: 0 },
  { order: 1, setType: 'warmup', targetWeight: 60, targetReps: 5,
    weight: undefined, reps: undefined, isCompleted: 0, performedAt: 0 },
  { order: 2, setType: 'warmup', targetWeight: 80, targetReps: 3,
    weight: undefined, reps: undefined, isCompleted: 0, performedAt: 0 },
]
```

Reload the page completely, reopen the exercise, and re-read the same rows. The order and values
must be identical and visibly rehydrated in the grid.

- [ ] **Step 4: Verify exclusions and console**

Open exercise menus for a bodyweight/reps-only exercise and an assisted exercise. Confirm the
warm-up action is absent. Confirm the browser console contains no new error or warning.

- [ ] **Step 5: Run the four fresh project gates**

Run separately and read every exit code:

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected:

- typecheck exit 0;
- lint exit 0 and 0 warnings;
- all tests pass, with the new RF-29 count recorded;
- production build exit 0.

- [ ] **Step 6: Update `PROGRESS.md`**

Add a dated RF-29 section containing:

- formula and downward 2.5 kg rounding;
- load-only eligibility;
- neutral exercise-menu sheet placement;
- exact transaction and ordering behavior;
- tests observed red then green;
- final test count and four gate results;
- measured 375 px geometry and computed styles;
- IndexedDB rows before and after reload;
- explicit statement that RF-31 was not started;
- manual gym checkpoint:
  1. open a heavy barbell exercise;
  2. calculate a ramp from the real first working load;
  3. judge whether 40 % × 10, 60 % × 5, 80 % × 3 is useful without editing;
  4. confirm insertion is discoverable in `⋯`;
  5. confirm the new warm-up rows do not start rest or trigger records.

- [ ] **Step 7: Review and create one RF-29 feature commit**

Review only intended files:

```powershell
git status --short
git diff --check
git diff -- src/lib/warmup.ts src/lib/warmup.test.ts src/data/repositories/workouts.ts src/data/repositories/workouts.test.ts src/features/workout/warmupContext.ts src/features/workout/warmupContext.test.ts src/features/workout/WarmupSheet.tsx src/features/workout/WorkoutScreen.tsx src/ui/NumberInput.tsx src/i18n/fr.ts PROGRESS.md
```

Stage only RF-29 and progress files:

```powershell
git add -- src/lib/warmup.ts src/lib/warmup.test.ts src/data/repositories/workouts.ts src/data/repositories/workouts.test.ts src/features/workout/warmupContext.ts src/features/workout/warmupContext.test.ts src/features/workout/WarmupSheet.tsx src/features/workout/WorkoutScreen.tsx src/ui/NumberInput.tsx src/i18n/fr.ts PROGRESS.md
git commit -m "feat(lot-06): ajoute le calculateur d'échauffement (RF-29)"
```

Confirm `.agents/`, `.codex/`, and `AGENTS.md` remain untracked and unstaged.
