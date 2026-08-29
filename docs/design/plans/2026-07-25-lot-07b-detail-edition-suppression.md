# Lot 07B — Détail, édition et suppression des séances archivées Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d’ouvrir une séance terminée depuis le Journal ou le Calendrier, d’en corriger
toutes les données dans un brouillon local, puis de l’enregistrer ou de la supprimer sans laisser
de records ni de performances fantômes.

**Architecture:** Les lectures et mutations archivées vivent dans
`src/data/repositories/history.ts`; une transaction Dexie unique remplace la séance, ses exercices
et ses séries. Le détail reste en lecture seule et dérive ses totaux des fonctions pures existantes.
L’éditeur transforme le détail en brouillon React, réutilise les primitives FitTrack et n’écrit
qu’au bouton **Enregistrer**.

**Tech Stack:** React 19, React Router 7 en mode hash, TypeScript strict, Dexie 4,
`dexie-react-hooks`, Tailwind CSS v4, Vitest et `fake-indexeddb`.

## Global Constraints

- Toute la fonctionnalité marche hors-ligne, sans compte ni réseau.
- Aucune limite artificielle : aucun nombre maximal d’exercices, de séries ou de séances.
- L’interface est en français et chaque texte vit dans `src/i18n/fr.ts`.
- Les composants n’importent jamais `db` directement.
- Les cibles tactiles font au moins 48 px.
- Une séance archivée est un `Workout` vivant dont `status === 'completed'`.
- L’édition reste dans un brouillon local jusqu’à **Enregistrer**.
- La sauvegarde et la suppression sont chacune une transaction Dexie unique.
- Les suppressions restent logiques : `deletedAt` et `updatedAt` sont mis à jour, aucune ligne
  n’est physiquement effacée.
- Les records et la dernière performance restent dérivés de `workoutSets`; aucune ligne n’est
  ajoutée à `personalRecords`.
- Une série d’échauffement reste exclue du volume et des records.
- Fermer un brouillon modifié demande confirmation.

---

### Task 1: Repository transactionnel des séances archivées

**Files:**
- Modify: `src/data/repositories/history.ts`
- Modify: `src/data/repositories/history.test.ts`

**Interfaces:**
- Consumes: `WorkoutDetail` de `getWorkoutDetail`, `newEntity` et `touch`, tables `workouts`,
  `workoutExercises`, `workoutSets`.
- Produces:

```ts
export interface ArchivedSetDraft {
  id?: string;
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface ArchivedExerciseDraft {
  id?: string;
  exerciseId: string;
  supersetGroup: number;
  restSeconds: number;
  notes?: string;
  sets: ArchivedSetDraft[];
}

export interface ArchivedWorkoutDraft {
  workoutId: string;
  name: string;
  notes?: string;
  startedAt: number;
  durationSeconds: number;
  exercises: ArchivedExerciseDraft[];
}

export function getArchivedWorkoutDetail(
  workoutId: string,
): Promise<WorkoutDetail | null>;

export function saveArchivedWorkout(
  draft: ArchivedWorkoutDraft,
): Promise<void>;

export function deleteArchivedWorkout(workoutId: string): Promise<void>;
```

- [ ] **Step 1: Écrire les tests rouges de lecture et de validation**

Ajouter ces cas dans `history.test.ts` :

```ts
it('ne lit comme archive qu’une séance terminée vivante', async () => {
  const completed = await seedWorkout({
    exerciseId: 'bench',
    performedAt: day(1),
    sets: [[100, 5]],
  });
  const active = await startWorkout('', 'En cours');

  expect((await getArchivedWorkoutDetail(completed.id))?.workout.id).toBe(completed.id);
  expect(await getArchivedWorkoutDetail(active.id)).toBeNull();
  expect(await getArchivedWorkoutDetail('missing')).toBeNull();
});

it('refuse de modifier une séance qui n’est pas archivée', async () => {
  const active = await startWorkout('', 'En cours');
  const draft: ArchivedWorkoutDraft = {
    workoutId: active.id,
    name: 'Correction',
    startedAt: day(3),
    durationSeconds: 3600,
    exercises: [],
  };

  await expect(saveArchivedWorkout(draft)).rejects.toThrow(
    'Archived workout not found',
  );
});
```

