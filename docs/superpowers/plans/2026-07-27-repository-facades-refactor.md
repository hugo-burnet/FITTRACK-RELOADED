# Repository Facades Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découper `workouts.ts` et `routines.ts` en modules spécialisés de moins de 300 lignes sans modifier leur API publique ni leur comportement.

**Architecture:** Les deux fichiers existants deviennent des façades à réexports explicites. Les corps de fonctions sont déplacés sans réécriture dans huit modules internes organisés par responsabilité ; tous les consommateurs et tests continuent d’importer les façades historiques.

**Tech Stack:** TypeScript 6 strict, Dexie 4, Vitest 4, ESLint, Vite 8.

## Global Constraints

- La refactorisation est strictement structurelle : aucune fonctionnalité ni correction opportuniste.
- `src/data/repositories/history.ts` et `src/i18n/fr.ts` contiennent des changements non committés à préserver exactement.
- Les contrats publics, erreurs, valeurs par défaut et types de retour restent identiques.
- Les tables, portées, ordre des lectures et ordre des écritures de chaque transaction Dexie restent identiques.
- Les composants, tests et autres repositories continuent d’importer `workouts.ts` et `routines.ts`.
- Les tests existants ne sont ni déplacés ni modifiés.
- Les nouveaux modules restent internes à `src/data/repositories`.
- Chaque module spécialisé vise moins de 300 lignes.
- Aucun accès à la base n’est ajouté hors de `src/data/repositories`.

---

### Task 1: Figer la base de comparaison

**Files:**
- Inspect: `src/data/repositories/history.ts`
- Inspect: `src/i18n/fr.ts`
- Inspect: `src/data/repositories/workouts.ts`
- Inspect: `src/data/repositories/routines.ts`

**Interfaces:**
- Consumes: état Git existant et suites de tests actuelles.
- Produces: empreintes des deux changements 07B à comparer après la refactorisation et preuve que la base de tests est verte avant extraction.

- [ ] **Step 1: Relever l’état Git sans le modifier**

Run:

```powershell
git status --short
git diff -- src/data/repositories/history.ts | git hash-object --stdin
git diff -- src/i18n/fr.ts | git hash-object --stdin
```

Expected:

- `history.ts` et `fr.ts` sont modifiés mais non indexés ;
- noter les deux empreintes affichées pour la Task 4 ;
- `.agents/`, `.codex/` et `AGENTS.md` peuvent rester non suivis.

- [ ] **Step 2: Vérifier les suites ciblées avant la coupe**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/workouts.test.ts src/data/repositories/routines.test.ts src/data/repositories/history.test.ts src/data/seed/routineTemplates.test.ts
```

Expected: PASS. Le nombre exact dépend des changements 07B déjà présents, mais aucune suite ne doit échouer.

- [ ] **Step 3: Capturer les APIs publiques actuelles**

Run:

```powershell
rg -n "^export (async )?(function|type|interface)" src/data/repositories/workouts.ts src/data/repositories/routines.ts
```

Expected: la liste correspond exactement aux symboles réexportés dans les façades des Tasks 2 et 3.

---

### Task 2: Découper le repository des séances

**Files:**
- Create: `src/data/repositories/workoutLifecycle.ts`
- Create: `src/data/repositories/workoutExercises.ts`
- Create: `src/data/repositories/workoutSets.ts`
- Create: `src/data/repositories/workoutDetail.ts`
- Modify: `src/data/repositories/workouts.ts`
- Test unchanged: `src/data/repositories/workouts.test.ts`
- Test unchanged: `src/data/repositories/history.test.ts`

**Interfaces:**
- Consumes: `db`, les types de `src/data/types.ts`, `resolveRestSeconds`, `moveItem`, `normalizeSupersets`, `WarmupSetSuggestion`, `alive`, `newEntity`, `softDelete`, `touch` et `getLastPerformance`.
- Produces: la même API publique depuis `@/data/repositories/workouts`, avec les symboles listés dans la façade ci-dessous.

- [ ] **Step 1: Créer `workoutLifecycle.ts` par déplacement mécanique**

Déplacer sans modifier les commentaires, signatures ni corps :

```ts
getActiveWorkout
startWorkout
startWorkoutFromRoutine
updateWorkout
finishWorkout
discardWorkout
deleteWorkout
```

Le fichier possède uniquement les imports nécessaires à ces fonctions :

```ts
import { db } from '@/data/db';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveRestSeconds } from '@/lib/rest';
import { alive, newEntity, softDelete, touch } from './base';
```

Conserver un helper privé local :

```ts
const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;
```

Ne pas déplacer `getActiveWorkout` vers un store et ne pas modifier les portées des transactions.

- [ ] **Step 2: Créer `workoutExercises.ts` par déplacement mécanique**

Déplacer sans modifier les commentaires, signatures ni corps :

```ts
rewriteOrder
addWorkoutExercise
updateWorkoutExercise
removeWorkoutExercise
reorderWorkoutExercises
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveRestSeconds } from '@/lib/rest';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';
```

`rewriteOrder` reste privé dans ce module. L’appel effectué depuis la transaction de `removeWorkoutExercise` doit rester au même endroit dans le corps de fonction.

- [ ] **Step 3: Créer `workoutSets.ts` par déplacement mécanique**

Déplacer sans modifier les deux types publics :

```ts
export type NewSetValues = Partial<
  Omit<WorkoutSet, keyof Syncable | 'workoutExerciseId' | 'exerciseId' | 'workoutId'>
