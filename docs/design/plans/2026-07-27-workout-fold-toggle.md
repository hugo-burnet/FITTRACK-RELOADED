# Workout Fold Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la commande globale de séance en vraie bascule « Tout replier / Tout déplier » avec deux SVG immédiatement distincts.

**Architecture:** Une fonction pure produit la prochaine commande globale versionnée. `WorkoutScreen` possède cette commande et affiche l’action inverse disponible ; chaque `WorkoutExerciseCard` applique explicitement la cible `expanded` à chaque nouvelle version, sans remonter son état local.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Vitest, navigateur intégré en 375 × 812 px.

## Global Constraints

- Interface utilisateur en français via `src/i18n/fr.ts`, aucune chaîne en dur.
- Cible tactile carrée de 48 × 48 px.
- État strictement éphémère, aucune écriture Dexie.
- Les ouvertures manuelles et les règles automatiques liées aux séries restent inchangées.
- Aucun changement dans `src/data/repositories/history.ts`, déjà modifié localement par l’utilisateur.

---

### Task 1: Commande globale versionnée

**Files:**
- Create: `src/features/workout/workoutFold.ts`
- Test: `src/features/workout/workoutFold.test.ts`

**Interfaces:**
- Produces: `WorkoutFoldCommand`, `INITIAL_WORKOUT_FOLD_COMMAND`, `nextWorkoutFoldCommand(current)`.
- Consumes: aucun état React ni repository.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  INITIAL_WORKOUT_FOLD_COMMAND,
  nextWorkoutFoldCommand,
} from './workoutFold';

describe('nextWorkoutFoldCommand', () => {
  it('replie puis déplie toutes les cartes', () => {
    const collapsed = nextWorkoutFoldCommand(INITIAL_WORKOUT_FOLD_COMMAND);
    const expanded = nextWorkoutFoldCommand(collapsed);

    expect(collapsed).toEqual({ version: 1, expanded: false });
    expect(expanded).toEqual({ version: 2, expanded: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/features/workout/workoutFold.test.ts
```

Expected: FAIL because `./workoutFold` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export type WorkoutFoldCommand = {
  version: number;
  expanded: boolean;
};

export const INITIAL_WORKOUT_FOLD_COMMAND: WorkoutFoldCommand = {
  version: 0,
  expanded: true,
};

export function nextWorkoutFoldCommand(
  current: WorkoutFoldCommand,
): WorkoutFoldCommand {
  return {
    version: current.version + 1,
    expanded: !current.expanded,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/features/workout/workoutFold.test.ts
```

Expected: 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/workout/workoutFold.ts src/features/workout/workoutFold.test.ts
git commit -m "test: couvre la bascule globale des cartes"
```

---

### Task 2: Branchement du bouton et pictogrammes opposés

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/ui/icons.tsx`
- Modify: `src/i18n/fr.ts`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: `WorkoutFoldCommand`, `INITIAL_WORKOUT_FOLD_COMMAND`, `nextWorkoutFoldCommand`.
- Produces: prop `foldCommand: WorkoutFoldCommand` sur `WorkoutExerciseCard`.

- [ ] **Step 1: Replace the one-way signal in `WorkoutScreen`**

```tsx
const [foldCommand, setFoldCommand] = useState(INITIAL_WORKOUT_FOLD_COMMAND);
const willExpand = !foldCommand.expanded;

<button
  type="button"
  aria-label={t(willExpand ? 'workout.expandAll' : 'workout.collapseAll')}
  onClick={() => setFoldCommand(nextWorkoutFoldCommand)}
  className="flex size-12 shrink-0 items-center justify-center ..."
>
  {willExpand ? <ExpandAllIcon /> : <CollapseAllIcon />}
</button>
```

Pass `foldCommand={foldCommand}` to every `WorkoutExerciseCard`.

- [ ] **Step 2: Apply the explicit target in each card**

Replace `collapseSignal` by `foldCommand`. Keep `expanded` local, but track the
last applied version:

```tsx
const [seenFoldVersion, setSeenFoldVersion] = useState(foldCommand.version);
if (foldCommand.version !== seenFoldVersion) {
  setSeenFoldVersion(foldCommand.version);
  setWasAllDone(allDone);
  setExpanded(foldCommand.expanded);
} else if (allDone !== wasAllDone) {
  setWasAllDone(allDone);
  setExpanded(!allDone);
}
```

- [ ] **Step 3: Draw the two action icons**

```tsx
export function CollapseAllIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h7" />
      <path d="M4 12h7" />
      <path d="M4 17h7" />
      <path d="m14 14 3-3 3 3" />
    </Icon>
  );
}

export function ExpandAllIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h7" />
      <path d="M4 12h7" />
      <path d="M4 17h7" />
      <path d="m14 10 3 3 3-3" />
    </Icon>
  );
}
```

Add `workout.expandAll: 'Tout déplier'` next to `workout.collapseAll`.

- [ ] **Step 4: Run static verification**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Verify in the browser at 375 × 812**

With three exercises in an active workout:

1. assert the button is named `Tout replier` and measures 48 × 48 px;
2. click it and assert all exercise headers have `aria-expanded="false"`;
3. assert the same button is now named `Tout déplier`;
4. click it and assert all exercise headers have `aria-expanded="true"`;
5. verify `document.documentElement.scrollWidth === window.innerWidth`;
6. visually inspect both SVG states.

- [ ] **Step 6: Update progress and run all gates**

Document the corrected two-way behavior in `PROGRESS.md`, then run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: 32 test files, 473 tests, and only the historical Vite chunk warning.

- [ ] **Step 7: Commit**

```bash
git add PROGRESS.md src/features/workout/WorkoutScreen.tsx \
  src/features/workout/WorkoutExerciseCard.tsx src/ui/icons.tsx src/i18n/fr.ts
git commit -m "fix: rend le repli global réversible"
```