Ajouter les validations suivantes, chacune avec une assertion dédiée :

- `name.trim()` vide ;
- `startedAt` non fini ou négatif ;
- `durationSeconds` non entier ou négatif ;
- identifiant d’exercice ou de série répété dans le brouillon ;
- identifiant enfant appartenant à une autre séance.

- [ ] **Step 2: Lancer les tests et constater l’échec attendu**

Run:

```bash
npm.cmd run test:run -- src/data/repositories/history.test.ts
```

Expected: FAIL car `getArchivedWorkoutDetail`, `saveArchivedWorkout` et
`deleteArchivedWorkout` ne sont pas exportés.

- [ ] **Step 3: Ajouter les contrats et gardes minimales**

`getArchivedWorkoutDetail` appelle `getWorkoutDetail`, puis rend `null` si le résultat est absent
ou si `detail.workout.status !== 'completed'`.

Avant d’ouvrir la transaction d’écriture, `saveArchivedWorkout` valide les primitives du brouillon
et les doublons :

```ts
function assertArchivedDraft(draft: ArchivedWorkoutDraft): void {
  if (draft.name.trim() === '') throw new RangeError('Workout name is required');
  if (!Number.isFinite(draft.startedAt) || draft.startedAt < 0) {
    throw new RangeError('Workout start must be a valid timestamp');
  }
  if (!Number.isInteger(draft.durationSeconds) || draft.durationSeconds < 0) {
    throw new RangeError('Workout duration must be a non-negative integer');
  }

  const exerciseIds = draft.exercises.flatMap((row) =>
    row.id === undefined ? [] : [row.id],
  );
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    throw new RangeError('Workout exercise ids must be unique');
  }

  const setIds = draft.exercises.flatMap((row) =>
    row.sets.flatMap((set) => (set.id === undefined ? [] : [set.id])),
  );
  if (new Set(setIds).size !== setIds.length) {
    throw new RangeError('Workout set ids must be unique');
  }
}
```

- [ ] **Step 4: Écrire les tests rouges de remplacement atomique**

```ts
it('remplace atomiquement les métadonnées, exercices et séries', async () => {
  const workout = await seedWorkout({
    exerciseId: 'bench',
    performedAt: day(1),
    sets: [[100, 5], [90, 8]],
  });
  const detail = await getArchivedWorkoutDetail(workout.id);
  expect(detail).not.toBeNull();

  const row = detail!.exercises[0]!;
  await saveArchivedWorkout({
    workoutId: workout.id,
    name: 'Poussée corrigée',
    notes: 'Bonne séance',
    startedAt: day(8),
    durationSeconds: 2700,
    exercises: [{
      id: row.row.id,
      exerciseId: row.row.exerciseId,
      supersetGroup: 0,
      restSeconds: row.row.restSeconds,
      notes: 'Tempo contrôlé',
      sets: [{
        id: row.sets[0]!.id,
        setType: 'warmup',
        side: 'both',
        weight: 60,
        reps: 10,
      }, {
        setType: 'normal',
        side: 'both',
        weight: 102.5,
        reps: 5,
        rpe: 8.5,
      }],
    }],
  });

  const saved = await getArchivedWorkoutDetail(workout.id);
  expect(saved?.workout).toMatchObject({
    name: 'Poussée corrigée',
    notes: 'Bonne séance',
    startedAt: day(8),
    endedAt: day(8) + 2_700_000,
    durationSeconds: 2700,
  });
  expect(saved?.exercises[0]?.sets).toHaveLength(2);
  expect(saved?.exercises[0]?.sets[1]).toMatchObject({
    exerciseId: row.row.exerciseId,
    workoutId: workout.id,
    setType: 'normal',
    weight: 102.5,
    reps: 5,
    rpe: 8.5,
    isCompleted: 1,
  });
});
```

