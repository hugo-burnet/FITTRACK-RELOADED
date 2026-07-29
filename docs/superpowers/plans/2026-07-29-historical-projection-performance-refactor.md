# Historical Projection Performance and Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ramener la projection annuelle sous 5 secondes sur la baseline locale, puis cacher le graphe Dexie derrière un DTO historique canonique sans changer le comportement.

**Architecture:** Le correctif P0 conserve `listExportSources` et remplace uniquement les grands `anyOf` par des lectures `equals('workoutId')` bornées dans une transaction de lecture. Une fois ce correctif commité et vert, `listHistoricalWorkouts` devient la seam unique : il sélectionne, charge, filtre, résout l’identité historique et retourne des DTO sans champs de persistance, consommés directement par les exports et analytics.

**Tech Stack:** TypeScript 6 strict, Dexie 4, fake-indexeddb 6, Vitest 4, Tinybench via `vitest bench`, React 19.

## Global Constraints

- Aucune modification du schéma Dexie ou de `src/data/db.ts`.
- Aucun changement de texte UI, de route ou de format Markdown.
- `from` reste inclusif et `to` exclusif.
- Une séance doit être terminée et vivante ; lignes et séries doivent être vivantes ; les séries doivent être validées.
- L’ordre reste séances anciennes vers récentes, exercices et séries par `order`.
- Le snapshot d’exercice gagne sur la bibliothèque, champ par champ.
- Le correctif P0 et la refactorisation sont deux commits distincts.
- Utiliser `npm.cmd`, car `npm.ps1` est bloqué sur l’hôte de référence.
- Ne jamais modifier les assertions métier existantes pour faire passer la refactorisation.

---

## File Map

### Correctif P0

- Modify: `src/data/repositories/history.bench.ts` — porte de performance opt-in et mesure annuelle.
- Modify: `src/data/repositories/exportQueries.ts` — lecture indexée bornée du graphe actuel.

### Refactorisation

- Create: `src/lib/historyProjection.ts` — types purs de la seam canonique.
- Create: `src/data/repositories/historicalWorkouts.ts` — sélection, lecture et projection profondes.
- Create: `src/data/repositories/historicalWorkouts.test.ts` — comportement repository à la nouvelle seam.
- Create: `src/test/historicalWorkout.ts` — fabriques déterministes du DTO pour les tests purs.
- Modify: `src/lib/export/types.ts` — `ExportScope` devient un alias neutre ; suppression de `ExportSource`.
- Modify: `src/lib/export/projectCoachExport.ts` — consomme `HistoricalWorkout`.
- Modify: `src/lib/export/projectCoachExport.test.ts` — fixtures canoniques, mêmes sorties.
- Modify: `src/lib/records.ts` — réduit les paramètres de `setVolume` et `isWorkingSet` aux champs lus.
- Modify: `src/lib/volume.ts` — `VolumeEntry` n’exige plus un `WorkoutSet` persistant complet.
- Modify: `src/lib/analytics/metrics.ts` — séries historiques minimales.
- Modify: `src/lib/analytics/sessions.ts` — projection analytics depuis le DTO.
- Modify: `src/lib/analytics/sessions.test.ts` — fixtures canoniques.
- Modify: `src/lib/analytics/volume.ts` — tonnage et durée depuis le DTO.
- Modify: `src/lib/analytics/volume.test.ts` — fixtures canoniques.
- Modify: `src/lib/analytics/muscles.ts` — muscles résolus depuis le DTO.
- Modify: `src/lib/analytics/muscles.test.ts` — fixtures canoniques.
- Modify: `src/lib/analytics/periods.ts` — commentaire de seam.
- Modify: `src/features/history/HistoryDetailScreen.tsx` — lecture canonique pour le partage.
- Modify: `src/features/analytics/ExerciseAnalyticsScreen.tsx` — lecture canonique.
- Modify: `src/features/analytics/WeeklySessionsScreen.tsx` — lecture canonique et champs plats.
- Modify: `src/features/analytics/WeeklyVolumeScreen.tsx` — lecture canonique et type neutre.
- Modify: `src/features/analytics/MuscleBalanceScreen.tsx` — lecture canonique et champs plats.
- Modify: `src/data/repositories/history.bench.ts` — benchmark de la nouvelle seam.
- Delete: `src/data/repositories/exportQueries.ts`.
- Delete: `src/data/repositories/exportQueries.test.ts`.

### Passation

- Modify: `PROGRESS.md` — résultat, preuves, limites et checkpoint téléphone.

---

### Task 1: Transformer la mesure annuelle en porte RED

**Files:**
- Modify: `src/data/repositories/history.bench.ts`

**Interfaces:**
- Consumes: `listExportSources(scope): Promise<ExportSource[]>`
- Produces: une porte opt-in qui échoue au-dessus de `5_000` ms et vérifie les `244` séances attendues.

