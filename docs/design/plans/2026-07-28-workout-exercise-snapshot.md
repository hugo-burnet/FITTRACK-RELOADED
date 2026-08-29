# Workout Exercise Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Figer sur chaque `WorkoutExercise` le nom, le type de mesure, le muscle principal et le matériel de son exercice au moment où la ligne entre dans la séance, et écrire le fuseau d'origine sur chaque `Workout`.

**Architecture:** Cf. `docs/design/specs/2026-07-28-workout-exercise-snapshot-design.md`. Champs plats optionnels, aucun index, `version(2).upgrade()` pour le rattrapage. L'instantané est écrit quand l'`exerciseId` de la ligne est écrit, jamais rafraîchi ensuite.

**Tech Stack:** TypeScript strict, Dexie 4, Vitest, fake-indexeddb.

## Global Constraints

- Aucun champ indexé ajouté : `stores` reste identique en `version(2)`.
- Aucun consommateur rebranché sur l'instantané dans ce lot.
- Aucune correction opportuniste — en particulier, ne pas toucher au reformatage non committé de `src/data/repositories/history.ts`.
- Pas de couche de validation numérique ni d'audit de cohérence.

---

### Task 1: Le type et les deux fonctions pures

**Files:**
- Modify: `src/data/types.ts`
- Create: `src/lib/timezone.ts`, `src/lib/timezone.test.ts`
- Create: `src/data/repositories/exerciseSnapshot.ts`, `src/data/repositories/exerciseSnapshot.test.ts`

**Interfaces:**
- Produces: `ExerciseSnapshot`, `snapshotOf(exercise: Exercise | undefined): ExerciseSnapshot`, `loadExerciseSnapshots(ids: readonly string[]): Promise<Map<string, ExerciseSnapshot>>`, `localOffsetMinutes(at: number): number`.

- [ ] Ajouter les quatre champs optionnels à `WorkoutExercise` et `startedTimezoneOffsetMinutes` à `Workout`, chacun commenté.
- [ ] Écrire `timezone.test.ts` : offset positif à l'est de UTC, valeur cohérente avec `getTimezoneOffset`.
- [ ] Écrire `exerciseSnapshot.test.ts` : exercice présent → quatre champs ; `undefined` → objet vide ; exercice soft-deleted → quatre champs quand même.
- [ ] Implémenter les deux modules, constater les tests verts.

### Task 2: Les quatre points de création

**Files:**
- Modify: `src/data/repositories/workoutLifecycle.ts`, `src/data/repositories/workoutExercises.ts`, `src/data/repositories/hevyWorkoutEntities.ts`, `src/data/repositories/history.ts`
- Modify: `src/data/repositories/workouts.test.ts`, `src/data/repositories/hevyImport.test.ts`, `src/data/repositories/history.test.ts`

- [ ] `startWorkoutFromRoutine` : réutiliser le `bulkGet` déjà fait pour `defaultRestSeconds`, en garder l'`Exercise` entier au lieu du seul repos ; écrire l'instantané et `startedTimezoneOffsetMinutes`.
- [ ] `addWorkoutExercise` : `exercise` est déjà lu, écrire l'instantané.
- [ ] `buildHevyWorkoutEntities` : l'`Exercise` résolu est déjà en main, écrire l'instantané et l'offset de chaque séance importée.
- [ ] `saveArchivedWorkout` : charger les exercices du brouillon, écrire l'instantané **uniquement** sur une ligne créée ou dont l'`exerciseId` change ; conserver l'existant sinon.
- [ ] Un test par point de création, plus le test de non-régression : renommer l'exercice après la séance ne change pas l'instantané.

### Task 3: La migration

**Files:**
- Modify: `src/data/db.ts`

- [ ] Ajouter `this.version(2).upgrade(...)` sans `stores`, backfill des deux tables.
- [ ] Vérifier qu'un `resetDb` de test ouvre bien la base en version 2.

### Task 4: Portes et clôture

- [ ] `npm.cmd run lint`, `typecheck`, `test:run`, `build` — les quatre verts.
- [ ] Mettre à jour `PROGRESS.md`.
- [ ] Commiter la spec et le plan (`docs(lot-08)`), puis l'implémentation (`feat(lot-08)`).
