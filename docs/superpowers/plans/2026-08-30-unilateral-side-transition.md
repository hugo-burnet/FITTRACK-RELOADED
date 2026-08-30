# Unilateral Side Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réactiver automatiquement la coche du second côté dix secondes après la première coche, même sans cadence et sans interaction annexe.

**Architecture:** `WorkoutSetRow` possède déjà l’horloge locale qui redessine le décompte. Elle utilisera cette même heure pour appeler `sideStageFor` et dériver son état interactif, tandis que le parent lui transmettra seulement le caractère unilatéral de l’exercice.

**Tech Stack:** React 19, TypeScript strict, Vitest, Testing Library, échéance epoch persistée dans Dexie.

## Global Constraints

- Conserver `SIDE_TRANSITION_MS` à `10_000`.
- Conserver l’échéance absolue `unilateralSecondSideStartsAt` comme source persistée.
- Ne créer aucun minuteur global, magasin Zustand ou nouvel écrit Dexie à l’échéance.
- Ne modifier ni cadence, ni annonces, ni repos, ni comportement des échauffements.
- Ne modifier aucun fichier de badge ou de palier appartenant à Gork.
- Selon la demande utilisateur, lancer les tests une seule fois, à la vérification finale après l’implémentation des deux plans.

## File Structure

- `src/features/workout/WorkoutSetRow.test.tsx` : reproduit la transition naturelle sans rendu du parent.
- `src/features/workout/WorkoutSetRow.tsx` : dérive le stade depuis la série, l’unilatéralité et son horloge locale.
- `src/features/workout/WorkoutExerciseCard.tsx` : transmet le booléen unilatéral à chaque ligne.
- `PROGRESS.md` : consigne les deux correctifs et le checkpoint téléphone.

---

### Task 1: Verrouiller la libération naturelle de la coche

**Files:**
- Create: `src/features/workout/WorkoutSetRow.test.tsx`
- Modify: `src/features/workout/WorkoutSetRow.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`

**Interfaces:**
- Consumes: `sideStageFor(set, unilateral, now): SideStage | null`.
- Produces: propriété `unilateral?: boolean` de `WorkoutSetRow`.

- [ ] **Step 1: Écrire le test de composant sans l’exécuter**

Créer `WorkoutSetRow.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import { entryColumns } from '@/lib/measurement';
import { WorkoutSetRow } from './WorkoutSetRow';

const set: WorkoutSet = {
  id: 'set-unilateral',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  workoutExerciseId: 'row-1',
  exerciseId: 'exercise-1',
  workoutId: 'workout-1',
  order: 0,
  setType: 'normal',
  side: 'both',
  weight: 12,
  reps: 8,
  isCompleted: 0,
  performedAt: 0,
  unilateralSecondSideStartsAt: 110_000,
};

describe('WorkoutSetRow — transition unilatérale', () => {
  afterEach(() => vi.useRealTimers());

  it('libère la coche du second côté à l’échéance sans rendu du parent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    render(
      <WorkoutSetRow
        set={set}
        number={1}
        columns={entryColumns('weight_reps')}
        previous={undefined}
        unilateral
        onWrite={vi.fn()}
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
        onMenu={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Changement de côté · 10' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(
      screen.getByRole('button', { name: 'Second côté — valider la série 1' }),
    ).toBeEnabled();
  });
});
```

- [ ] **Step 2: Donner l’unilatéralité à la ligne**

Dans `WorkoutSetRow.tsx`, remplacer l’import de type `SideStage` par :

```ts
import { sideStageFor } from './sideProgress';
```

Remplacer la propriété :

```ts
sideStage?: SideStage | null;
```

par :

```ts
unilateral?: boolean;
```

Puis remplacer la valeur par défaut `sideStage = null` par :

```ts
unilateral = false,
```

- [ ] **Step 3: Dériver le stade avec l’horloge locale**

Après l’effet qui entretient `now`, ajouter :

```ts
const sideStage = sideStageFor(set, unilateral, now);
```

Conserver les calculs existants de `turning`, `remainingSides` et `completeLabel`, qui liront désormais cette valeur locale.

- [ ] **Step 4: Transmettre l’identité unilatérale depuis la carte**

Dans `WorkoutExerciseCard.tsx`, remplacer :

```tsx
sideStage={sideStageOf(set.id)}
```

par :

```tsx
unilateral={identity.isUnilateral === 1}
```

Ne lancer aucun test avant la vérification finale.

---

### Task 2: Vérifier une seule fois les deux correctifs

**Files:**
- Modify: `PROGRESS.md`
- Verify: tous les fichiers modifiés par les deux plans.

**Interfaces:**
- Consumes: les deux correctifs terminés.
- Produces: arbre vérifié et journal de session à jour.

- [ ] **Step 1: Lancer le typecheck**

Run: `npm run typecheck`

Expected: exit 0, aucune erreur TypeScript.

- [ ] **Step 2: Lancer toute la suite de tests une seule fois**

Run: `npm run test:run`

Expected: exit 0, tous les tests passent. Ne relancer aucune suite si cette commande réussit.

- [ ] **Step 3: Construire la production**

Run: `npm run build`

Expected: exit 0, contrôle du corpus puis build Vite réussis.

- [ ] **Step 4: Mettre à jour le journal**

Ajouter en tête de `PROGRESS.md` une section datée du 2026-08-30 indiquant :

```markdown
## Correctifs documentation et séries unilatérales (2026-08-30)

- Le lien « Ce qu’en dit le corpus » d’un bloc ouvre désormais l’article actuel du Guide.
- Sans cadence, la coche du second côté se réactive seule après les dix secondes de transition.
- Vérifications : typecheck, suite Vitest complète lancée une seule fois, build de production.
- Checkpoint téléphone : ouvrir une semaine documentée d’un bloc, puis valider les deux côtés d’un exercice unilatéral sans cadence et attendre dix secondes sans toucher aux menus.
```

- [ ] **Step 5: Vérifier le diff sans toucher au travail de Gork**

Run: `git diff --check -- src/features/programs/phaseEvidence.ts src/features/programs/phaseEvidence.test.ts src/features/programs/ProgramDetailScreen.tsx src/features/programs/ProgramFlow.integration.test.tsx src/features/workout/WorkoutSetRow.tsx src/features/workout/WorkoutSetRow.test.tsx src/features/workout/WorkoutExerciseCard.tsx PROGRESS.md`

Expected: aucune sortie.

- [ ] **Step 6: Committer les deux correctifs et le journal atomiquement**

```bash
git add -- src/features/programs/phaseEvidence.ts src/features/programs/phaseEvidence.test.ts src/features/programs/ProgramDetailScreen.tsx src/features/programs/ProgramFlow.integration.test.tsx
git commit -m "fix(programs): réparer le lien vers le Guide"

git add -- src/features/workout/WorkoutSetRow.tsx src/features/workout/WorkoutSetRow.test.tsx src/features/workout/WorkoutExerciseCard.tsx
git commit -m "fix(workout): libérer la coche du second côté"

git add -- PROGRESS.md
git commit -m "docs: consigner les correctifs de séance"
```
