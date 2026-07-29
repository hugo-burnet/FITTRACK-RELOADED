# Workout Record Kinds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Faire de `lib/records` l’unique module qui transforme les séries d’une séance en record principal visible par série.

**Architecture:** `workoutRecordKinds` orchestre `recordsBeatenBy` dans le module pur qui possède déjà la définition et l’ordre des records. `WorkoutScreen` projette ses détails vers une interface minimale et consomme la `Map` résultante, sans changer sa requête live ou les cartes.

**Tech Stack:** TypeScript strict, Vitest, React 19.

## Global Constraints

- Aucun changement de schéma Dexie, migration ou donnée.
- Aucun changement visuel, de texte ou d’interaction.
- Code et noms en anglais ; aucun nouveau texte UI.
- Seules les séries validées peuvent recevoir un record.
- Seul le premier record rendu par `recordsBeatenBy` est affiché.
- Les entrées ne sont jamais mutées.

---

### Task 1: Approfondir `records` avec la projection de séance

**Files:**
- Modify: `src/lib/records.test.ts`
- Modify: `src/lib/records.ts`

**Interfaces:**
- Consumes: `recordsBeatenBy(candidate, universe)`.
- Produces: `WorkoutRecordGroup`.
- Produces: `workoutRecordKinds(groups, setsByExercise): Map<string, RecordKind>`.

- [ ] **Step 1: Écrire les tests avant l’implémentation**

Dans `src/lib/records.test.ts`, importer `workoutRecordKinds` et ajouter :

```ts
describe('workoutRecordKinds', () => {
  it('returns no records while the live universe is unavailable', () => {
    const candidate = aSet({ weight: 105, reps: 5 });
    expect(
      workoutRecordKinds([{ exerciseId: 'ex', sets: [candidate] }], undefined),
    ).toEqual(new Map());
  });

  it('ignores an uncompleted candidate', () => {
    const before = aSet({ weight: 100, reps: 5 });
    const candidate = aSet({ weight: 105, reps: 5, isCompleted: 0 });
    expect(
      workoutRecordKinds(
        [{ exerciseId: 'ex', sets: [candidate] }],
        new Map([['ex', [before]]]),
      ),
    ).toEqual(new Map());
  });

  it('keeps only the highest-priority record beaten by a set', () => {
    const before = aSet({ weight: 100, reps: 5 });
    const candidate = aSet({ weight: 105, reps: 10 });
    expect(
      workoutRecordKinds(
        [{ exerciseId: 'ex', sets: [candidate] }],
        new Map([['ex', [before, candidate]]]),
      ),
    ).toEqual(new Map([[candidate.id, 'heaviest']]));
  });

  it('keeps exercise universes isolated', () => {
    const loadBefore = aSet({ exerciseId: 'load', weight: 100, reps: 5 });
    const loadCandidate = aSet({ exerciseId: 'load', weight: 105, reps: 3 });
    const repsBefore = aSet({ exerciseId: 'reps', reps: 12 });
    const repsCandidate = aSet({ exerciseId: 'reps', reps: 14 });

    expect(
      workoutRecordKinds(
        [
          { exerciseId: 'load', sets: [loadCandidate] },
          { exerciseId: 'reps', sets: [repsCandidate] },
        ],
        new Map([
          ['load', [loadBefore, loadCandidate]],
          ['reps', [repsBefore, repsCandidate]],
        ]),
      ),
    ).toEqual(
      new Map([
        [loadCandidate.id, 'heaviest'],
        [repsCandidate.id, 'mostReps'],
      ]),
    );
  });
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```powershell
npm.cmd run test:run -- src/lib/records.test.ts
```

Expected: FAIL parce que `workoutRecordKinds` n’est pas exporté.

- [ ] **Step 3: Implémenter le minimum dans `records.ts`**

Ajouter :

```ts
export interface WorkoutRecordGroup {
  exerciseId: string;
  sets: readonly WorkoutSet[];
}