Ajouter trois cas indépendants :

1. exercice et série retirés du brouillon reçoivent `deletedAt > 0` ;
2. un nouvel exercice et ses séries reçoivent des UUID, des rangs continus et les trois identifiants
   dénormalisés cohérents ;
3. un échec simulé du dernier `bulkPut` rejette la promesse et laisse workout, exercices et séries
   strictement inchangés après la transaction.

- [ ] **Step 5: Implémenter le remplacement dans une transaction unique**

Dans `saveArchivedWorkout` :

1. ouvrir `db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, ...)` ;
2. relire le workout et refuser tout workout absent, supprimé ou non terminé ;
3. relire tous ses enfants vivants et vérifier que chaque `id` fourni lui appartient ;
4. construire les lignes suivantes avec `newEntity` pour les nouveaux IDs et `touch` pour les IDs
   existants ;
5. attribuer `order` depuis l’ordre des tableaux du brouillon ;
6. forcer chaque série enregistrée à `isCompleted: 1`, à son `workoutId`, son
   `workoutExerciseId` et son `exerciseId` réels ;
7. décaler `performedAt` des séries existantes de `draft.startedAt - workout.startedAt`; pour une
   nouvelle série, utiliser `draft.startedAt + sequence + 1` afin de rester strictement positif et
   stable ;
8. soft-delete les anciennes lignes omises ;
9. écrire le workout avec `endedAt = startedAt + durationSeconds * 1000`.

Les propriétés de résultat absentes dans le brouillon sont réellement retirées de l’objet sauvegardé
au lieu de conserver une ancienne valeur via spread.

- [ ] **Step 6: Écrire les tests rouges de suppression et de dérivations**

```ts
it('supprime logiquement toute l’archive dans une transaction', async () => {
  const workout = await seedWorkout({
    exerciseId: 'bench',
    performedAt: day(1),
    sets: [[100, 5]],
  });

  await deleteArchivedWorkout(workout.id);

  expect((await db.workouts.get(workout.id))?.deletedAt).toBeGreaterThan(0);
  expect((await db.workoutExercises.where('workoutId').equals(workout.id).first())?.deletedAt)
    .toBeGreaterThan(0);
  expect((await db.workoutSets.where('workoutId').equals(workout.id).first())?.deletedAt)
    .toBeGreaterThan(0);
});
```

Ajouter :

- refus d’une séance active sans modifier ses lignes ;
- rollback complet si une écriture enfant échoue ;
- après baisse d’une charge ou passage en `warmup`, `bestSets(await listRecordSets(...))` relit le
  bon record ;
- après suppression, `getLastPerformance(exerciseId)` et `listRecordSets` ignorent les séries de
  l’archive supprimée.

- [ ] **Step 7: Implémenter la suppression archivée**

`deleteArchivedWorkout` ouvre une transaction sur les trois tables, vérifie `status ===
'completed'` et `deletedAt === 0`, puis applique un unique timestamp `now` à `deletedAt` et
`updatedAt` sur le workout, ses exercices et ses séries. Une archive déjà absente rejette avec
`Archived workout not found` afin que l’interface ne puisse pas annoncer une suppression réussie
qui n’a rien supprimé.

- [ ] **Step 8: Vérifier le repository**

Run:

```bash
npm.cmd run test:run -- src/data/repositories/history.test.ts
npm.cmd run typecheck
```

Expected: PASS, sans warning ni accès à `db` hors repository/test.

- [ ] **Step 9: Commit**

```bash
git add src/data/repositories/history.ts src/data/repositories/history.test.ts
git commit -m "feat(lot-07): sécurise les mutations archivées"
```

### Task 2: Détail archivé et suppression depuis l’interface

