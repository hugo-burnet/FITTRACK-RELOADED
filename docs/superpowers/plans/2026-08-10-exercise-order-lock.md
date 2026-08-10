# Exercise Order Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verrouiller par défaut le réordonnancement des exercices dans l’éditeur de routine et la séance en cours, avec deux cadenas indépendants conservés uniquement pendant la session de l’application.

**Architecture:** Un store Zustand non persisté porte les deux états éphémères. `ReorderableList` reste la barrière fonctionnelle grâce à une prop `disabled`, tandis que les cartes masquent leurs poignées et qu’un bouton UI partagé affiche un SVG fermé ou ouvert. Aucun repository ni schéma Dexie ne change.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Tailwind CSS v4, Vitest, Testing Library, Dexie/fake-indexeddb pour les intégrations existantes.

## Global Constraints

- Code, variables et commentaires en anglais ; tous les textes visibles dans `src/i18n/fr.ts`.
- Cibles tactiles de 48 px minimum, thème sombre et usage mobile à une main.
- Aucun état de verrouillage dans Dexie, `localStorage` ou un middleware Zustand persistant.
- Le verrou ne bloque que le réordonnancement des exercices, jamais l’édition, l’ajout ou la suppression.
- Les deux écrans commencent verrouillés à chaque véritable lancement de l’application.
- Le verrou de routine et celui de séance restent indépendants.
- REQUIRED SUB-SKILL: utiliser `test-driven-development` pour les Tasks 1 à 5.
- REQUIRED SUB-SKILL demandé par l’utilisateur : lire et appliquer `frontend-design` avant la Task 3 et avant toute modification CSS/HTML.
- REQUIRED SUB-SKILL: utiliser `verification-before-completion` avant toute annonce de réussite, tout push et toute release.
- La règle de tonnage des exercices au poids du corps est hors périmètre et fera l’objet d’une spec séparée.

## File Map

- Create `src/stores/exerciseOrderLock.ts`: état Zustand éphémère et API de bascule/réinitialisation.
- Create `src/stores/exerciseOrderLock.test.ts`: contrat du store et indépendance des deux surfaces.
- Modify `src/ui/ReorderableList.tsx`: barrière `disabled` pour le pointeur et le clavier.
- Create `src/ui/ReorderableList.test.tsx`: preuve du blocage et conservation du comportement actif.
- Create `src/ui/OrderLockButton.tsx`: bouton tactile partagé, libellé accessible et choix du SVG.
- Create `src/ui/OrderLockButton.test.tsx`: contrat accessible et interaction du bouton.
- Modify `src/ui/icons.tsx`: SVG `LockIcon` et `UnlockIcon`.
- Modify `src/ui/index.ts`: export du bouton partagé.
- Modify `src/i18n/fr.ts`: deux libellés d’action centralisés.
- Modify `src/features/routines/RoutineEditorScreen.tsx`: store, bouton près du résumé et liste désactivable.
- Modify `src/features/routines/RoutineExerciseCard.tsx`: poignée conditionnelle.
- Modify `src/features/routines/RoutineFlow.integration.test.tsx`: état initial, bascule, remontage et réordonnancement.
- Modify `src/features/workout/WorkoutScreen.tsx`: store, bouton après « 80 % » et liste désactivable.
- Modify `src/features/workout/WorkoutExerciseCard.tsx`: poignée conditionnelle.
- Modify `src/features/workout/WorkoutScreen.integration.test.tsx`: état initial, indépendance, bascule et remontage.
- Modify `package.json` and `package-lock.json`: version `0.1.1` de la nouvelle APK.
- Modify `PROGRESS.md`: livraison, portes finales et checkpoint téléphone.

---

### Task 1: Store éphémère des deux cadenas

**Files:**
- Create: `src/stores/exerciseOrderLock.ts`
- Create: `src/stores/exerciseOrderLock.test.ts`

**Interfaces:**
- Consumes: `create` from `zustand`.
- Produces: `OrderLockSurface`, `ExerciseOrderLockStore`, `useExerciseOrderLock` avec `unlocked`, `toggle(surface)` et `reset()`.

- [ ] **Step 1: Écrire le test en échec**

Créer `src/stores/exerciseOrderLock.test.ts` :

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useExerciseOrderLock } from './exerciseOrderLock';