>;

export type SetValues = Pick<
  WorkoutSet,
  'weight' | 'reps' | 'durationSeconds' | 'distanceMeters' | 'rpe'
>;
```

Déplacer sans modifier les commentaires, signatures ni corps :

```ts
liveSetsOf
appendSet
addSet
duplicateLastSet
insertWarmupSets
updateSetValues
updateSetType
completeSet
uncompleteSet
deleteSet
restoreSet
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { SetType, Syncable, WorkoutSet } from '@/data/types';
import type { WarmupSetSuggestion } from '@/lib/warmup';
import { alive, newEntity, softDelete, touch } from './base';
```

`liveSetsOf`, `appendSet` et `byOrder` restent privés. En particulier, la lecture des frères et l’écriture de la nouvelle série restent dans la même transaction.

- [ ] **Step 4: Créer `workoutDetail.ts` par déplacement mécanique**

Déplacer sans modifier :

```ts
export interface WorkoutExerciseDetail {
  row: WorkoutExercise;
  exercise: Exercise | undefined;
  sets: WorkoutSet[];
  previous: WorkoutSet[];
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

export async function getWorkoutDetail(
  workoutId: string,
): Promise<WorkoutDetail | null>;
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { alive } from './base';
import { getLastPerformance } from './workoutHistory';
```

Conserver `byOrder` privé et le contrat `null` pour une séance absente ou supprimée.

- [ ] **Step 5: Remplacer `workouts.ts` par la façade explicite**

Le fichier complet devient :

```ts
export {
  deleteWorkout,
  discardWorkout,
  finishWorkout,
  getActiveWorkout,
  startWorkout,
  startWorkoutFromRoutine,
  updateWorkout,
} from './workoutLifecycle';

export {
  addWorkoutExercise,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  updateWorkoutExercise,
} from './workoutExercises';

export {
  addSet,
  completeSet,
  deleteSet,
  duplicateLastSet,
  insertWarmupSets,
  restoreSet,
  uncompleteSet,
  updateSetType,
  updateSetValues,
} from './workoutSets';
export type { NewSetValues, SetValues } from './workoutSets';

export { getWorkoutDetail } from './workoutDetail';
export type { WorkoutDetail, WorkoutExerciseDetail } from './workoutDetail';
```

- [ ] **Step 6: Vérifier l’API et la taille des modules**

Run:

```powershell
rg -n "^export (async )?(function|type|interface)|^export \\{" src/data/repositories/workouts.ts src/data/repositories/workoutLifecycle.ts src/data/repositories/workoutExercises.ts src/data/repositories/workoutSets.ts src/data/repositories/workoutDetail.ts
Get-ChildItem src/data/repositories/workout*.ts | ForEach-Object { "{0}: {1}" -f $_.Name, (Get-Content $_.FullName).Count }
```

Expected:

- tous les symboles publics historiques apparaissent dans la façade ;
- aucun module spécialisé ne dépasse 300 lignes ;
- aucun nouveau symbole privé n’est réexporté.

- [ ] **Step 7: Exécuter les tests des séances et des archives**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/workouts.test.ts src/data/repositories/history.test.ts
npm.cmd run typecheck
```

Expected: PASS. Une erreur d’import ou un export oublié doit être corrigé dans la façade, jamais dans les consommateurs.

- [ ] **Step 8: Contrôler puis committer uniquement la coupe des séances**

Run:

```powershell
git diff --check -- src/data/repositories/workouts.ts src/data/repositories/workoutLifecycle.ts src/data/repositories/workoutExercises.ts src/data/repositories/workoutSets.ts src/data/repositories/workoutDetail.ts
git add -- src/data/repositories/workouts.ts src/data/repositories/workoutLifecycle.ts src/data/repositories/workoutExercises.ts src/data/repositories/workoutSets.ts src/data/repositories/workoutDetail.ts
git diff --cached --name-only
git commit -m "refactor: découpe le repository des séances"
```

Expected: les cinq fichiers de cette Task seulement sont indexés et committés.

---

### Task 3: Découper le repository des routines

**Files:**
- Create: `src/data/repositories/routineFolders.ts`
- Create: `src/data/repositories/routineLifecycle.ts`
- Create: `src/data/repositories/routineExercises.ts`
- Create: `src/data/repositories/routineSets.ts`
- Modify: `src/data/repositories/routines.ts`
- Test unchanged: `src/data/repositories/routines.test.ts`
- Test unchanged: `src/data/seed/routineTemplates.test.ts`

**Interfaces:**
- Consumes: `db`, les types de `src/data/types.ts`, `moveItem`, `normalizeSupersets`, `alive`, `newEntity`, `softDelete` et `touch`.
- Produces: la même API publique depuis `@/data/repositories/routines`, avec les symboles listés dans la façade ci-dessous.

- [ ] **Step 1: Créer `routineFolders.ts` par déplacement mécanique**

Déplacer sans modifier les commentaires, signatures ni corps :

```ts
listFolders
createFolder
renameFolder
countRoutinesInFolder
deleteFolder
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { RoutineFolder } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';
```

Conserver `byOrder` privé.

- [ ] **Step 2: Créer `routineLifecycle.ts` par déplacement mécanique**

Déplacer sans modifier :

```ts
export interface RoutineSummary
export interface RoutineExerciseDetail
export interface RoutineDetail
listRoutineSummaries
getRoutineDetail
createRoutine
updateRoutine
duplicateRoutine
reorderRoutines
deleteRoutine
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSet,
  Syncable,
} from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';
```

Conserver `byOrder` privé. La duplication et la suppression profondes gardent exactement leurs trois tables et leur ordre d’écriture.

- [ ] **Step 3: Créer `routineExercises.ts` par déplacement mécanique**

Déplacer sans modifier les commentaires, signatures ni corps :

```ts
rewriteOrder
addExercisesToRoutine
updateRoutineExercise
removeRoutineExercise
reorderRoutineExercises
groupWithPrevious
ungroupSuperset
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { RoutineExercise, RoutineSet } from '@/data/types';
import { moveItem, normalizeSupersets } from '@/lib/routineOrder';
import { alive, newEntity, softDelete, touch } from './base';
```

`rewriteOrder` et `byOrder` restent privés. La normalisation des supersets demeure dans l’unique chemin d’écriture du réordre.

- [ ] **Step 4: Créer `routineSets.ts` par déplacement mécanique**

Déplacer sans modifier :

```ts
export type RoutineSetTargets = Partial<
  Pick<
    RoutineSet,
    | 'setType'
    | 'targetReps'
    | 'targetRepsMax'
    | 'targetWeight'
    | 'targetDurationSeconds'
    | 'targetDistanceMeters'
    | 'targetRpe'
  >
>;

addRoutineSet
updateRoutineSet
applyToAllSets
deleteRoutineSet
```

Le fichier possède ces dépendances :

```ts
import { db } from '@/data/db';
import type { RoutineSet } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';
```

Conserver `byOrder` privé et la renumérotation après soft-delete dans la transaction existante.

- [ ] **Step 5: Remplacer `routines.ts` par la façade explicite**

Le fichier complet devient :

```ts
export {
  countRoutinesInFolder,
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from './routineFolders';

export {
  createRoutine,
  deleteRoutine,
  duplicateRoutine,
  getRoutineDetail,
  listRoutineSummaries,
  reorderRoutines,
  updateRoutine,
} from './routineLifecycle';
export type {
  RoutineDetail,
  RoutineExerciseDetail,
  RoutineSummary,
} from './routineLifecycle';

export {
  addExercisesToRoutine,
  groupWithPrevious,
  removeRoutineExercise,
  reorderRoutineExercises,
  ungroupSuperset,
  updateRoutineExercise,
} from './routineExercises';

export {
  addRoutineSet,
  applyToAllSets,
  deleteRoutineSet,
  updateRoutineSet,
} from './routineSets';
export type { RoutineSetTargets } from './routineSets';
```

- [ ] **Step 6: Vérifier l’API et la taille des modules**

Run:

```powershell
rg -n "^export (async )?(function|type|interface)|^export \\{" src/data/repositories/routines.ts src/data/repositories/routineFolders.ts src/data/repositories/routineLifecycle.ts src/data/repositories/routineExercises.ts src/data/repositories/routineSets.ts
Get-ChildItem src/data/repositories/routine*.ts | ForEach-Object { "{0}: {1}" -f $_.Name, (Get-Content $_.FullName).Count }
```

Expected:

- tous les symboles publics historiques apparaissent dans la façade ;
- aucun module spécialisé ne dépasse 300 lignes ;
- aucun nouveau symbole privé n’est réexporté.

- [ ] **Step 7: Exécuter les tests des routines et modèles**

Run:

```powershell
npm.cmd run test:run -- src/data/repositories/routines.test.ts src/data/seed/routineTemplates.test.ts
npm.cmd run typecheck
```

Expected: PASS. Une erreur d’import ou un export oublié doit être corrigé dans la façade, jamais dans les consommateurs.

- [ ] **Step 8: Contrôler puis committer uniquement la coupe des routines**

Run:

```powershell
git diff --check -- src/data/repositories/routines.ts src/data/repositories/routineFolders.ts src/data/repositories/routineLifecycle.ts src/data/repositories/routineExercises.ts src/data/repositories/routineSets.ts
git add -- src/data/repositories/routines.ts src/data/repositories/routineFolders.ts src/data/repositories/routineLifecycle.ts src/data/repositories/routineExercises.ts src/data/repositories/routineSets.ts
git diff --cached --name-only
git commit -m "refactor: découpe le repository des routines"
```

Expected: les cinq fichiers de cette Task seulement sont indexés et committés.

---

### Task 4: Vérifier l’absence de régression et consigner la reprise

**Files:**
- Modify: `PROGRESS.md`
- Inspect unchanged: `src/data/repositories/history.ts`
- Inspect unchanged: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: les façades et huit modules spécialisés produits par les Tasks 2 et 3.
- Produces: portes de qualité vertes, preuve que les changements 07B sont intacts et état de reprise documenté.

- [ ] **Step 1: Comparer les changements 07B aux empreintes de la Task 1**

Run:

```powershell
git diff -- src/data/repositories/history.ts | git hash-object --stdin
git diff -- src/i18n/fr.ts | git hash-object --stdin
```

Expected: les deux empreintes sont strictement identiques à celles relevées dans la Task 1.

- [ ] **Step 2: Vérifier qu’aucun consommateur n’importe un module interne**

Run:

```powershell
rg -n "repositories/(workoutLifecycle|workoutExercises|workoutSets|workoutDetail|routineFolders|routineLifecycle|routineExercises|routineSets)" src --glob "!src/data/repositories/*.ts"
```

Expected: aucun résultat.

- [ ] **Step 3: Lancer les quatre portes du projet**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected:

- les quatre commandes passent ;
- le nombre de tests ne diminue pas par rapport à la Task 1 ;
- le seul warning admis est le warning Vite historique sur le chunk principal supérieur à 500 kB.

- [ ] **Step 4: Contrôler les tailles finales et le diff**

Run:

```powershell
Get-ChildItem src/data/repositories/workout*.ts,src/data/repositories/routine*.ts | ForEach-Object { "{0}: {1}" -f $_.Name, (Get-Content $_.FullName).Count }
git status --short
git diff --check
```

Expected:

- les façades sont courtes ;
- les huit modules spécialisés font moins de 300 lignes ;
- `history.ts` et `fr.ts` restent les seuls fichiers suivis modifiés hérités de 07B avant la mise à jour de `PROGRESS.md` ;
- aucun fichier de composant ou de test n’a changé.

- [ ] **Step 5: Mettre à jour `PROGRESS.md`**

Ajouter en tête de la dernière mise à jour, sans modifier la prochaine reprise 07B :

```markdown
**Refactorisation pré-07B :** les façades publiques `workouts.ts` et `routines.ts`
conservent leurs APIs, tandis que leurs responsabilités sont réparties dans huit
modules internes de moins de 300 lignes. Aucun consommateur, test, comportement ou
transaction Dexie n’a changé. Les quatre portes sont vertes. La reprise reste la
Task 3 du plan 07B.
```

Remplacer la dette technique des deux repositories par une note de remboursement datée, sans supprimer l’historique qui explique pourquoi la coupe a été nécessaire.

- [ ] **Step 6: Committer uniquement la documentation de reprise**

Run:

```powershell
git add -- PROGRESS.md
git diff --cached --name-only
git commit -m "docs: consigne la refactorisation des repositories"
```

Expected: `PROGRESS.md` seulement est committé. `history.ts` et `fr.ts` restent non indexés.

- [ ] **Step 7: Afficher l’état final**

Run:

```powershell
git status --short
git log -4 --oneline
```

Expected:

- trois commits nouveaux après la spécification : séances, routines, progression ;
- les changements 07B préexistants restent présents et non indexés ;
- aucune modification produite par la refactorisation ne reste non committée.