- [ ] **Step 1: Ajouter les constantes de la période annuelle**

Sous `DAY_MS`, ajouter :

```ts
const ANNUAL_SCOPE = {
  kind: 'period',
  from: LARGE_HISTORY_PROFILE.startedAt,
  to: LARGE_HISTORY_PROFILE.startedAt + 365 * DAY_MS,
} as const;

const EXPECTED_ANNUAL_WORKOUTS = 244;
const MAX_ANNUAL_PROJECTION_MS = 5_000;
```

Remplacer la portée littérale du dernier `bench` par `ANNUAL_SCOPE`.

- [ ] **Step 2: Ajouter la preuve de performance dans `beforeAll`**

Après le `console.info` du semis, ajouter :

```ts
  const projectionStartedAt = performance.now();
  const annualSources = await listExportSources(ANNUAL_SCOPE);
  const projectionElapsedMs = performance.now() - projectionStartedAt;

  console.info(
    `bounded annual projection: ${projectionElapsedMs.toFixed(1)} ms ` +
      `(${annualSources.length} workouts)`,
  );

  if (annualSources.length !== EXPECTED_ANNUAL_WORKOUTS) {
    throw new Error(
      `Unexpected annual projection count: ${annualSources.length}`,
    );
  }

  if (projectionElapsedMs >= MAX_ANNUAL_PROJECTION_MS) {
    throw new Error(
      `Bounded annual projection exceeded ${MAX_ANNUAL_PROJECTION_MS} ms: ` +
        `${projectionElapsedMs.toFixed(1)} ms`,
    );
  }
```

Porter le timeout de `beforeAll` de `120_000` à `180_000`, car la preuve RED doit
laisser l’ancienne implémentation terminer avant d’échouer sur le seuil.

- [ ] **Step 3: Exécuter la preuve et vérifier RED**

Run:

```powershell
npm.cmd run bench:history
```

Expected: FAIL après le semis avec
`Bounded annual projection exceeded 5000 ms`. Le nombre doit être `244`, donc
l’échec prouve la lenteur et non une erreur de portée.

- [ ] **Step 4: Vérifier que la suite ordinaire reste verte**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/exportQueries.test.ts
git diff --check
```

Expected: `exportQueries.test.ts` PASS ; `git diff --check` code 0.

- [ ] **Step 5: Commiter la porte RED**

```powershell
git add -- src/data/repositories/history.bench.ts
git commit -m "test: verrouille la performance de la projection historique"
```

Le benchmark opt-in est rouge à ce commit ; `npm run test:run` reste vert.

---

### Task 2: Corriger le P0 par des lectures indexées bornées

**Files:**
- Modify: `src/data/repositories/exportQueries.ts`

**Interfaces:**
- Consumes: les index existants `workoutExercises.workoutId` et `workoutSets.workoutId`.
- Produces: la même interface `listExportSources(scope): Promise<ExportSource[]>`, sans changement du résultat.

- [ ] **Step 1: Ajouter le chargeur interne du graphe**

Après `selectWorkouts`, ajouter exactement :

```ts
async function loadWorkoutGraph(
  workoutIds: readonly string[],
): Promise<{
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}> {
  if (workoutIds.length === 0) return { rows: [], sets: [] };

  return db.transaction(
    'r',
    db.workoutExercises,
    db.workoutSets,
    async () => {
      const [rowsByWorkout, setsByWorkout] = await Promise.all([
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutExercises
              .where('workoutId')
              .equals(workoutId)
              .toArray(),
          ),
        ),
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutSets.where('workoutId').equals(workoutId).toArray(),
          ),
        ),
      ]);

      return {
        rows: rowsByWorkout.flat(),
        sets: setsByWorkout.flat(),
      };
    },
  );
}
```

- [ ] **Step 2: Remplacer uniquement les deux grands `anyOf`**

Dans `listExportSources`, remplacer :

```ts
  const [allRows, allSets] = await Promise.all([
    db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray(),
    db.workoutSets.where('workoutId').anyOf(workoutIds).toArray(),
  ]);
```

par :

```ts
  const { rows: allRows, sets: allSets } = await loadWorkoutGraph(workoutIds);
```

Ne modifier aucune autre règle de sélection, filtrage, tri ou projection.

- [ ] **Step 3: Vérifier GREEN sur le comportement repository**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/exportQueries.test.ts
```

Expected: tous les tests de `listExportSources` PASS sans assertion modifiée.

- [ ] **Step 4: Vérifier GREEN sur le P0**

Run:

```powershell
npm.cmd run bench:history
```

Expected:

- `bounded annual projection` annonce `244 workouts`;
- le preflight reste sous `5_000 ms`;
- les trois benchmarks terminent ;
- exit code 0.

Si le seuil échoue encore, ne pas ajouter une seconde optimisation. Revenir à
`systematic-debugging`, mesurer séparément sélection, lignes, séries, bibliothèque
et projection, puis faire valider une nouvelle hypothèse avant de poursuivre.