**Files:**
- Create: `src/features/history/HistoryDetailScreen.tsx`
- Create: `src/features/history/HistoryWorkoutDetail.tsx`
- Modify: `src/features/history/HistoryJournal.tsx`
- Modify: `src/features/history/HistoryScreen.tsx`
- Modify: `src/router.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `getArchivedWorkoutDetail`, `deleteArchivedWorkout`, `sessionTotals`,
  `measurementShape`, `performedParts`.
- Produces: route `history/:workoutId`, liens depuis tous les résumés, suppression confirmée et
  notice de retour au Journal.

- [ ] **Step 1: Ajouter le vocabulaire complet avant les composants**

Ajouter sous `history` dans `src/i18n/fr.ts` :

```ts
detailActions: 'Actions de la séance',
detailDate: 'Date',
detailStart: 'Début',
detailDuration: 'Durée',
detailNotes: 'Notes',
detailTotals: 'Totaux',
detailExercises: 'Exercices',
detailSets: 'Séries de travail',
detailReps: 'Répétitions',
detailTonnage: 'Tonnage',
detailTime: 'Temps',
detailDistance: 'Distance',
detailSet: 'Série {number}',
detailRpe: 'RPE {value}',
deletedExercise: 'Exercice supprimé',
edit: 'Modifier',
delete: 'Supprimer',
deleteTitle: 'Supprimer cette séance ?',
deleteBody: '« {name} » du {date} disparaîtra de ton historique et de tes records.',
deleteConfirm: 'Supprimer',
deleteError: 'La séance n’a pas pu être supprimée. Réessaie.',
deletedNotice: 'La séance a été supprimée.',
missingNotice: 'Cette séance n’existe plus.',
```

Ajouter les unités ou variantes singulières nécessaires, sans concaténer de phrase française en
dur dans JSX.

- [ ] **Step 2: Transformer les résumés partagés en liens**

`HistoryWorkoutSummaryList` reste l’unique rendu Journal/Calendrier. Sa ligne devient un
`Link` vers `/history/${summary.workoutId}` avec `ChevronRightIcon`, une cible pleine largeur d’au
moins 48 px et le même contenu qu’avant. Aucun chemin n’est construit ailleurs.

- [ ] **Step 3: Construire le détail en lecture seule**

`HistoryDetailScreen` :

```tsx
const { workoutId = '' } = useParams();
const navigate = useNavigate();
const detail = useLiveQuery(
  () => getArchivedWorkoutDetail(workoutId),
  [workoutId],
);
```

- `undefined` affiche un squelette sans faux état vide ;
- `null` revient à `/history` avec `{ replace: true, state: { historyNotice: 'missing' } }` ;
- le `Screen` affiche une flèche retour et un `HeaderAction` avec `MoreIcon` ;
- l’`ActionSheet` propose `Modifier` et `Supprimer` ;
- `HistoryWorkoutDetail` affiche les métadonnées, notes, totaux dérivés et exercices ordonnés ;
- seules les séries vivantes validées sont rendues ;
- chaque série utilise `performedParts` pour les champs compatibles, puis ajoute type et RPE ;
- un exercice supprimé garde ses chiffres et reçoit le libellé localisé `deletedExercise`.

Pour `sessionTotals`, construire une entrée par série avec le `weightRole` de
`measurementShape(exercise.measurementType)` quand l’exercice existe. Ne jamais compter une série
d’échauffement en la filtrant manuellement : `sessionTotals` possède déjà cette règle.

- [ ] **Step 4: Brancher la confirmation de suppression**

Le choix `Supprimer` ouvre `ConfirmSheet` avec le nom et la date longue. Le callback :

```tsx
void deleteArchivedWorkout(detail.workout.id)
  .then(() => {
    navigate('/history', {
      replace: true,
      state: { historyNotice: 'deleted' },
    });
  })
  .catch(() => setDeleteFailed(true));
