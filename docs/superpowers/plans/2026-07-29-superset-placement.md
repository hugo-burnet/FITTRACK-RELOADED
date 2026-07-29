# Superset Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de `lib/routineOrder` l’unique module qui transforme les groupes de supersets en positions de rendu partagées par les routines et les séances.

**Architecture:** `supersetPlaces` rejoint `toBlocks` dans le module pur qui possède déjà l’ordre et l’adjacence des supersets. Les deux écrans projettent leurs détails vers les lignes persistées, tandis que les deux cartes importent un type commun sans changer leurs props ni leur rendu.

**Tech Stack:** TypeScript strict, Vitest, React 19.

## Global Constraints

- Aucun changement de schéma Dexie, migration ou donnée.
- Aucun changement visuel, de texte ou d’interaction.
- Code et noms en anglais ; aucun nouveau texte UI.
- La règle accepte uniquement `id` et `supersetGroup`.
- L’entrée n’est jamais mutée.
- L’éditeur de routine et la séance doivent produire exactement les mêmes placements qu’avant.

---

### Task 1: Approfondir `routineOrder` avec les placements de supersets

**Files:**
- Modify: `src/lib/routineOrder.test.ts`
- Modify: `src/lib/routineOrder.ts`
- Modify: `src/features/routines/RoutineEditorScreen.tsx`
- Modify: `src/features/routines/RoutineExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`

**Interfaces:**
- Consumes: `toBlocks<T extends Groupable>(rows: readonly T[]): Block<T>[]`.
- Produces: `SupersetPlace` and `supersetPlaces<T extends Groupable & { id: string }>(rows: readonly T[]): Map<string, SupersetPlace>`.

- [ ] **Step 1: Écrire les tests avant l’implémentation**

Dans `src/lib/routineOrder.test.ts`, importer `supersetPlaces` et ajouter :

```ts
const identifiedRows = (...groups: number[]) =>
  groups.map((supersetGroup, index) => ({
    id: `row-${index}`,
    supersetGroup,
  }));

describe('supersetPlaces', () => {
  it('omits rows outside a superset', () => {
    expect(supersetPlaces(identifiedRows(0, 0))).toEqual(new Map());
  });

  it('indexes every member and shares the complete block size', () => {
    expect([...supersetPlaces(identifiedRows(0, 4, 4, 4, 0))]).toEqual([
      ['row-1', { index: 0, size: 3 }],
      ['row-2', { index: 1, size: 3 }],
      ['row-3', { index: 2, size: 3 }],
    ]);
  });

  it('keeps independent blocks independent', () => {
    expect([...supersetPlaces(identifiedRows(1, 1, 0, 2, 2))]).toEqual([
      ['row-0', { index: 0, size: 2 }],
      ['row-1', { index: 1, size: 2 }],
      ['row-3', { index: 0, size: 2 }],
      ['row-4', { index: 1, size: 2 }],
    ]);
  });

  it('never mutates its input', () => {
    const input = identifiedRows(1, 1);
    const before = structuredClone(input);
    supersetPlaces(input);
    expect(input).toEqual(before);
  });
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```powershell
npm.cmd run test:run -- src/lib/routineOrder.test.ts
```

Expected: FAIL parce que `supersetPlaces` n’est pas exporté.

- [ ] **Step 3: Implémenter le minimum dans `routineOrder.ts`**

Ajouter :

```ts
export interface SupersetPlace {
  index: number;
  size: number;
}

export function supersetPlaces<T extends Groupable & { id: string }>(
  rows: readonly T[],
): Map<string, SupersetPlace> {
  const places = new Map<string, SupersetPlace>();

  for (const block of toBlocks(rows)) {
    if (block.group === 0) continue;
    block.rows.forEach((row, index) => {
      places.set(row.id, { index, size: block.rows.length });
    });
  }

  return places;
}
```

- [ ] **Step 4: Vérifier le passage au vert**

Run:

```powershell
npm.cmd run test:run -- src/lib/routineOrder.test.ts
```

Expected: 24 tests PASS.

- [ ] **Step 5: Tuer deux mutations manuelles**

Première mutation temporaire :

```ts
if (block.group === 0) continue;
```

devient :

```ts
if (false) continue;
```

Run:

```powershell
npm.cmd run test:run -- src/lib/routineOrder.test.ts
```

Expected: FAIL sur `omits rows outside a superset`. Restaurer immédiatement la
condition correcte.

Deuxième mutation temporaire :

```ts
places.set(row.id, { index, size: block.rows.length });
```

devient :

```ts
places.set(row.id, { index, size: 1 });
```

Run:

```powershell
npm.cmd run test:run -- src/lib/routineOrder.test.ts
```

Expected: FAIL sur `indexes every member and shares the complete block size`.
Restaurer immédiatement `block.rows.length`, puis relancer le test et attendre
24 tests PASS.

- [ ] **Step 6: Migrer les écrans**

Dans `RoutineEditorScreen.tsx`, importer :

```ts
import { supersetPlaces } from '@/lib/routineOrder';
```

Supprimer la fonction locale et remplacer :

```ts
const places = supersetPlaces(exercises);
```

par :

```ts
const places = supersetPlaces(exercises.map(({ row }) => row));
```

Appliquer la même modification à `WorkoutScreen.tsx`.

- [ ] **Step 7: Unifier le type des cartes**

Dans `RoutineExerciseCard.tsx` et `WorkoutExerciseCard.tsx`, supprimer le type
local et importer :

```ts
import type { SupersetPlace } from '@/lib/routineOrder';
```

Ne modifier ni le type de la prop `superset`, ni son rendu.

- [ ] **Step 8: Vérifier la migration ciblée**

Run:

```powershell
rg -n "type SupersetPlace|interface SupersetPlace|function supersetPlaces" src
npm.cmd run test:run -- src/lib/routineOrder.test.ts src/features/workout/plateConfig.test.ts src/features/workout/PlateLoadSheet.test.tsx
npm.cmd run typecheck
```

Expected:

- une seule déclaration `SupersetPlace` dans `routineOrder.ts` ;
- une seule déclaration `supersetPlaces` dans `routineOrder.ts` ;
- tous les tests ciblés et le typecheck passent.

### Task 2: Vérifier, documenter et committer

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

Expected: cinq codes de sortie 0 et 767 tests Vitest.

- [ ] **Step 2: Mettre à jour `PROGRESS.md`**

Ajouter en tête :

- la seam `supersetPlaces` ;
- les deux écrans et deux cartes migrés ;
- la preuve TDD et les deux mutants tués ;
- l’absence de changement visible ou persistant ;
- le checkpoint routine puis séance sur téléphone.

- [ ] **Step 3: Relire le diff**

Run:

```powershell
git diff --color=never
git diff --stat
git status --short
```

Expected: uniquement les six fichiers applicatifs, `PROGRESS.md` et ce plan.

- [ ] **Step 4: Commiter**

Run:

```powershell
git add docs/superpowers/plans/2026-07-29-superset-placement.md src/lib/routineOrder.ts src/lib/routineOrder.test.ts src/features/routines/RoutineEditorScreen.tsx src/features/routines/RoutineExerciseCard.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutExerciseCard.tsx PROGRESS.md
git commit -m "refactor: centralise le placement des supersets"
```

Expected: un commit atomique sur `master`, sans fichier étranger.