- [ ] **Step 5: Vérifier toutes les portes avant le commit P0**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: cinq codes de sortie 0.

- [ ] **Step 6: Commiter le correctif séparément**

```powershell
git add -- src/data/repositories/exportQueries.ts
git commit -m "fix: accélère la projection historique bornée"
```

- [ ] **Step 7: Vérifier la baseline de refactorisation**

Run:

```powershell
git status --short
git log -3 --oneline
```

Expected: worktree propre ; deux commits distincts, `test:` puis `fix:`, au-dessus
de la spec.

---

### Task 3: Approfondir la projection historique et migrer tous les consommateurs

**Files:**
- Create: `src/lib/historyProjection.ts`
- Create: `src/test/historicalWorkout.ts`
- Create: `src/data/repositories/historicalWorkouts.ts`
- Create: `src/data/repositories/historicalWorkouts.test.ts`
- Modify: `src/lib/export/types.ts`
- Modify: `src/lib/export/projectCoachExport.ts`
- Modify: `src/lib/export/projectCoachExport.test.ts`
- Modify: `src/lib/records.ts`
- Modify: `src/lib/volume.ts`
- Modify: `src/lib/analytics/metrics.ts`
- Modify: `src/lib/analytics/sessions.ts`
- Modify: `src/lib/analytics/sessions.test.ts`
- Modify: `src/lib/analytics/volume.ts`
- Modify: `src/lib/analytics/volume.test.ts`
- Modify: `src/lib/analytics/muscles.ts`
- Modify: `src/lib/analytics/muscles.test.ts`
- Modify: `src/lib/analytics/periods.ts`
- Modify: `src/features/history/HistoryDetailScreen.tsx`
- Modify: `src/features/analytics/ExerciseAnalyticsScreen.tsx`
- Modify: `src/features/analytics/WeeklySessionsScreen.tsx`
- Modify: `src/features/analytics/WeeklyVolumeScreen.tsx`
- Modify: `src/features/analytics/MuscleBalanceScreen.tsx`
- Modify: `src/data/repositories/history.bench.ts`
- Delete: `src/data/repositories/exportQueries.ts`
- Delete: `src/data/repositories/exportQueries.test.ts`

**Interfaces:**
- Produces:

```ts
listHistoricalWorkouts(
  scope: HistoricalScope,
): Promise<HistoricalWorkout[]>
```

- Replaces: `listExportSources`.
- Invariant: aucun type retourné n’expose `Syncable`, `deletedAt`, `workoutId` de relation, `workoutExerciseId` ou un objet Dexie complet.

- [ ] **Step 1: Créer les types purs de la seam**

Créer `src/lib/historyProjection.ts` :

```ts
import type {
  Equipment,
  MeasurementType,
  MuscleGroup,
  SetType,
  Side,
} from '@/data/types';

export type HistoricalScope =
  | { kind: 'workout'; workoutId: string }
  | { kind: 'exercise'; exerciseId: string; from?: number; to?: number }
  | { kind: 'period'; from: number; to: number }
  | { kind: 'all-history' };

export interface HistoricalSet {
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface HistoricalExercise {
  exerciseId: string;
  name?: string;
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  sets: HistoricalSet[];
}

export interface HistoricalWorkout {
  workoutId: string;
  name: string;
  notes?: string;
  startedAt: number;
  timezoneOffsetMinutes?: number;
  durationSeconds: number;
  exercises: HistoricalExercise[];
}
```

- [ ] **Step 2: Créer des fabriques de DTO déterministes pour les tests purs**

Créer `src/test/historicalWorkout.ts` :

```ts
import type {
  HistoricalExercise,
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';

export const historicalSet = (
  values: Partial<HistoricalSet> = {},
): HistoricalSet => ({
  setType: 'normal',
  side: 'both',
  weight: 80,
  reps: 8,
  ...values,
});

export const historicalExercise = (
  values: Partial<HistoricalExercise> = {},
): HistoricalExercise => ({
  exerciseId: 'exercise-1',
  name: 'Développé couché',
  measurementType: 'weight_reps',
  primaryMuscle: 'chest',
  equipment: 'barbell',
  sets: [historicalSet()],
  ...values,
});

export const historicalWorkout = (
  values: Partial<HistoricalWorkout> = {},
): HistoricalWorkout => ({
  workoutId: 'workout-1',
  name: 'Upper A',
  startedAt: 1_000,
  durationSeconds: 3_600,
  exercises: [historicalExercise()],
  ...values,
});
```

- [ ] **Step 3: Écrire d’abord les attentes de la nouvelle seam**

Copier `src/data/repositories/exportQueries.test.ts` vers
`src/data/repositories/historicalWorkouts.test.ts`, puis :

