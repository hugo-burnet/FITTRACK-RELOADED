# Lot 2 — Couche de données

**Objectif :** la base IndexedDB, les repositories et le catalogue d'exercices. C'est le contrat
consommé par tous les lots suivants — une erreur ici se paie dix fois.

**Dépend de :** Lot 0 (le Lot 1 peut être fait en parallèle, aucune dépendance croisée).
**Budget :** 2 sessions.
**Référence obligatoire :** `docs/plans/01-ARCHITECTURE.md` §3 (typage IndexedDB), §4 (modèle), §5
(requêtes critiques).

## Les trois pièges de ce lot

1. **IndexedDB n'indexe ni les booléens ni `null`.** Un champ indexé à `null` fait disparaître
   l'enregistrement de l'index : il existe, mais aucune requête ne le trouve. D'où `0 | 1` et
   `deletedAt: 0`. Relire §3 de l'architecture avant d'écrire la moindre ligne.
2. **Le seed doit être idempotent.** Il s'exécute à chaque démarrage et ne doit ni dupliquer le
   catalogue, ni écraser les modifications de l'utilisateur (notes, repos par défaut).
3. **Tous les tests doivent repartir d'une base vierge.** Sinon ils passent seuls et échouent en
   suite, ce qui fait perdre un temps considérable à en chercher la cause.

---

## Tâche 1 — Schéma et types

**Fichiers :** créer `src/data/types.ts`, `src/data/db.ts` · modifier `src/test/setup.ts`

- [ ] **Étape 1.1 — Créer `src/data/types.ts`** : recopier **intégralement** le §4.1 et §4.2 de
      `docs/plans/01-ARCHITECTURE.md`. Ne rien inventer, ne rien omettre — y compris les champs des
      lots ultérieurs (`ProgressPhoto`, `PersonalRecord`, `BodyMeasurement`). Les déclarer
      maintenant coûte zéro et évite une migration plus tard.

- [ ] **Étape 1.2 — Créer `src/data/db.ts`**

```ts
import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyMeasurement, Exercise, PersonalRecord, ProgressPhoto, Routine, RoutineExercise,
  RoutineFolder, RoutineSet, Setting, Workout, WorkoutExercise, WorkoutSet,
} from './types';

export interface PhotoBlob { key: string; blob: Blob }

export class FitTrackDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  routineFolders!: EntityTable<RoutineFolder, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  routineSets!: EntityTable<RoutineSet, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  bodyMeasurements!: EntityTable<BodyMeasurement, 'id'>;
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>;
  photoBlobs!: EntityTable<PhotoBlob, 'key'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('fittrack');
    this.version(1).stores({
      exercises:        'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
      routineFolders:   'id, order, updatedAt, deletedAt',
      routines:         'id, folderId, order, updatedAt, deletedAt',
      routineExercises: 'id, routineId, [routineId+order], deletedAt',
      routineSets:      'id, routineExerciseId, [routineExerciseId+order], deletedAt',
      workouts:         'id, status, startedAt, routineId, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
      workoutSets:      'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
      personalRecords:  'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
      bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
      progressPhotos:   'id, takenAt, deletedAt',
      photoBlobs:       'key',
      settings:         'key',
    });
  }
}

export const db = new FitTrackDB();
```

> **Règle de migration pour toute la suite du projet :** ne **jamais** modifier le bloc
> `version(1)`. Pour changer le schéma, ajouter un `this.version(2).stores({...}).upgrade(...)`.
> Modifier une version déjà livrée corrompt les bases des appareils qui l'ont déjà.

- [ ] **Étape 1.3 — Activer IndexedDB en test** dans `src/test/setup.ts`

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

- [ ] **Étape 1.4 — Créer l'utilitaire de réinitialisation `src/test/resetDb.ts`**

```ts
import { db } from '@/data/db';

/** À appeler dans un beforeEach de tout test touchant la base. */
export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}
```

- [ ] **Étape 1.5 — Commit** : `git commit -m "feat(lot-02): schéma Dexie et types de données"`

---

## Tâche 2 — Helpers de repository

**Fichiers :** créer `src/data/repositories/base.ts`, `src/data/repositories/base.test.ts`

**Interfaces produites** (utilisées par tous les repositories des lots suivants) :