describe('exerciseOrderLock', () => {
  beforeEach(() => useExerciseOrderLock.getState().reset());

  it('verrouille les deux surfaces par défaut', () => {
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: false,
    });
  });

  it('bascule la routine et la séance indépendamment', () => {
    useExerciseOrderLock.getState().toggle('routine');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: false,
    });

    useExerciseOrderLock.getState().toggle('workout');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: true,
      workout: true,
    });

    useExerciseOrderLock.getState().toggle('routine');
    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: true,
    });
  });

  it('revient aux deux verrous fermés lors de la réinitialisation', () => {
    useExerciseOrderLock.getState().toggle('routine');
    useExerciseOrderLock.getState().toggle('workout');
    useExerciseOrderLock.getState().reset();

    expect(useExerciseOrderLock.getState().unlocked).toEqual({
      routine: false,
      workout: false,
    });
  });
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/stores/exerciseOrderLock.test.ts
```

Expected: FAIL parce que `./exerciseOrderLock` n’existe pas.

- [ ] **Step 3: Implémenter le store minimal non persisté**

Créer `src/stores/exerciseOrderLock.ts` :

```ts
import { create } from 'zustand';

export type OrderLockSurface = 'routine' | 'workout';

type OrderLockState = Record<OrderLockSurface, boolean>;

export interface ExerciseOrderLockStore {
  unlocked: OrderLockState;
  toggle: (surface: OrderLockSurface) => void;
  reset: () => void;
}

const LOCKED: OrderLockState = { routine: false, workout: false };

export const useExerciseOrderLock = create<ExerciseOrderLockStore>((set) => ({
  unlocked: LOCKED,
  toggle: (surface) =>
    set((state) => ({
      unlocked: {
        ...state.unlocked,
        [surface]: !state.unlocked[surface],
      },
    })),
  reset: () => set({ unlocked: LOCKED }),
}));
```

- [ ] **Step 4: Vérifier le passage du test**

Run:

```bash
npm run test:run -- src/stores/exerciseOrderLock.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Committer le store**

```bash
git add -- src/stores/exerciseOrderLock.ts src/stores/exerciseOrderLock.test.ts
git commit -m "feat: add ephemeral exercise order locks"
```

---

### Task 2: Barrière fonctionnelle dans ReorderableList

**Files:**
- Modify: `src/ui/ReorderableList.tsx`
- Create: `src/ui/ReorderableList.test.tsx`

**Interfaces:**
- Consumes: l’API existante `ReorderableList<T>` et ses `ItemState`.
- Produces: prop optionnelle `disabled?: boolean`, `false` par défaut ; aucune modification pour les consommateurs existants.

- [ ] **Step 1: Écrire les tests en échec**

Créer `src/ui/ReorderableList.test.tsx` :

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReorderableList } from './ReorderableList';

function renderList(disabled: boolean, onReorder = vi.fn()) {
  const view = render(
    <ReorderableList
      items={['A', 'B']}
      keyOf={(item) => item}
      disabled={disabled}
      onReorder={onReorder}
      renderItem={(item, _index, state) => (
        <button type="button" data-testid={`handle-${item}`} {...state.handleProps}>
          {item}
        </button>
      )}
    />,
  );

  return { ...view, onReorder };
}