1. importer `listHistoricalWorkouts` depuis `./historicalWorkouts`;
2. renommer le `describe` en `listHistoricalWorkouts`;
3. remplacer chaque appel `listExportSources` par `listHistoricalWorkouts`;
4. adapter les assertions à la forme canonique.

Le premier test devient :

```ts
  it('reads one session by id as a canonical projection', async () => {
    const bench = await seedExercise();
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }, { order: 1 }] }],
    });
    await seed({
      startedAt: day(4),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });

    const sources = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(sources).toEqual([
      {
        workoutId: workout.id,
        name: 'Upper A',
        startedAt: day(3),
        timezoneOffsetMinutes: 120,
        durationSeconds: 3600,
        exercises: [
          {
            exerciseId: bench.id,
            name: 'Développé couché',
            measurementType: 'weight_reps',
            primaryMuscle: 'chest',
            equipment: 'barbell',
            sets: [
              {
                setType: 'normal',
                side: 'both',
                weight: 80,
                reps: 10,
              },
              {
                setType: 'normal',
                side: 'both',
                weight: 80,
                reps: 10,
              },
            ],
          },
        ],
      },
    ]);
  });
```

Ajouter la preuve que le snapshot gagne avant de supprimer les anciennes preuves
pures :

```ts
  it('resolves exercise identity from the snapshot before the library', async () => {
    const bench = await seedExercise({
      name: 'Nom actuel',
      measurementType: 'weight_reps',
      primaryMuscle: 'shoulders',
      equipment: 'machine',
    });
    const workout = await seed({
      startedAt: day(3),
      exercises: [{ exerciseId: bench.id, sets: [{ order: 0 }] }],
    });
    const [row] = await db.workoutExercises
      .where('workoutId')
      .equals(workout.id)
      .toArray();
    await db.workoutExercises.update(row!.id, {
      exerciseName: 'Nom historique',
      exerciseMeasurementType: 'time_only',
      exercisePrimaryMuscle: 'chest',
      exerciseEquipment: 'cable',
    });

    const [source] = await listHistoricalWorkouts({
      kind: 'workout',
      workoutId: workout.id,
    });

    expect(source?.exercises[0]).toMatchObject({
      name: 'Nom historique',
      measurementType: 'time_only',
      primaryMuscle: 'chest',
      equipment: 'cable',
    });
  });
```

Pour les assertions d’ordre :

- séances : comparer `source.startedAt`;
- exercices : comparer `source.exercises.map(({ exerciseId }) => exerciseId)`;
- séries : étendre le type de semis des séries avec `weight?: number`, remplacer
  `weight: 80` par `weight: setInput.weight ?? 80`, donner des poids distincts
  et comparer `sets.map(({ weight }) => weight)`.

Le type exact du semis devient :

```ts
sets: Array<{
  order: number;
  weight?: number;
  isCompleted?: 0 | 1;
  deletedAt?: number;
}>;
```

et la construction du set contient :

```ts
weight: setInput.weight ?? 80,
```

Ne conserver aucune assertion sur `row.order`, `set.order`, `deletedAt` ou les
objets de bibliothèque : ces détails sont désormais cachés derrière la seam.

- [ ] **Step 4: Vérifier RED sur le nouveau module**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/historicalWorkouts.test.ts
```

Expected: FAIL avec `Failed to resolve import "./historicalWorkouts"`.

- [ ] **Step 5: Créer le module profond**

Créer `src/data/repositories/historicalWorkouts.ts` :

```ts
import { db } from '@/data/db';
import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type {
  HistoricalExercise,
  HistoricalScope,
  HistoricalSet,
  HistoricalWorkout,
} from '@/lib/historyProjection';
import { alive } from './base';

const byOrder = <T extends { order: number }>(left: T, right: T): number =>
  left.order - right.order;

const byOldestFirst = (left: Workout, right: Workout): number =>
  left.startedAt - right.startedAt || left.id.localeCompare(right.id);

const isArchived = (workout: Workout | undefined): workout is Workout =>
  workout !== undefined &&
  workout.deletedAt === 0 &&
  workout.status === 'completed';

const withinBounds = (
  at: number,
  from?: number,
  to?: number,
): boolean =>
  (from === undefined || at >= from) && (to === undefined || at < to);

async function selectWorkouts(scope: HistoricalScope): Promise<Workout[]> {
  if (scope.kind === 'workout') {
    const workout = await db.workouts.get(scope.workoutId);
    return isArchived(workout) ? [workout] : [];
  }

  if (scope.kind === 'period') {
    const found = await db.workouts
      .where('startedAt')
      .between(scope.from, scope.to, true, false)
      .toArray();
    return found.filter(isArchived).sort(byOldestFirst);
  }

  if (scope.kind === 'exercise') {
    const rows = alive(
      await db.workoutExercises
        .where('exerciseId')
        .equals(scope.exerciseId)
        .toArray(),
    );
    const found = await db.workouts.bulkGet([
      ...new Set(rows.map((row) => row.workoutId)),
    ]);

    return found
      .filter(isArchived)
      .filter((workout) =>
        withinBounds(workout.startedAt, scope.from, scope.to),
      )
      .sort(byOldestFirst);
  }

  const found = await db.workouts
    .where('status')
    .equals('completed')
    .toArray();
  return found.filter(isArchived).sort(byOldestFirst);
}