```ts
function newEntity<T extends Syncable>(data: Omit<T, keyof Syncable>): T;
function touch<T extends Syncable>(entity: T, changes: Partial<T>): T;
async function softDelete(table: EntityTable<any, 'id'>, id: string): Promise<void>;
function alive<T extends { deletedAt: number }>(rows: T[]): T[];
```

- [ ] **Étape 2.1 — Écrire les tests d'abord**

```ts
// src/data/repositories/base.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { alive, newEntity, softDelete, touch } from './base';
import type { Exercise } from '@/data/types';

const sample = () =>
  newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  });

describe('base repository', () => {
  beforeEach(resetDb);

  it('génère un id, des dates de création et un deletedAt à 0', () => {
    const e = sample();
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.createdAt).toBeGreaterThan(0);
    expect(e.updatedAt).toBe(e.createdAt);
    expect(e.deletedAt).toBe(0); // 0, PAS null — cf. architecture §3
  });

  it('met à jour updatedAt sans toucher createdAt', async () => {
    const e = sample();
    const updated = touch(e, { name: 'Développé incliné' });
    expect(updated.name).toBe('Développé incliné');
    expect(updated.createdAt).toBe(e.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(e.createdAt);
  });

  it('supprime logiquement sans effacer la ligne', async () => {
    const e = sample();
    await db.exercises.add(e);
    await softDelete(db.exercises, e.id);

    const row = await db.exercises.get(e.id);
    expect(row).toBeDefined();            // la ligne existe toujours
    expect(row!.deletedAt).toBeGreaterThan(0);
  });

  it('filtre les entités supprimées', () => {
    const kept = { deletedAt: 0 };
    const removed = { deletedAt: Date.now() };
    expect(alive([kept, removed])).toEqual([kept]);
  });
});
```

- [ ] **Étape 2.2 — Lancer** : `npm run test:run` → échec attendu, `./base` n'existe pas.

- [ ] **Étape 2.3 — Implémenter `src/data/repositories/base.ts`**

```ts
import type { EntityTable } from 'dexie';
import type { Syncable } from '@/data/types';

export function newEntity<T extends Syncable>(data: Omit<T, keyof Syncable>): T {
  const now = Date.now();
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: 0 } as T;
}

export function touch<T extends Syncable>(entity: T, changes: Partial<T>): T {
  return { ...entity, ...changes, updatedAt: Date.now() };
}

export async function softDelete<T extends Syncable>(
  table: EntityTable<T, 'id'>, id: string,
): Promise<void> {
  const now = Date.now();
  await table.update(id, { deletedAt: now, updatedAt: now } as Partial<T>);
}

export function alive<T extends { deletedAt: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt === 0);
}
```

- [ ] **Étape 2.4 — Relancer** → 4 tests passent.
- [ ] **Étape 2.5 — Commit** : `git commit -m "feat(lot-02): helpers de repository avec soft delete"`

---

## Tâche 3 — Catalogue d'exercices

**Fichiers :** créer `src/data/seed/exercises.json`, `src/data/seed/seedDatabase.ts` + son test

- [ ] **Étape 3.1 — Choisir la source du catalogue**

Deux options, dans cet ordre :
1. Jeu de données libre existant (p. ex. `yuhonas/free-exercise-db`, ~800 exercices avec images).
   **Vérifier la licence avant intégration** et écrire le verdict dans `PROGRESS.md`. Si la licence
   n'est pas clairement permissive, passer à l'option 2 sans hésiter.
2. Générer ~150 exercices couvrant tous les `MuscleGroup` et tous les `Equipment`.

Ne pas bloquer le lot sur ce choix : 150 exercices suffisent pour un usage personnel, et l'utilisateur
peut créer les siens sans limite (RF-08).

