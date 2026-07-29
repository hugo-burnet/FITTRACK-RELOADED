# Workout Rest Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Faire de `lib/rest` l’unique module qui transforme les exercices ordonnés en plans de repos par bloc.

**Architecture:** `restPlans` compose `toBlocks` et `resolveRestSeconds` dans un module pur. `WorkoutScreen` ne conserve que la projection de ses détails vers les lignes persistées et consomme la `Map` produite, sans changement du store, du rendu ou des données.

**Tech Stack:** TypeScript strict, Vitest, React 19.

## Global Constraints

- Aucun changement de schéma Dexie, migration ou donnée.
- Aucun changement visuel, de texte, de son ou d’interaction.
- Code et noms en anglais ; aucun nouveau texte UI.
- La durée commune d’un bloc reste le maximum des durées résolues.
- Seul le dernier membre du bloc reste éligible au déclenchement du repos.
- L’entrée n’est jamais mutée.

---

### Task 1: Approfondir `rest` avec la planification par bloc

**Files:**
- Modify: `src/lib/rest.test.ts`
- Modify: `src/lib/rest.ts`

**Interfaces:**
- Consumes: `toBlocks<T extends Groupable>(rows: readonly T[]): Block<T>[]`.
- Consumes: `resolveRestSeconds(override, exerciseDefault)`.
- Produces: `RestPlan` and `restPlans<T extends Groupable & { id: string; restSeconds?: number }>(rows: readonly T[]): Map<string, RestPlan>`.

- [ ] **Step 1: Écrire les tests avant l’implémentation**

Dans `src/lib/rest.test.ts`, importer `DEFAULT_REST_SECONDS` et `restPlans`, puis
ajouter :

```ts
const plannedRows = (
  ...rows: Array<{ supersetGroup: number; restSeconds?: number }>
) =>
  rows.map((row, index) => ({
    id: `row-${index}`,
    ...row,
  }));

describe('restPlans', () => {
  it('plans independent rest for ungrouped rows', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 0, restSeconds: 60 },
          { supersetGroup: 0, restSeconds: 90 },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: true, seconds: 60 }],
      ['row-1', { isLastOfBlock: true, seconds: 90 }],
    ]);
  });

  it('shares the longest rest and marks only the end of a superset', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 7, restSeconds: 90 },
          { supersetGroup: 7, restSeconds: 180 },
          { supersetGroup: 7, restSeconds: 120 },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: false, seconds: 180 }],
      ['row-1', { isLastOfBlock: false, seconds: 180 }],
      ['row-2', { isLastOfBlock: true, seconds: 180 }],
    ]);
  });

  it('normalizes missing and invalid legacy durations', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 3 },
          { supersetGroup: 3, restSeconds: 0 },
          { supersetGroup: 3, restSeconds: Number.NaN },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: false, seconds: DEFAULT_REST_SECONDS }],
      ['row-1', { isLastOfBlock: false, seconds: DEFAULT_REST_SECONDS }],
      ['row-2', { isLastOfBlock: true, seconds: DEFAULT_REST_SECONDS }],
    ]);
  });

  it('never mutates its input', () => {
    const input = plannedRows(
      { supersetGroup: 1, restSeconds: 60 },
      { supersetGroup: 1, restSeconds: 90 },
    );
    const before = structuredClone(input);
    restPlans(input);
    expect(input).toEqual(before);
  });
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```powershell
npm.cmd run test:run -- src/lib/rest.test.ts
```

Expected: FAIL parce que `restPlans` n’est pas exporté.

- [ ] **Step 3: Implémenter le minimum dans `rest.ts`**

Importer `toBlocks` et le type `Groupable`, puis ajouter :

```ts
export interface RestPlan {
  isLastOfBlock: boolean;
  seconds: number;
}

export function restPlans<
  T extends Groupable & { id: string; restSeconds?: number },
>(rows: readonly T[]): Map<string, RestPlan> {
  const plans = new Map<string, RestPlan>();

  for (const block of toBlocks(rows)) {
    const seconds = Math.max(
      ...block.rows.map((row) => resolveRestSeconds(row.restSeconds, undefined)),
    );

    block.rows.forEach((row, index) => {
      plans.set(row.id, {
        isLastOfBlock: index === block.rows.length - 1,
        seconds,
      });
    });
  }

  return plans;
}
```

- [ ] **Step 4: Vérifier le passage au vert**

Run:

```powershell
npm.cmd run test:run -- src/lib/rest.test.ts src/lib/routineOrder.test.ts
```

Expected: 49 tests PASS.

- [ ] **Step 5: Tuer deux mutations manuelles**

Première mutation temporaire :

```ts
const seconds = Math.max(...);
```

devient :

```ts
const seconds = resolveRestSeconds(block.rows[0]?.restSeconds, undefined);
```

Run:

```powershell
npm.cmd run test:run -- src/lib/rest.test.ts
```

Expected: FAIL sur `shares the longest rest and marks only the end of a
superset`. Restaurer immédiatement `Math.max`.

Deuxième mutation temporaire :

```ts
isLastOfBlock: index === block.rows.length - 1,
```

devient :

```ts
isLastOfBlock: true,
```

Run:

```powershell
npm.cmd run test:run -- src/lib/rest.test.ts
```

Expected: FAIL sur les tests de superset. Restaurer la comparaison correcte,
puis relancer les deux fichiers et attendre 49 tests PASS.

### Task 2: Migrer `WorkoutScreen`

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `restPlans(rows)` from `@/lib/rest`.

- [ ] **Step 1: Supprimer le calcul local**

Dans `WorkoutScreen.tsx` :

- importer `restPlans` avec `isRestTriggering` ;
- supprimer l’interface locale `RestPlan` ;
- supprimer la fonction locale `restPlans` ;
- retirer `resolveRestSeconds` et `toBlocks` des imports devenus inutiles ;
- remplacer `restPlans(exercises)` par
  `restPlans(exercises.map(({ row }) => row))`.

- [ ] **Step 2: Vérifier la migration ciblée**

Run:

```powershell
rg -n "interface RestPlan|function restPlans" src
npm.cmd run test:run -- src/lib/rest.test.ts src/lib/routineOrder.test.ts src/features/workout/plateConfig.test.ts src/features/workout/PlateLoadSheet.test.tsx
npm.cmd run typecheck
```

Expected:

- une seule déclaration de `RestPlan` dans `rest.ts` ;
- une seule déclaration de `restPlans` dans `rest.ts` ;
- tous les tests ciblés et le typecheck passent.

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

Expected: cinq codes de sortie 0 et 771 tests Vitest.

- [ ] **Step 2: Mettre à jour `PROGRESS.md`**

Ajouter en tête :

- la seam `restPlans` ajoutée à `lib/rest` ;
- la fonction et le type locaux supprimés de `WorkoutScreen` ;
- la preuve TDD et les deux mutants tués ;
- l’absence de changement visible ou persistant ;
- le checkpoint du minuteur simple puis superset sur téléphone.

- [ ] **Step 3: Relire le diff**

Run:

```powershell
git diff --color=never
git diff --stat
git status --short
```

Expected: uniquement `rest.ts`, `rest.test.ts`, `WorkoutScreen.tsx`,
`PROGRESS.md` et ce plan.

- [ ] **Step 4: Commiter**

Run:

```powershell
git add docs/superpowers/plans/2026-07-29-workout-rest-plans.md src/lib/rest.ts src/lib/rest.test.ts src/features/workout/WorkoutScreen.tsx PROGRESS.md
git commit -m "refactor: centralise les plans de repos"
```

Expected: un commit atomique sur `master`, sans fichier étranger.