async function loadWorkoutGraph(
  workoutIds: readonly string[],
): Promise<{
  rows: WorkoutExercise[];
  sets: WorkoutSet[];
}> {
  if (workoutIds.length === 0) return { rows: [], sets: [] };

  return db.transaction(
    'r',
    db.workoutExercises,
    db.workoutSets,
    async () => {
      const [rowsByWorkout, setsByWorkout] = await Promise.all([
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutExercises
              .where('workoutId')
              .equals(workoutId)
              .toArray(),
          ),
        ),
        Promise.all(
          workoutIds.map((workoutId) =>
            db.workoutSets.where('workoutId').equals(workoutId).toArray(),
          ),
        ),
      ]);

      return {
        rows: rowsByWorkout.flat(),
        sets: setsByWorkout.flat(),
      };
    },
  );
}

function projectSet(set: WorkoutSet): HistoricalSet {
  return {
    setType: set.setType,
    side: set.side,
    ...(set.weight === undefined ? {} : { weight: set.weight }),
    ...(set.reps === undefined ? {} : { reps: set.reps }),
    ...(set.durationSeconds === undefined
      ? {}
      : { durationSeconds: set.durationSeconds }),
    ...(set.distanceMeters === undefined
      ? {}
      : { distanceMeters: set.distanceMeters }),
    ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
  };
}

function projectExercise(
  row: WorkoutExercise,
  exercise: Exercise | undefined,
  sets: readonly WorkoutSet[],
): HistoricalExercise {
  return {
    exerciseId: row.exerciseId,
    ...resolveExerciseIdentity(row, exercise),
    ...(row.notes === undefined ? {} : { notes: row.notes }),
    sets: [...sets].sort(byOrder).map(projectSet),
  };
}

export async function listHistoricalWorkouts(
  scope: HistoricalScope,
): Promise<HistoricalWorkout[]> {
  const workouts = await selectWorkouts(scope);
  if (workouts.length === 0) return [];

  const workoutIds = workouts.map((workout) => workout.id);
  const { rows: allRows, sets: allSets } =
    await loadWorkoutGraph(workoutIds);

  const rows = alive(allRows).filter(
    (row) =>
      scope.kind !== 'exercise' ||
      row.exerciseId === scope.exerciseId,
  );
  const rowIds = new Set(rows.map((row) => row.id));

  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of allSets) {
    if (
      set.deletedAt !== 0 ||
      set.isCompleted !== 1 ||
      !rowIds.has(set.workoutExerciseId)
    ) {
      continue;
    }
    const list = setsPerRow.get(set.workoutExerciseId);
    if (list === undefined) setsPerRow.set(set.workoutExerciseId, [set]);
    else list.push(set);
  }

  const rowsPerWorkout = new Map<string, WorkoutExercise[]>();
  for (const row of rows) {
    const list = rowsPerWorkout.get(row.workoutId);
    if (list === undefined) rowsPerWorkout.set(row.workoutId, [row]);
    else list.push(row);
  }

  const found = await db.exercises.bulkGet([
    ...new Set(rows.map((row) => row.exerciseId)),
  ]);
  const library = new Map<string, Exercise>();
  for (const exercise of found) {
    if (exercise !== undefined) library.set(exercise.id, exercise);
  }

  return workouts
    .map((workout): HistoricalWorkout => ({
      workoutId: workout.id,
      name: workout.name,
      ...(workout.notes === undefined ? {} : { notes: workout.notes }),
      startedAt: workout.startedAt,
      ...(workout.startedTimezoneOffsetMinutes === undefined
        ? {}
        : {
            timezoneOffsetMinutes:
              workout.startedTimezoneOffsetMinutes,
          }),
      durationSeconds: workout.durationSeconds,
      exercises: (rowsPerWorkout.get(workout.id) ?? [])
        .sort(byOrder)
        .map((row) =>
          projectExercise(
            row,
            library.get(row.exerciseId),
            setsPerRow.get(row.id) ?? [],
          ),
        ),
    }))
    .filter(
      (workout) =>
        scope.kind !== 'exercise' || workout.exercises.length > 0,
    );
}
```

- [ ] **Step 6: Vérifier GREEN sur la seam repository**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/historicalWorkouts.test.ts
```

Expected: tous les cas issus de l’ancien repository et le test de priorité du
snapshot PASS.

- [ ] **Step 7: Réduire les interfaces des helpers purs**

Dans `src/lib/records.ts`, remplacer les deux signatures par :