export function workoutRecordKinds(
  groups: readonly WorkoutRecordGroup[],
  setsByExercise: ReadonlyMap<string, WorkoutSet[]> | undefined,
): Map<string, RecordKind> {
  const records = new Map<string, RecordKind>();
  if (setsByExercise === undefined) return records;

  for (const group of groups) {
    const universe = setsByExercise.get(group.exerciseId);
    if (universe === undefined) continue;

    for (const set of group.sets) {
      if (set.isCompleted !== 1) continue;
      const [top] = recordsBeatenBy(set, universe);
      if (top !== undefined) records.set(set.id, top.kind);
    }
  }

  return records;
}
```

- [ ] **Step 4: Vérifier le passage au vert**

Run:

```powershell
npm.cmd run test:run -- src/lib/records.test.ts
```

Expected: 29 tests PASS.

- [ ] **Step 5: Tuer deux mutations manuelles**

Première mutation temporaire : supprimer

```ts
if (set.isCompleted !== 1) continue;
```

Run:

```powershell
npm.cmd run test:run -- src/lib/records.test.ts
```

Expected: FAIL sur `ignores an uncompleted candidate`. Restaurer
immédiatement le filtre.

Deuxième mutation temporaire :

```ts
const [top] = recordsBeatenBy(set, universe);
```

devient :

```ts
const top = recordsBeatenBy(set, universe).at(-1);
```

Run:

```powershell
npm.cmd run test:run -- src/lib/records.test.ts
```

Expected: FAIL sur `keeps only the highest-priority record beaten by a set`.
Restaurer la déstructuration, puis relancer le test et attendre 29 tests PASS.

### Task 2: Migrer `WorkoutScreen`

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `workoutRecordKinds(groups, recordSets)` from `@/lib/records`.

- [ ] **Step 1: Supprimer la boucle locale**

Dans `WorkoutScreen.tsx` :

- importer `workoutRecordKinds` à la place de `recordsBeatenBy` ;
- conserver l’import type de `RecordKind`, utilisé par les props et la `Map` ;
- supprimer la boucle qui construit `records` ;
- remplacer cette boucle par :

```ts
const records = workoutRecordKinds(
  exercises.map(({ row, sets }) => ({ exerciseId: row.exerciseId, sets })),
  recordSets,
);
```

- [ ] **Step 2: Vérifier la migration ciblée**

Run:

```powershell
rg -n "recordsBeatenBy|workoutRecordKinds" src/features/workout/WorkoutScreen.tsx src/lib/records.ts
npm.cmd run test:run -- src/lib/records.test.ts src/features/workout/WorkoutExerciseCard.test.tsx
npm.cmd run typecheck
```

Si `WorkoutExerciseCard.test.tsx` n’existe pas, exécuter uniquement
`src/lib/records.test.ts` et le typecheck.

Expected:

- `WorkoutScreen` importe et appelle uniquement `workoutRecordKinds` ;
- `recordsBeatenBy` reste interne au module et à ses tests ;
- les tests ciblés et le typecheck passent.

### Task 3: Vérifier, documenter et committer

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: le diff complet et les sorties de vérification.
- Produces: une mémoire de reprise fidèle et un commit atomique.

- [ ] **Step 1: Exécuter les portes finales**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: cinq codes de sortie 0 et 775 tests Vitest.

- [ ] **Step 2: Mettre à jour `PROGRESS.md`**

Ajouter en tête :

- la seam `workoutRecordKinds` ajoutée à `lib/records` ;
- la boucle de records supprimée de `WorkoutScreen` ;
- la preuve TDD et les deux mutants tués ;
- l’absence de changement visible ou persistant ;
- le checkpoint record double puis décochage/recochage sur téléphone.

- [ ] **Step 3: Relire le diff**

Run:

```powershell
git diff --color=never
git diff --stat
git status --short
```

Expected: uniquement `records.ts`, `records.test.ts`, `WorkoutScreen.tsx`,
`PROGRESS.md` et ce plan.

- [ ] **Step 4: Commiter**

Run:

```powershell
git add docs/superpowers/plans/2026-07-29-workout-record-kinds.md src/lib/records.ts src/lib/records.test.ts src/features/workout/WorkoutScreen.tsx PROGRESS.md
git commit -m "refactor: centralise les records de séance"
```

Expected: un commit atomique sur `master`, sans fichier étranger.