```

La navigation n’a lieu qu’après le commit de la transaction. Une erreur garde l’écran ouvert et
affiche `history.deleteError`.

- [ ] **Step 5: Afficher puis consommer la notice dans le Journal**

`HistoryScreen` lit `useLocation().state`. Une notice `deleted` ou `missing` produit une `Card`
compacte avec `role="status"` et la chaîne correspondante. Après lecture initiale, remplacer
l’entrée courante par le même pathname avec `state: null` afin qu’un rechargement ne répète pas une
ancienne suppression.

- [ ] **Step 6: Ajouter la route**

Dans `src/router.tsx` :

```tsx
{ path: 'history', element: <HistoryScreen /> },
{ path: 'history/:workoutId', element: <HistoryDetailScreen /> },
```

Importer l’écran depuis `features/history`. React Router classe la route statique correctement,
mais conserver les deux lignes côte à côte.

- [ ] **Step 7: Vérifier le slice**

Run:

```bash
npm.cmd run typecheck
npm.cmd run test:run -- src/data/repositories/history.test.ts
npm.cmd run lint
```

Expected: PASS. Vérifier aussi :

```bash
rg -n "from '@/data/db'|from \"@/data/db\"" src/features/history
```

Expected: aucun résultat.

- [ ] **Step 8: Commit**

```bash
git add src/features/history src/router.tsx src/i18n/fr.ts
git commit -m "feat(lot-07): affiche le détail des séances archivées"
```

### Task 3: Éditeur rétroactif avec brouillon protégé

**Files:**
- Create: `src/features/history/historyDraft.ts`
- Test: `src/features/history/historyDraft.test.ts`
- Create: `src/features/history/HistoryEditScreen.tsx`
- Create: `src/features/history/HistoryExerciseEditor.tsx`
- Create: `src/features/history/HistorySetEditor.tsx`
- Create: `src/features/history/HistoryExercisePickerSheet.tsx`
- Modify: `src/router.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `getArchivedWorkoutDetail`, `saveArchivedWorkout`, `listExercises`,
  `ArchivedWorkoutDraft`, `entryColumns`, `SET_TYPES`, `ReorderableList`.
- Produces: route `history/:workoutId/edit`, brouillon local complet, ajout/suppression/réordre
  illimités, confirmation de sortie et sauvegarde transactionnelle.

- [ ] **Step 1: Écrire les tests rouges du brouillon**

`historyDraft.test.ts` couvre des fonctions pures :

```ts
describe('local date inputs', () => {
  it('fait un aller-retour date et heure dans le fuseau local', () => {
    const timestamp = new Date(2026, 6, 25, 15, 5).getTime();
    expect(localDateValue(timestamp)).toBe('2026-07-25');
    expect(localTimeValue(timestamp)).toBe('15:05');
    expect(timestampFromLocalInputs('2026-07-25', '15:05')).toBe(timestamp);
  });

  it('refuse une date ou une heure impossible', () => {
    expect(timestampFromLocalInputs('2026-02-30', '12:00')).toBeNull();
    expect(timestampFromLocalInputs('2026-07-25', '25:00')).toBeNull();
  });
});

it('transforme le détail en brouillon indépendant', () => {
  const draft = draftFromArchivedDetail(detailFixture());
  draft.exercises[0]!.sets[0]!.weight = 80;

  expect(detailFixture().exercises[0]!.sets[0]!.weight).toBe(100);
  expect(draft.exercises[0]!.draftId).toBe(
    detailFixture().exercises[0]!.row.id,
  );
});
```

Le brouillon d’interface étend les contrats du repository avec un `draftId` obligatoire par
exercice et série, utilisé uniquement comme clé React :

```ts
export interface HistorySetDraft extends ArchivedSetDraft {
  draftId: string;
}

export interface HistoryExerciseDraft
  extends Omit<ArchivedExerciseDraft, 'sets'> {
  draftId: string;
  exerciseName: string;
  measurementType?: MeasurementType;
  sets: HistorySetDraft[];
}

export interface HistoryWorkoutDraft
  extends Omit<ArchivedWorkoutDraft, 'exercises'> {
  exercises: HistoryExerciseDraft[];
}
```

- [ ] **Step 2: Vérifier le rouge puis implémenter les conversions**

Run:

```bash
npm.cmd run test:run -- src/features/history/historyDraft.test.ts
```