```ts
export function setVolume(
  set: Pick<WorkoutSet, 'weight' | 'reps'>,
): number {
```

et :

```ts
export const isWorkingSet = (
  set: Pick<WorkoutSet, 'setType'>,
): boolean => set.setType !== 'warmup';
```

Dans `src/lib/volume.ts`, remplacer l’import `WorkoutSet` et `VolumeEntry` par :

```ts
export interface VolumeSet {
  setType: SetType;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

export interface VolumeEntry {
  set: VolumeSet;
  weightRole?: WeightRole;
}
```

Importer `SetType` depuis `@/data/types`. Le corps de `sessionTotals` ne change
pas.

Dans `src/lib/analytics/metrics.ts`, remplacer `WorkoutSet` par
`HistoricalSet` pour `AnalyticsSession.sets`, `best` et son callback :

```ts
import type { HistoricalSet } from '@/lib/historyProjection';

export interface AnalyticsSession {
  workoutId: string;
  startedAt: number;
  measurementType?: MeasurementType;
  sets: HistoricalSet[];
}
```

- [ ] **Step 8: Migrer les projections pures**

Remplacer entièrement `src/lib/analytics/sessions.ts` par :

```ts
import type { HistoricalWorkout } from '@/lib/historyProjection';
import type { AnalyticsSession } from './metrics';

export function toAnalyticsSessions(
  workouts: readonly HistoricalWorkout[],
): AnalyticsSession[] {
  return workouts.map((workout) => {
    const sets = workout.exercises.flatMap((exercise) => exercise.sets);
    const measurementType = workout.exercises[0]?.measurementType;

    return {
      workoutId: workout.workoutId,
      startedAt: workout.startedAt,
      ...(measurementType === undefined ? {} : { measurementType }),
      sets,
    };
  });
}
```

Dans `src/lib/analytics/volume.ts` :

- importer `HistoricalWorkout`;
- supprimer `resolveExerciseIdentity`;
- remplacer `ExportSource` par `HistoricalWorkout`;
- remplacer `sourceTonnage` par :

```ts
function sourceTonnage(workout: HistoricalWorkout): number {
  return sessionTotals(
    workout.exercises.flatMap((exercise) => {
      const weightRole =
        exercise.measurementType === undefined
          ? undefined
          : measurementShape(exercise.measurementType).weightRole;
      return exercise.sets.map((set) => ({ set, weightRole }));
    }),
  ).tonnage;
}
```

Dans `weeklyVolumeBuckets`, remplacer `source.workout` par `source`,
`sourceTonnage(source)` par `sourceTonnage(source)`, et le type du paramètre par
`readonly HistoricalWorkout[]`.

Dans `src/lib/analytics/muscles.ts` :

- importer `HistoricalSet` et `HistoricalWorkout`;
- supprimer `Exercise`, `Workout`, `WorkoutExercise`,
  `resolveExerciseIdentity` et `ExportSource`;
- typer `MuscleRow.sets` en `HistoricalSet[]`;
- remplacer `toMuscleRows` par :

```ts
export function toMuscleRows(
  workouts: readonly HistoricalWorkout[],
): MuscleRow[] {
  return workouts.flatMap((workout) =>
    workout.exercises.map((exercise) => ({
      ...(exercise.primaryMuscle === undefined
        ? {}
        : { primaryMuscle: exercise.primaryMuscle }),
      sets: exercise.sets,
    })),
  );
}
```

- [ ] **Step 9: Migrer l’export pur**

Dans `src/lib/export/types.ts` :

```ts
import type { HistoricalScope } from '@/lib/historyProjection';
export type ExportScope = HistoricalScope;
```

Supprimer la déclaration `ExportSource` et les imports `Exercise`, `Workout`,
`WorkoutExercise`, `WorkoutSet` devenus inutiles.

Dans `src/lib/export/projectCoachExport.ts` :

- importer `HistoricalExercise`, `HistoricalSet`, `HistoricalWorkout`;
- supprimer `WorkoutSet`, `resolveExerciseIdentity` et `ExportSource`;
- supprimer `identityOf`;
- typer `projectSet` avec `HistoricalSet`;
- remplacer `projectExercise` par :

```ts
function projectExercise(
  exercise: HistoricalExercise,
  options: ExportOptions,
): ExportExercise {
  const fields =
    exercise.measurementType === undefined
      ? ALL_FIELDS
      : measurementShape(exercise.measurementType).fields;
  const kept = options.includeWarmups
    ? exercise.sets
    : exercise.sets.filter((set) => set.setType !== 'warmup');

  return {
    ...(options.includeIds ? { id: exercise.exerciseId } : {}),
    ...(exercise.name === undefined ? {} : { name: exercise.name }),
    ...(exercise.measurementType === undefined
      ? {}
      : { measurementType: exercise.measurementType }),
    ...(exercise.primaryMuscle === undefined
      ? {}
      : { primaryMuscle: exercise.primaryMuscle }),
    ...(exercise.equipment === undefined
      ? {}
      : { equipment: exercise.equipment }),
    ...(options.includeNotes && exercise.notes?.trim()
      ? { notes: exercise.notes }
      : {}),
    sets: kept.map((set, index) =>
      projectSet(set, index + 1, fields),
    ),
  };
}
```