- [ ] **Étape 3.2 — Format de `exercises.json`** — un tableau d'objets sans les champs `Syncable`
      (ils sont générés à l'insertion), avec un `slug` **stable** qui sert de clé d'idempotence :

```json
[
  {
    "slug": "barbell-bench-press",
    "name": "Développé couché (barre)",
    "primaryMuscle": "chest",
    "secondaryMuscles": ["triceps", "shoulders"],
    "equipment": "barbell",
    "measurementType": "weight_reps",
    "isUnilateral": 0
  }
]
```

> Le `slug` est indispensable : sans identifiant stable, un seed relancé après une mise à jour du
> catalogue ne peut pas distinguer « nouvel exercice » de « exercice déjà présent » et duplique tout.
> Ajouter `slug?: string` à l'interface `Exercise` (non indexé).

- [ ] **Étape 3.3 — Écrire les tests du seed d'abord**

```ts
// src/data/seed/seedDatabase.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { seedDatabase } from './seedDatabase';

describe('seedDatabase', () => {
  beforeEach(resetDb);

  it('insère le catalogue au premier lancement', async () => {
    await seedDatabase();
    expect(await db.exercises.count()).toBeGreaterThan(50);
  });

  it("ne duplique rien lorsqu'il est relancé", async () => {
    await seedDatabase();
    const first = await db.exercises.count();
    await seedDatabase();
    expect(await db.exercises.count()).toBe(first);
  });

  it("préserve les modifications de l'utilisateur", async () => {
    await seedDatabase();
    const exercise = await db.exercises.orderBy('name').first();
    await db.exercises.update(exercise!.id, { userNotes: 'siège position 4' });

    await seedDatabase();

    const after = await db.exercises.get(exercise!.id);
    expect(after!.userNotes).toBe('siège position 4');
  });

  it("n'écrase pas les exercices personnalisés", async () => {
    await seedDatabase();
    await db.exercises.add(
      newEntity<Exercise>({
        name: 'Mon exercice à moi',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'machine',
        measurementType: 'weight_reps',
        isCustom: 1,
        isUnilateral: 0,
      }),
    );

    await seedDatabase();

    const custom = await db.exercises.where('isCustom').equals(1).toArray();
    expect(custom).toHaveLength(1);
  });
});
```

> `where('isCustom').equals(1)` fonctionne parce que `isCustom` est un `0 | 1` et non un booléen.
> Avec `isCustom: true`, cette requête lèverait une `DataError` d'IndexedDB — c'est la §3 de
> l'architecture en action.

> Le troisième test est le plus important du lot. Un seed qui écrase les notes personnelles à
> chaque démarrage détruit silencieusement des données de l'utilisateur — le genre de bug qu'on ne
> remarque qu'après des semaines.

- [ ] **Étape 3.4 — Implémenter `seedDatabase()`** : lire le JSON, charger les slugs déjà présents,
      n'insérer **que** les manquants. Jamais de `bulkPut` sur des lignes existantes.

- [ ] **Étape 3.5 — Appeler le seed au démarrage** dans `main.tsx`, avant le rendu, avec un écran
      de chargement le temps de la résolution. Gérer l'échec : si le seed plante, l'app doit
      démarrer quand même avec un bandeau d'erreur, jamais rester bloquée sur un écran vide.

- [ ] **Étape 3.6 — Tests verts + commit** : `git commit -m "feat(lot-02): catalogue d'exercices idempotent"`

---

## Tâche 4 — Repository des exercices

**Fichiers :** `src/data/repositories/exercises.ts` + son test

**Interfaces produites** (consommées par le Lot 3) :

```ts
function listExercises(filter?: { search?: string; muscle?: MuscleGroup; equipment?: Equipment }): Promise<Exercise[]>;
function getExercise(id: string): Promise<Exercise | undefined>;
function createCustomExercise(data: Omit<Exercise, keyof Syncable | 'isCustom'>): Promise<Exercise>;
function updateExercise(id: string, changes: Partial<Exercise>): Promise<void>;
function deleteExercise(id: string): Promise<void>;
function normalizeSearch(input: string): string;
```

- [ ] **Étape 4.1 — Tester la recherche insensible aux accents d'abord**

```ts
it('trouve un exercice accentué sans saisir les accents', async () => {
  await seedDatabase();
  const results = await listExercises({ search: 'developpe couche' });
  expect(results.some((e) => e.name.includes('Développé couché'))).toBe(true);
});

it('ignore la casse', async () => {
  await seedDatabase();
  expect(await listExercises({ search: 'SQUAT' })).not.toHaveLength(0);
});

it('exclut les exercices supprimés', async () => {
  const created = await createCustomExercise({ /* … */ });
  await deleteExercise(created.id);
  const results = await listExercises({ search: created.name });
  expect(results).toHaveLength(0);
});
```

- [ ] **Étape 4.2 — Implémenter `normalizeSearch`**

```ts
export function normalizeSearch(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
```

`normalize('NFD')` décompose « é » en « e » + accent, la regex retire les accents. Sans ça, taper
« developpe » sur un clavier de téléphone ne trouve jamais « Développé » — friction garantie en
salle.

- [ ] **Étape 4.3 — Implémenter le reste du repository.** `createCustomExercise` force
      `isCustom: 1`. Aucune limite de nombre (règle non négociable n°1).
- [ ] **Étape 4.4 — Tests verts + commit.**

---

## Tâche 5 — Repository des séances et requête « valeur précédente »

**Fichiers :** `src/data/repositories/workouts.ts` + son test

**Interfaces produites** (consommées par les Lots 5, 6, 7) :

```ts
function getActiveWorkout(): Promise<Workout | undefined>;
function startWorkout(routineId: string, name: string): Promise<Workout>;
function addSet(workoutExerciseId: string, data: Partial<WorkoutSet>): Promise<WorkoutSet>;
function completeSet(setId: string, values: { weight?: number; reps?: number; rpe?: number }): Promise<void>;
function finishWorkout(workoutId: string): Promise<void>;
/** Suppression logique EN CASCADE : workout + workoutExercises + workoutSets. */
function deleteWorkout(workoutId: string): Promise<void>;
function getLastPerformance(exerciseId: string): Promise<WorkoutSet[]>;
```

- [ ] **Étape 5.1 — Créer la fabrique de données de test `src/test/factories.ts`**

Sans elle, chaque test réécrirait 30 lignes de mise en place et deviendrait illisible. Elle sera
réutilisée par tous les lots suivants.

```ts
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/data/types';

/** Timestamp du jour J relatif à une base fixe — rend les tests déterministes. */
const BASE = Date.UTC(2026, 0, 1);
export const day = (n: number): number => BASE + n * 86_400_000;

/** Crée une séance terminée complète : workout + workoutExercise + séries validées. */
export async function seedWorkout(input: {
  exerciseId: string;
  performedAt: number;
  /** [poids, répétitions] par série */
  sets: [number, number][];
}): Promise<Workout> {
  const workout = newEntity<Workout>({
    routineId: '', name: 'Séance de test', status: 'completed',
    startedAt: input.performedAt, endedAt: input.performedAt + 3_600_000,
    durationSeconds: 3600,
  });
  const workoutExercise = newEntity<WorkoutExercise>({
    workoutId: workout.id, exerciseId: input.exerciseId, order: 0, supersetGroup: 0,
  });
  const sets = input.sets.map(([weight, reps], index) =>
    newEntity<WorkoutSet>({
      workoutExerciseId: workoutExercise.id,
      exerciseId: input.exerciseId,
      workoutId: workout.id,
      order: index, setType: 'normal', side: 'both',
      weight, reps, isCompleted: 1, performedAt: input.performedAt,
    }),
  );

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await db.workouts.add(workout);
    await db.workoutExercises.add(workoutExercise);
    await db.workoutSets.bulkAdd(sets);
  });

  return workout;
}
```

- [ ] **Étape 5.2 — Tester `getLastPerformance`** — c'est la requête du RF-19, celle qui s'affiche
      à chaque ligne de l'écran de séance.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetDb } from '@/test/resetDb';
import { day, seedWorkout } from '@/test/factories';
import { newEntity } from './base';
import { deleteWorkout, getLastPerformance, startWorkout } from './workouts';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';

describe('getLastPerformance', () => {
  beforeEach(resetDb);

  it("retourne les séries de la dernière séance où l'exercice a été fait", async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5], [100, 5]] });
    await seedWorkout({ exerciseId: 'bench', performedAt: day(8), sets: [[102.5, 5], [102.5, 4]] });

    const result = await getLastPerformance('bench');

    expect(result).toHaveLength(2);
    expect(result[0]!.weight).toBe(102.5); // la plus récente, pas la première
  });

  it("ne mélange pas les exercices", async () => {
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
    await seedWorkout({ exerciseId: 'squat', performedAt: day(2), sets: [[140, 5]] });

    const result = await getLastPerformance('bench');
    expect(result).toHaveLength(1);
    expect(result[0]!.weight).toBe(100);
  });

  it('ignore les séries non validées', async () => {
    // performedAt = 0 → doit être exclue par la borne basse de l'index [exerciseId+performedAt]
    await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });

    const workout = await startWorkout('', 'Séance en cours');
    const we = newEntity<WorkoutExercise>({
      workoutId: workout.id, exerciseId: 'bench', order: 0, supersetGroup: 0,
    });
    await db.workoutExercises.add(we);
    await db.workoutSets.add(
      newEntity<WorkoutSet>({
        workoutExerciseId: we.id, exerciseId: 'bench', workoutId: workout.id,
        order: 0, setType: 'normal', side: 'both',
        weight: 999, reps: 1, isCompleted: 0, performedAt: 0,
      }),
    );

    const result = await getLastPerformance('bench');
    expect(result.every((s) => s.weight !== 999)).toBe(true);
  });

  it("retourne un tableau vide si l'exercice n'a jamais été fait", async () => {
    expect(await getLastPerformance('jamais-fait')).toEqual([]);
  });

  it('ignore les séances supprimées', async () => {
    const workout = await seedWorkout({
      exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]],
    });
    await deleteWorkout(workout.id);
    expect(await getLastPerformance('bench')).toEqual([]);
  });
});
```

> Le dernier test impose que `deleteWorkout` propage la suppression logique aux `workoutExercises`
> et aux `workoutSets` de la séance. Sans cette cascade, une séance supprimée continuerait
> d'alimenter la « valeur précédente » et les records — donnée fantôme très difficile à diagnostiquer
> des semaines plus tard.

- [ ] **Étape 5.3 — Implémenter** en suivant §5.1 de l'architecture (index composé
      `[exerciseId+performedAt]`, borne basse à `1` pour exclure les séries non validées).

- [ ] **Étape 5.4 — Tester la reprise de séance (RF-25)**

```ts
it("retrouve la séance active après un redémarrage de l'application", async () => {
  const workout = await startWorkout('', 'Séance libre');
  await db.close();   // simule la fermeture de l'app
  await db.open();
  const active = await getActiveWorkout();
  expect(active?.id).toBe(workout.id);
});