Expected avant implémentation: FAIL avec le module `./historyDraft` absent.

Implémenter :

- `localDateValue(timestamp)` et `localTimeValue(timestamp)` avec les composantes locales ;
- `timestampFromLocalInputs(date, time)` avec validation aller-retour stricte ;
- `draftFromArchivedDetail(detail)` avec copies de tableaux et d’objets ;
- `newHistoryExerciseDraft(exercise)` et `newHistorySetDraft()` avec
  `crypto.randomUUID()`, sans persister ce `draftId`.

Relancer la commande. Expected: PASS.

- [ ] **Step 3: Ajouter tout le vocabulaire de l’éditeur**

Ajouter dans `src/i18n/fr.ts` :

```ts
editTitle: 'Modifier la séance',
editName: 'Nom',
editNotes: 'Notes',
editDate: 'Date',
editStart: 'Heure de début',
editDuration: 'Durée de la séance',
editDurationUnit: 'min',
editExercises: 'Exercices',
editAddExercise: 'Ajouter un exercice',
editAddSet: 'Ajouter une série',
editRemoveExercise: 'Retirer l’exercice',
editRemoveSet: 'Supprimer la série',
editExerciseNotes: 'Notes de l’exercice',
editSetType: 'Type de série',
editWeight: 'Charge',
editReps: 'Répétitions',
editDistance: 'Distance',
editSetDuration: 'Durée',
editRpe: 'RPE',
editSave: 'Enregistrer',
editSaveError: 'Les modifications n’ont pas pu être enregistrées. Réessaie.',
editInvalidDate: 'Choisis une date et une heure valides.',
editInvalidName: 'Donne un nom à la séance.',
editDiscardTitle: 'Abandonner les modifications ?',
editDiscardBody: 'Les changements non enregistrés seront perdus.',
editDiscardConfirm: 'Abandonner',
editExercisePicker: 'Choisir un exercice',
editExerciseSearch: 'Chercher un exercice',
editExerciseSearchPlaceholder: 'Développé, squat, tirage…',
editNoExercise: 'Aucun exercice ne correspond.',
editDragExercise: 'Déplacer {name}',
editDragSet: 'Déplacer la série {number}',
```

Réutiliser `setType.*`, `units.*`, `common.back` et les chaînes existantes au lieu de les doubler.

- [ ] **Step 4: Construire le picker illimité**

`HistoryExercisePickerSheet` reçoit `open`, `onClose`, `onSelect`. Il garde une recherche locale et
s’abonne à :

```tsx
const exercises = useLiveQuery(
  () => listExercises({ search }),
  [search],
);
```

La feuille contient `Input`, puis toutes les lignes rendues par le repository, sans `slice`, limite
ou quota. Choisir une ligne appelle `onSelect(newHistoryExerciseDraft(exercise))` puis ferme.
Chaque ligne fait au moins 56 px.

- [ ] **Step 5: Construire les cartes d’exercice et de série**

`HistoryExerciseEditor` :

- `Card` par exercice ;
- poignée `GripIcon` de 48 px reliée à `ReorderableList` ;
- notes d’exercice ;
- `ReorderableList` interne pour les séries ;
- bouton `Ajouter une série` ;
- action destructive `Retirer l’exercice`.

`HistorySetEditor` :

- rang et poignée de 48 px ;
- `OptionSheet` pour `SET_TYPES` ;
- champs dérivés de `entryColumns(measurementType)` ;
- pour un exercice supprimé sans `measurementType`, rendre les quatre champs présents dans les
  données afin de ne rien masquer ;
- `NumberInput` sans maximum artificiel pour charge, reps, distance et durée ;
- RPE borné au domaine réel `6..10` par pas de `0.5` ;
- bouton de suppression de 48 px.

Les modifications appellent uniquement `onChange(nextDraft)`; aucun composant n’appelle un
repository d’écriture.

- [ ] **Step 6: Construire l’écran et la sauvegarde**