Remplacer `projectWorkout` par la même projection sur les champs plats :

```ts
function projectWorkout(
  source: HistoricalWorkout,
  options: ExportOptions,
): ExportWorkout {
  const offset =
    source.timezoneOffsetMinutes ?? localOffsetMinutes(source.startedAt);

  return {
    ...(options.includeIds ? { id: source.workoutId } : {}),
    name: source.name,
    ...(options.includeNotes && source.notes?.trim()
      ? { notes: source.notes }
      : {}),
    startedAt: isoWithOffset(source.startedAt, offset),
    localDate: localDateKey(source.startedAt, offset),
    timezoneOffsetMinutes: offset,
    durationSeconds: source.durationSeconds,
    totals: sessionTotals(
      source.exercises.flatMap((exercise) => {
        const weightRole =
          exercise.measurementType === undefined
            ? undefined
            : measurementShape(exercise.measurementType).weightRole;
        return exercise.sets.map((set) => ({ set, weightRole }));
      }),
    ),
    exercises: source.exercises.map((exercise) =>
      projectExercise(exercise, options),
    ),
  };
}
```

Typer `projectCoachExport` avec
`sources: readonly HistoricalWorkout[]`. Le calcul `workingSetCount` devient :

```ts
    workingSetCount: sources.reduce(
      (total, source) =>
        total +
        source.exercises.reduce(
          (perWorkout, exercise) =>
            perWorkout + exercise.sets.filter(isWorkingSet).length,
          0,
        ),
      0,
    ),
```

- [ ] **Step 10: Migrer les tests purs sans changer leurs attentes métier**

Dans les quatre fichiers :

- `src/lib/export/projectCoachExport.test.ts`;
- `src/lib/analytics/sessions.test.ts`;
- `src/lib/analytics/volume.test.ts`;
- `src/lib/analytics/muscles.test.ts`;

remplacer les fabriques de `Workout`, `WorkoutExercise`, `Exercise` et
`WorkoutSet` par les imports :

```ts
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
```

Construire les contradictions snapshot/bibliothèque directement comme identité
déjà résolue. Exemple pour sessions :

```ts
const sources = [
  historicalWorkout({
    startedAt: 5_000,
    exercises: [
      historicalExercise({
        measurementType: 'time_only',
        sets: [historicalSet({ durationSeconds: 45 })],
      }),
    ],
  }),
];
```

Supprimer des tests purs les trois cas « snapshot gagne / fallback bibliothèque /
identité absente » qui sont désormais couverts à la seam repository. Conserver
les tests de comportement aval : regroupement par séance, métriques, tonnage,
muscles, notes, warm-ups, numérotation et format de sortie.

Run:

```powershell
npm.cmd run test:run -- src/lib/export/projectCoachExport.test.ts src/lib/analytics/sessions.test.ts src/lib/analytics/volume.test.ts src/lib/analytics/muscles.test.ts src/lib/analytics/metrics.test.ts src/lib/volume.test.ts src/lib/records.test.ts
```

Expected: tous les tests ciblés PASS avec les mêmes valeurs fonctionnelles.

- [ ] **Step 11: Migrer les cinq écrans vers la seam canonique**

Dans chacun des cinq écrans, remplacer :

```ts
import { listExportSources } from '@/data/repositories/exportQueries';
```

par :

```ts
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
```

et remplacer les appels par `listHistoricalWorkouts`.

Dans `WeeklySessionsScreen.tsx` et `MuscleBalanceScreen.tsx`, remplacer le mapping
des dates par :

```ts
(sources ?? []).map((source) => ({
  startedAt: source.startedAt,
  ...(source.timezoneOffsetMinutes === undefined
    ? {}
    : { timezoneOffsetMinutes: source.timezoneOffsetMinutes }),
}))
```

Dans `WeeklyVolumeScreen.tsx`, remplacer :

```ts
import type { ExportSource } from '@/lib/export/types';
```

par :

```ts
import type { HistoricalWorkout } from '@/lib/historyProjection';
```

et typer `ResolvedVolumeQuery.sources` en `HistoricalWorkout[]`.

Dans `HistoryDetailScreen.tsx`, conserver la construction de `scope` et remplacer
uniquement la lecture :

```ts
const sources = await listHistoricalWorkouts(scope);
```

Dans `ExerciseAnalyticsScreen.tsx`, remplacer uniquement la lecture repository ;
`toAnalyticsSessions` conserve son rôle.

- [ ] **Step 12: Migrer le benchmark et les commentaires de seam**