describe('ReorderableList disabled', () => {
  it('ignore les flèches du clavier quand la liste est désactivée', () => {
    const { onReorder } = renderList(true);
    fireEvent.keyDown(screen.getByTestId('handle-A'), { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ignore le pointeur quand la liste est désactivée', () => {
    const { onReorder } = renderList(true);
    const handle = screen.getByTestId('handle-A');

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('conserve le déplacement clavier quand la liste est active', () => {
    const { onReorder } = renderList(false);
    fireEvent.keyDown(screen.getByTestId('handle-A'), { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/ui/ReorderableList.test.tsx
```

Expected: FAIL dans le premier test parce que la flèche appelle encore `onReorder(0, 1)` malgré
`disabled={true}`. Le `typecheck` échouera également tant que la prop n’existe pas.

- [ ] **Step 3: Ajouter la prop et les gardes d’interaction**

Dans le type `Props<T>` de `src/ui/ReorderableList.tsx`, ajouter :

```ts
  disabled?: boolean;
```

Remplacer la signature du composant par :

```tsx
export function ReorderableList<T>({
  items,
  keyOf,
  onReorder,
  renderItem,
  className,
  disabled = false,
}: Props<T>) {
```

Ajouter l’annulation d’un geste actif immédiatement après le calcul de `dragging` :

```tsx
  useEffect(() => {
    if (disabled) setDrag(null);
  }, [disabled]);
```

Ajouter cette première ligne dans `startDrag` :

```tsx
    if (disabled) return;
```

Ajouter cette première ligne dans `moveByKey` :

```tsx
    if (disabled) return;
```

Le reste du composant et la forme de `ItemState` restent inchangés.

- [ ] **Step 4: Vérifier les tests ciblés et la compatibilité des consommateurs**

Run:

```bash
npm run test:run -- src/ui/ReorderableList.test.tsx src/ui/edgeScroll.test.ts
npm run typecheck
```

Expected: PASS, puis TypeScript sort avec le code 0.

- [ ] **Step 5: Committer la barrière partagée**

```bash
git add -- src/ui/ReorderableList.tsx src/ui/ReorderableList.test.tsx
git commit -m "feat: allow reorderable lists to be locked"
```

---

### Task 3: Bouton tactile et SVG fermé/ouvert

**Files:**
- Create: `src/ui/OrderLockButton.tsx`
- Create: `src/ui/OrderLockButton.test.tsx`
- Modify: `src/ui/icons.tsx`
- Modify: `src/ui/index.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `t`, `LockIcon`, `UnlockIcon`.
- Produces: `OrderLockButton({ unlocked, onToggle })`, `LockIcon`, `UnlockIcon`, `common.unlockExerciseOrder`, `common.lockExerciseOrder`.

- [ ] **Step 1: Appliquer le skill frontend-design demandé par l’utilisateur**

Lire entièrement `.agents/skills/frontend-design/SKILL.md`, puis vérifier avant le code que le
contrôle respecte : cible 48 × 48 px, silhouette compréhensible sans couleur, alignement avec les
actions compactes existantes et absence de décoration étrangère au design system FitTrack.

- [ ] **Step 2: Écrire le test accessible en échec**

Créer `src/ui/OrderLockButton.test.tsx` :

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderLockButton } from './OrderLockButton';

describe('OrderLockButton', () => {
  it('annonce le déverrouillage quand le cadenas est fermé', () => {
    render(<OrderLockButton unlocked={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('annonce le verrouillage et appelle la bascule quand le cadenas est ouvert', () => {
    const onToggle = vi.fn();
    render(<OrderLockButton unlocked onToggle={onToggle} />);

    const button = screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/ui/OrderLockButton.test.tsx
```

Expected: FAIL parce que `./OrderLockButton` n’existe pas.

- [ ] **Step 4: Ajouter les deux SVG distincts**

Ajouter à `src/ui/icons.tsx` :

```tsx
/** Exercise order is protected from accidental movement. */
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

/** Exercise order can be changed until the user closes the shackle again. */
export function UnlockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M16 10V7a4 4 0 0 0-7.4-2.1" />
    </Icon>
  );
}
```

- [ ] **Step 5: Centraliser les deux libellés français**

Ajouter dans `fr.common` de `src/i18n/fr.ts` :

```ts
    unlockExerciseOrder: 'Déverrouiller l’ordre des exercices',
    lockExerciseOrder: 'Verrouiller l’ordre des exercices',
```

- [ ] **Step 6: Créer et exporter le bouton partagé**

Créer `src/ui/OrderLockButton.tsx` :

```tsx
import { t } from '@/i18n/fr';
import { LockIcon, UnlockIcon } from './icons';

export function OrderLockButton({
  unlocked,
  onToggle,
}: {
  unlocked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={t(
        unlocked ? 'common.lockExerciseOrder' : 'common.unlockExerciseOrder',
      )}
      aria-pressed={unlocked}
      onClick={onToggle}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
        active:bg-[var(--surface-1)]"
    >
      {unlocked ? <UnlockIcon /> : <LockIcon />}
    </button>
  );
}
```

Ajouter à `src/ui/index.ts` :

```ts
export { OrderLockButton } from './OrderLockButton';
```

- [ ] **Step 7: Vérifier le composant et le typage**

Run:

```bash
npm run test:run -- src/ui/OrderLockButton.test.tsx
npm run typecheck
```

Expected: PASS, 2 tests, puis TypeScript sort avec le code 0.

- [ ] **Step 8: Committer la primitive visuelle**

```bash
git add -- src/ui/OrderLockButton.tsx src/ui/OrderLockButton.test.tsx src/ui/icons.tsx src/ui/index.ts src/i18n/fr.ts
git commit -m "feat: add exercise order lock control"
```

---

### Task 4: Verrouiller l’éditeur de routine par défaut

**Files:**
- Modify: `src/features/routines/RoutineEditorScreen.tsx`
- Modify: `src/features/routines/RoutineExerciseCard.tsx`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`

**Interfaces:**
- Consumes: `useExerciseOrderLock`, `OrderLockButton`, `ReorderableList.disabled`.
- Produces: prop `reorderEnabled: boolean` sur `RoutineExerciseCard` et verrou de surface `routine`.

- [ ] **Step 1: Réinitialiser le store dans les tests existants**

Dans `src/features/routines/RoutineFlow.integration.test.tsx`, importer le store :

```ts
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
```

Remplacer `beforeEach(resetDb);` par :

```ts
  beforeEach(async () => {
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });
```

- [ ] **Step 2: Écrire le parcours en échec**

Ajouter `fireEvent` à l’import Testing Library, puis ajouter ce test :

```tsx
  it('verrouille l’ordre par défaut et garde le choix pendant la session', async () => {
    const first = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const second = await createCustomExercise({
      name: 'Tirage horizontal',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Haut du corps');
    await addExercisesToRoutine(routine.id, [first.id, second.id]);
    const user = userEvent.setup();
    const mounted = renderRoutineFlow(`/routines/${routine.id}`);

    await screen.findByText(first.name);
    expect(
      screen.queryByRole('button', { name: `Déplacer ${first.name}` }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }),
    );
    const firstHandle = screen.getByRole('button', { name: `Déplacer ${first.name}` });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });

    await waitFor(async () => {
      expect((await getRoutineDetail(routine.id))?.exercises[0]?.exercise?.id).toBe(second.id);
    });

    mounted.unmount();
    renderRoutineFlow(`/routines/${routine.id}`);
    expect(
      await screen.findByRole('button', { name: `Déplacer ${second.name}` }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' }),
    );
    expect(
      screen.queryByRole('button', { name: `Déplacer ${second.name}` }),
    ).not.toBeInTheDocument();
  });
```

Compléter l’import repository du test avec :

```ts
import {
  addExercisesToRoutine,
  createRoutine,
  getRoutineDetail,
  listRoutineSummaries,
} from '@/data/repositories/routines';
```

- [ ] **Step 3: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: FAIL car le bouton de déverrouillage n’existe pas et les poignées sont encore visibles.

- [ ] **Step 4: Brancher le store et le bouton dans RoutineEditorScreen**

Ajouter les imports :

```tsx
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
```

Ajouter `OrderLockButton` à l’import depuis `@/ui`.

Après l’état `sheet`, ajouter :

```tsx
  const reorderUnlocked = useExerciseOrderLock((state) => state.unlocked.routine);
  const toggleReorder = useExerciseOrderLock((state) => state.toggle);
```

Remplacer le paragraphe du résumé par :

```tsx
            <div className="flex min-h-12 items-center pl-1">
              <p className="label-xs min-w-0 flex-1 font-semibold text-[var(--text-2)]">
                {routineSummaryLine(exercises.length, setCount)}
              </p>
              <OrderLockButton
                unlocked={reorderUnlocked}
                onToggle={() => toggleReorder('routine')}
              />
            </div>
```

Ajouter à `ReorderableList` :

```tsx
              disabled={!reorderUnlocked}
```

Ajouter à `RoutineExerciseCard` :

```tsx
                  reorderEnabled={reorderUnlocked}
```

- [ ] **Step 5: Masquer la poignée dans RoutineExerciseCard**

Ajouter au type `Props` :

```ts
  reorderEnabled: boolean;
```

Récupérer `reorderEnabled` dans les props du composant, puis remplacer le bouton de poignée par :

```tsx
          {reorderEnabled && (
            <button
              type="button"
              aria-label={t('routine.dragHandle', { name })}
              className="flex w-11 shrink-0 cursor-grab items-center justify-center
                text-[var(--text-2)] active:cursor-grabbing"
              {...state.handleProps}
            >
              <GripIcon />
            </button>
          )}
```

- [ ] **Step 6: Vérifier le parcours routine**

Run:

```bash
npm run test:run -- src/features/routines/RoutineFlow.integration.test.tsx src/ui/ReorderableList.test.tsx
npm run typecheck
```

Expected: PASS, puis TypeScript sort avec le code 0.

- [ ] **Step 7: Committer l’intégration routine**

```bash
git add -- src/features/routines/RoutineEditorScreen.tsx src/features/routines/RoutineExerciseCard.tsx src/features/routines/RoutineFlow.integration.test.tsx
git commit -m "feat: lock routine exercise order by default"
```

---

### Task 5: Verrouiller la séance en cours par défaut

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`

**Interfaces:**
- Consumes: `useExerciseOrderLock`, `OrderLockButton`, `ReorderableList.disabled`.
- Produces: prop `reorderEnabled: boolean` sur `WorkoutExerciseCard` et verrou de surface `workout`.

- [ ] **Step 1: Réinitialiser le store dans les tests de séance**

Importer :

```ts
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
```

Remplacer le `beforeEach` existant par :

```ts
  beforeEach(async () => {
    useRestTimer.getState().stop();
    useExerciseOrderLock.getState().reset();
    await resetDb();
  });
```

- [ ] **Step 2: Écrire le parcours en échec**

Ajouter à `src/features/workout/WorkoutScreen.integration.test.tsx` :

```tsx
  it('garde un cadenas de séance indépendant pendant la session', async () => {
    await seedActiveWorkout();
    useExerciseOrderLock.getState().toggle('routine');
    const user = userEvent.setup();
    const mounted = renderWorkout();

    await screen.findByText('Développé couché');
    expect(
      screen.queryByRole('button', { name: 'Déplacer Développé couché' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }),
    );
    expect(
      screen.getByRole('button', { name: 'Déplacer Développé couché' }),
    ).toBeVisible();

    mounted.unmount();
    renderWorkout();
    expect(
      await screen.findByRole('button', { name: 'Déplacer Développé couché' }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Déplacer Développé couché' }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx
```

Expected: FAIL car le bouton de déverrouillage n’existe pas et la poignée est visible par défaut.

- [ ] **Step 4: Brancher le store et le bouton dans WorkoutScreen**

Ajouter les imports :

```tsx
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
```

Ajouter `OrderLockButton` à l’import depuis `@/ui`.

Avec les autres hooks d’état du composant, ajouter :

```tsx
  const reorderUnlocked = useExerciseOrderLock((state) => state.unlocked.workout);
  const toggleReorder = useExerciseOrderLock((state) => state.toggle);
```

Dans la barre `sub`, placer immédiatement après le `Toggle` du deload :

```tsx
            <OrderLockButton
              unlocked={reorderUnlocked}
              onToggle={() => toggleReorder('workout')}
            />
```

Supprimer le `<span className="w-4 shrink-0" />` situé entre le deload et le bouton tout
replier/déplier afin que le cadenas soit réellement adjacent à « 80 % ».

Ajouter à `ReorderableList` :

```tsx
              disabled={!reorderUnlocked}
```

Ajouter à `WorkoutExerciseCard` :

```tsx
                  reorderEnabled={reorderUnlocked}
```

- [ ] **Step 5: Masquer la poignée dans WorkoutExerciseCard**

Ajouter au type `Props` :

```ts
  reorderEnabled: boolean;
```

Récupérer `reorderEnabled` dans les props du composant, puis remplacer le bouton de poignée par :

```tsx
          {reorderEnabled && (
            <button
              type="button"
              aria-label={t('routines.dragHandle', { name })}
              className="flex w-11 shrink-0 cursor-grab items-center justify-center
                text-[var(--text-2)] active:cursor-grabbing"
              {...state.handleProps}
            >
              <GripIcon />
            </button>
          )}
```

- [ ] **Step 6: Vérifier le parcours séance et le deload voisin**

Run:

```bash
npm run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx src/ui/OrderLockButton.test.tsx
npm run typecheck
```

Expected: PASS ; le test deload existant trouve toujours son switch « 80 % » et TypeScript sort avec le code 0.

- [ ] **Step 7: Committer l’intégration séance**

```bash
git add -- src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.integration.test.tsx
git commit -m "feat: lock workout exercise order by default"
```

---

### Task 6: Vérification complète, version 0.1.1 et mémoire du projet

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: tous les commits des Tasks 1 à 5 et la procédure `docs/ANDROID.md`.
- Produces: version Android `0.1.1`, état de progression à jour et arbre prêt à publier.

- [ ] **Step 1: Invoquer verification-before-completion**

Lire entièrement le skill et suivre sa règle d’évidence avant toute affirmation, tout push ou toute release.

- [ ] **Step 2: Passer la version applicative à 0.1.1 sans créer de tag**

Run:

```bash
npm version 0.1.1 --no-git-tag-version
```

Expected: `v0.1.1`, avec `package.json` et `package-lock.json` modifiés uniquement sur la version.

- [ ] **Step 3: Exécuter toutes les portes locales, y compris Android**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run android:sync
```

Expected: les cinq commandes sortent avec le code 0 ; `android:sync` termine par une synchronisation Capacitor réussie.

- [ ] **Step 4: Mettre à jour PROGRESS.md avec des faits vérifiés**

Remplacer l’en-tête de dernière mise à jour par :

```markdown
**Dernière mise à jour :** 2026-08-10 (**Verrouillage de l’ordre des exercices**).

L’éditeur de routine et la séance en cours démarrent avec leur ordre verrouillé. Deux cadenas
indépendants, conservés uniquement pendant la session de l’application, masquent ou rendent les
poignées et bloquent réellement le pointeur comme le clavier. Le cadenas de séance se trouve après
« 80 % » ; celui de routine accompagne le résumé de la liste.

La version `0.1.1` est prête pour la release Android. Les portes locales lint, typecheck, tests,
build PWA et synchronisation Capacitor sortent à 0.

**Checkpoint téléphone :** installer `FitTrack-v0.1.1.apk` par-dessus l’application existante sans
la désinstaller. Dans une routine puis une séance, vérifier que les poignées sont absentes par
défaut, que les cadenas fermé/ouvert permettent le déplacement séparément, puis forcer l’arrêt et
relancer l’app pour confirmer le retour des deux cadenas fermés sans perte de données.

**Mise à jour précédente :** 2026-08-09 (**Lot 10 — application Android Capacitor**).
```

Conserver sous ce nouveau bloc le texte qui suivait l’ancien en-tête Lot 10, sans le dupliquer.

- [ ] **Step 5: Vérifier le diff final et committer la préparation de release**

Run:

```bash
git diff --check
git status --short
git diff -- package.json package-lock.json PROGRESS.md
```

Expected: aucune erreur de whitespace ; seuls `package.json`, `package-lock.json` et `PROGRESS.md` restent non commités après les commits des Tasks 1 à 5.

```bash
git add -- package.json package-lock.json PROGRESS.md
git commit -m "chore: prepare Android release v0.1.1"
```

Expected: commit créé et `git status --short` vide.

---

### Task 7: Push, tag et publication de la nouvelle APK

**Files:**
- No file changes.

**Interfaces:**
- Consumes: branche `master` propre, remote `origin`, workflow `.github/workflows/android.yml`, secrets de signature déjà configurés.
- Produces: branche distante à jour, tag `v0.1.1`, GitHub Release et asset `FitTrack-v0.1.1.apk`.

- [ ] **Step 1: Confirmer la branche, le tag disponible et l’arbre propre**

Run:

```bash
git branch --show-current
git status --short
git tag --list v0.1.1
```

Expected: `master`, aucun statut court, aucune sortie pour le tag.

- [ ] **Step 2: Pousser master**

Run:

```bash
git push origin master
```

Expected: `master -> master` et démarrage du workflow Android de branche.

- [ ] **Step 3: Créer puis pousser le tag de release**

Run:

```bash
git tag -a v0.1.1 -m "FitTrack Android v0.1.1"
git push origin v0.1.1
```

Expected: `[new tag] v0.1.1 -> v0.1.1`. Le workflow déclenché par le tag publie la GitHub Release.

- [ ] **Step 4: Identifier et suivre le run du tag jusqu’au succès**

Run in PowerShell:

```powershell
$releaseRun = gh run list --workflow android.yml --limit 20 --json databaseId,headBranch --jq '.[] | select(.headBranch == "v0.1.1") | .databaseId' | Select-Object -First 1
gh run watch $releaseRun --exit-status
```

Expected: le run se termine avec `✓` et code 0. Si la première commande ne retourne encore aucun identifiant, la relancer une fois que GitHub a enregistré le push du tag.

- [ ] **Step 5: Vérifier la release et son APK**

Run:

```bash
gh release view v0.1.1 --json url,assets --jq '{url: .url, assets: [.assets[].name]}'
```

Expected: une URL GitHub Release et `FitTrack-v0.1.1.apk` dans `assets`.

- [ ] **Step 6: Annoncer le checkpoint manuel sans prétendre l’avoir exécuté**

Donner à l’utilisateur l’URL de la release et lui demander de télécharger `FitTrack-v0.1.1.apk`,
de l’ouvrir par-dessus l’installation existante sans désinstaller FitTrack, puis d’effectuer le
checkpoint téléphone consigné dans `PROGRESS.md`.