`HistoryEditScreen` lit `getArchivedWorkoutDetail`, initialise une seule fois un
`HistoryWorkoutDraft` par `workoutId` et conserve une copie `baseline`.

L’écran :

- édite nom et notes avec `Input`/`Textarea` ;
- édite date et heure avec `Input type="date"` et `Input type="time"` ;
- édite la durée en minutes avec `NumberInput`, puis convertit en secondes dans le brouillon ;
- réordonne exercices et séries avec `ReorderableList` et `moveItem` ;
- ajoute et retire sans quota ;
- affiche **Enregistrer** dans un `ActionBand`.

Avant la sauvegarde :

```ts
const startedAt = timestampFromLocalInputs(dateValue, timeValue);
if (startedAt === null) {
  setValidationError(t('history.editInvalidDate'));
  return;
}
if (draft.name.trim() === '') {
  setValidationError(t('history.editInvalidName'));
  return;
}
```

Puis appeler `saveArchivedWorkout` avec `draftId`, `exerciseName` et `measurementType` retirés par
une conversion explicite. Attendre la promesse, remplacer le baseline, puis naviguer avec
`replace: true` vers `/history/${workoutId}`. Une erreur garde le brouillon et affiche
`history.editSaveError`.

- [ ] **Step 7: Bloquer les sorties avec modifications**

Calculer `dirty` par comparaison du brouillon sérialisable avec le baseline. Utiliser
`useBlocker(dirty)` pour la flèche, la navigation basse et le bouton retour Android, plus
`beforeunload` pour un rechargement.

Quand `blocker.state === 'blocked'`, ouvrir `ConfirmSheet` :

- annuler appelle `blocker.reset()` ;
- confirmer appelle `blocker.proceed()` ;
- le callback de fermeture ne doit pas réinitialiser après `proceed` : protéger ce chemin avec une
  ref `proceedingRef`.

Un brouillon intact quitte sans confirmation. Après une sauvegarde réussie, le baseline est mis à
jour avant la navigation pour que celle-ci ne soit pas bloquée.

- [ ] **Step 8: Ajouter la route d’édition**

Dans `src/router.tsx` :

```tsx
{ path: 'history/:workoutId/edit', element: <HistoryEditScreen /> },
{ path: 'history/:workoutId', element: <HistoryDetailScreen /> },
```

Dans `HistoryDetailScreen`, l’action `Modifier` navigue vers
`/history/${detail.workout.id}/edit`.

- [ ] **Step 9: Vérifier l’éditeur**

Run:

```bash
npm.cmd run test:run -- src/features/history/historyDraft.test.ts
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:run
npm.cmd run build
```

Expected: toutes les commandes passent. Le warning Vite déjà connu sur le chunk principal
supérieur à 500 kB peut rester le seul warning de build.

Vérifier :

```bash
rg -n "from '@/data/db'|from \"@/data/db\"" src/features/history
```

Expected: aucun résultat.

- [ ] **Step 10: Commit**

```bash
git add src/features/history src/router.tsx src/i18n/fr.ts
git commit -m "feat(lot-07): édite les séances archivées"
```

---

## Vérification manuelle du jalon 07B

Sur un viewport 375 × 812 puis sur téléphone :

1. ouvrir une séance depuis le Journal ;
2. vérifier date, durée, notes, exercices, séries et totaux ;
3. ouvrir **Modifier**, corriger la date, une charge et le type d’une série ;
4. ajouter puis réordonner une série et un exercice ;
5. tenter de revenir sans sauvegarder, annuler la confirmation et retrouver le brouillon ;
6. enregistrer, recharger et vérifier que les corrections persistent ;
7. vérifier que le record et la dernière performance ont changé sans ligne `personalRecords` ;
8. supprimer la séance, confirmer, puis vérifier son absence du Journal, du Calendrier et du filtre.

Le checkpoint utilisateur reste : corriger une faute réelle dans une séance de quelques jours,
vérifier le total, puis supprimer une séance de test et confirmer qu’elle ne nourrit plus les
records.