Dans `src/data/repositories/history.bench.ts`, importer et appeler
`listHistoricalWorkouts`.

Dans `src/lib/analytics/periods.ts` et les commentaires des écrans, remplacer
`ExportScope`/`listExportSources` par
`HistoricalScope`/`listHistoricalWorkouts`. Ne modifier aucun texte UI.

- [ ] **Step 13: Supprimer l’ancienne interface**

Supprimer :

```text
src/data/repositories/exportQueries.ts
src/data/repositories/exportQueries.test.ts
```

Run:

```powershell
rg -n "ExportSource|listExportSources|exportQueries" src
```

Expected: aucune occurrence.

- [ ] **Step 14: Vérifier le typecheck avant les tests**

Run:

```powershell
npm.cmd run typecheck
```

Expected: code 0. Toute erreur doit être résolue en adaptant le consommateur à
`HistoricalWorkout`, jamais en réintroduisant les entités Dexie dans le DTO.

- [ ] **Step 15: Vérifier toutes les preuves comportementales**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/historicalWorkouts.test.ts src/lib/export/projectCoachExport.test.ts src/lib/analytics/sessions.test.ts src/lib/analytics/metrics.test.ts src/lib/analytics/volume.test.ts src/lib/analytics/muscles.test.ts
npm.cmd run test:run
```

Expected: tests ciblés puis suite complète PASS.

- [ ] **Step 16: Vérifier l’absence de régression de performance**

Run:

```powershell
npm.cmd run bench:history
```

Expected: `244 workouts`, preflight sous `5_000 ms`, code 0.

- [ ] **Step 17: Vérifier toutes les portes**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: cinq codes de sortie 0.

- [ ] **Step 18: Inspecter le diff structurel**

Run:

```powershell
git diff --stat HEAD
git diff HEAD -- src/data/repositories src/lib/historyProjection.ts src/lib/export src/lib/analytics src/features/analytics src/features/history/HistoryDetailScreen.tsx
```

Vérifier :

- aucune modification de `src/data/db.ts`;
- aucun `deletedAt`, `createdAt` ou `updatedAt` dans `HistoricalWorkout`;
- aucune seconde interface de compatibilité ;
- aucune chaîne française ajoutée dans un composant ;
- aucune règle métier supprimée pour faire passer un test.

- [ ] **Step 19: Commiter la refactorisation seule**

```powershell
git add -- src/data/repositories src/lib src/features src/test/historicalWorkout.ts
git commit -m "refactor: approfondit la projection historique"
```

---

### Task 4: Consigner les preuves et préparer le checkpoint téléphone

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: commits `test:`, `fix:` et `refactor:` ainsi que les sorties fraîches des portes.
- Produces: mémoire de passation sans changement applicatif.

- [ ] **Step 1: Ajouter l’entrée de session en tête de `PROGRESS.md`**

Ajouter une nouvelle section datée du 2026-07-29 avec ce contenu :

```markdown
**Dernière mise à jour :** 2026-07-29 (**projection historique — P0 corrigé,
module approfondi**). La lecture annuelle bornée respecte désormais la porte
opt-in de 5 000 ms sur le dataset de référence de 2 000 séances. Le schéma Dexie,
les données et les comportements visibles n'ont pas changé.

**Deux commits applicatifs séparés.** Le correctif remplace les grands `anyOf`
par des lectures `workoutId` petites, indexées et bornées. La refactorisation
fait de `listHistoricalWorkouts` la seam unique : sélection, soft-delete,
validation, ordre et identité historique restent derrière le repository ;
exports et analytics ne reçoivent plus les entités Dexie.

**Preuves.** Le benchmark annuel opt-in respecte la porte de 5 000 ms ; lint,
typecheck, tests unitaires et build de production sont verts. La baseline lente
reste versionnée dans `docs/baselines/2026-07-28-refactor-baseline.md`.

**Checkpoint téléphone :** ouvrir Historique → Analyses et comparer les périodes
4, 12, 26, 52 semaines et Tout. Vérifier ensuite une séance contenant un
exercice renommé ou supprimé, puis partager son export Markdown : nom historique,
totaux, séries et dates doivent être identiques à avant la refactorisation.
```

- [ ] **Step 2: Relancer les preuves finales après la documentation**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
npm.cmd run bench:history
git diff --check
git status --short
```

Expected: toutes les portes et le benchmark code 0 ; seul `PROGRESS.md` est
modifié avant le commit documentaire.

- [ ] **Step 3: Commiter la passation**

```powershell
git add -- PROGRESS.md
git commit -m "docs: consigne la projection historique approfondie"
```

- [ ] **Step 4: Appliquer la fin de branche**

Invoquer `finishing-a-development-branch`, vérifier l’état Git et présenter les
options autorisées par le projet. Le projet impose `master`; ne pas pousser et ne
pas créer de PR sans demande explicite de l’utilisateur.