it("n'a plus de séance active après clôture", async () => {
  const workout = await startWorkout('', 'Séance libre');
  await finishWorkout(workout.id);
  expect(await getActiveWorkout()).toBeUndefined();
});
```

- [ ] **Étape 5.5 — Tests verts + commit.**

---

## Tâche 6 — Écran de debug

**Fichiers :** `src/features/settings/DebugScreen.tsx`, route `#/settings/debug`

- [ ] **Étape 6.1 — Créer l'écran** : nombre de lignes par table, liste des 20 derniers exercices,
      espace de stockage utilisé (`navigator.storage.estimate()`), boutons **Réinitialiser la base**
      et **Relancer le seed** (avec confirmation).
- [ ] **Étape 6.2 — Le lier depuis les réglages**, discrètement en bas de page.

> Cet écran vaut son coût dès la première fois où une donnée « disparaît » : il répond en 5 secondes
> à la question « est-ce la base ou l'affichage ? ». Il restera dans l'app, c'est un outil de
> diagnostic, pas de la dette.

- [ ] **Étape 6.3 — Vérification complète, mise à jour de `PROGRESS.md`, commit, push.**

```bash
npm run typecheck && npm run test:run && npm run build
```

---

## ✅ Checkpoint utilisateur

- [ ] `npm run test:run` : tous les tests passent (~20 tests attendus sur ce lot).
- [ ] Sur `#/settings/debug` depuis ton téléphone : le nombre d'exercices est cohérent, la liste
      s'affiche.
- [ ] Tu **fermes complètement** l'onglet/l'app, tu la rouvres : les données sont toujours là.
- [ ] Tu recharges 3 fois de suite : le nombre d'exercices **ne bouge pas** (seed idempotent).
- [ ] Tu cherches « developpe » **sans accent** dans la console (`listExercises`) et tu trouves
      « Développé couché ».

Quand c'est validé : **Lot 3 — Bibliothèque d'exercices**. À partir de là, l'agent génère le plan
détaillé du lot en début de session à partir du cadrage de `00-ROADMAP.md`.
