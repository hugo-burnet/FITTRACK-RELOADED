# Workout Collapse All Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la séance active une commande SVG épinglée qui replie toutes les cartes d’exercice en un geste.

**Architecture:** `WorkoutScreen` possède un compteur éphémère incrémenté à chaque appui. Chaque `WorkoutExerciseCard` reçoit ce signal monotone et replie son état local lorsqu’il change, sans déplacer la gestion existante de l’ouverture automatique liée aux séries terminées. La commande vit dans la ligne d’avancement sous l’en-tête.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, SVG React existant dans `src/ui/icons.tsx`.

## Global Constraints

- La commande n’affiche aucun texte visible.
- Son libellé accessible français est « Tout replier ».
- La cible tactile mesure au moins 48 × 48 px.
- Elle n’apparaît que si la séance contient au moins un exercice.
- Elle replie les exercices terminés ou non.
- Une carte reste rouvrable individuellement après l’action.
- Les règles automatiques de repli/réouverture liées à `allDone` restent inchangées.
- Aucun état n’est écrit dans IndexedDB.
- Aucun comportement de repos, record, superset ou réordonnancement ne change.

---

### Task 1: Icône et texte accessible

**Files:**
- Modify: `src/ui/icons.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: `CollapseAllIcon(props: IconProps)` et la clé `workout.collapseAll`.

- [ ] **Step 1: Ajouter l’icône SVG**

Dans `src/ui/icons.tsx`, ajouter une icône 24 × 24 utilisant `currentColor` :

```tsx
/** Replier toutes les cartes — deux panneaux qui se rapprochent. */
export function CollapseAllIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5h14" />
      <path d="m8 7 4 3 4-3" />
      <path d="m8 17 4-3 4 3" />
      <path d="M5 19.5h14" />
    </Icon>
  );
}
```

- [ ] **Step 2: Ajouter le texte français**

Dans le groupe `workout` de `src/i18n/fr.ts` :

```ts
collapseAll: 'Tout replier',
```

- [ ] **Step 3: Vérifier et commit**

```bash
npm run typecheck
npm run lint
git add src/ui/icons.tsx src/i18n/fr.ts
git commit -m "feat: ajoute l'icône pour tout replier"
```

### Task 2: Signal de repli partagé

**Files:**
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- `WorkoutExerciseCard` consomme une nouvelle prop `collapseSignal: number`.
- `WorkoutScreen` produit un entier monotone via `setCollapseSignal((value) => value + 1)`.

- [ ] **Step 1: Étendre les props de la carte**

Ajouter :

Ajouter exactement `collapseSignal: number;` dans le type `Props`, après `state: ItemState;`.

Puis lire `collapseSignal` dans les paramètres de `WorkoutExerciseCard`.

- [ ] **Step 2: Replier la carte lorsque le signal change**

À côté de `expanded` et `wasAllDone` :

```ts
const [seenCollapseSignal, setSeenCollapseSignal] =
  useState(collapseSignal);

if (collapseSignal !== seenCollapseSignal) {
  setSeenCollapseSignal(collapseSignal);
  setWasAllDone(allDone);
  setExpanded(false);
} else if (allDone !== wasAllDone) {
  setWasAllDone(allDone);
  setExpanded(!allDone);
}
```

Remplacer l’ancien `if (allDone !== wasAllDone)` par ce bloc afin qu’un même rendu ne lance pas
deux transitions concurrentes. La synchronisation de `wasAllDone` dans la première branche empêche
une carte incomplète de se rouvrir au rendu suivant.

- [ ] **Step 3: Produire et transmettre le signal**

Dans `WorkoutScreen` :

```ts
const [collapseSignal, setCollapseSignal] = useState(0);
```

Puis, dans chaque `WorkoutExerciseCard` :

```tsx
collapseSignal={collapseSignal}
```

- [ ] **Step 4: Vérifier le comportement existant**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run
```

Expected: PASS ; aucune prop manquante et aucune régression des 472 tests existants.

- [ ] **Step 5: Commit atomique**

```bash
git add src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.tsx
git commit -m "feat: permet de replier toutes les cartes"
```

### Task 3: Commande épinglée dans la ligne d’avancement

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `CollapseAllIcon`, `t('workout.collapseAll')`, `setCollapseSignal`.
- Produces: un bouton de 48 px dans `Screen.sub`.

- [ ] **Step 1: Remplacer le paragraphe d’avancement par une ligne instrumentée**

Importer `CollapseAllIcon`, puis remplacer le contenu de `sub` par :

```tsx
sub={
  exercises.length > 0 ? (
    <div className="flex min-h-12 items-center border-b border-[var(--border)] pl-4">
      <p className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
        {workoutProgressLine(completedSets, totalSets)}
      </p>
      <button
        type="button"
        aria-label={t('workout.collapseAll')}
        onClick={() => setCollapseSignal((value) => value + 1)}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl
          text-[var(--text-2)] active:bg-[var(--surface-1)]"
      >
        <CollapseAllIcon />
      </button>
    </div>
  ) : undefined
}
```

- [ ] **Step 2: Vérifier la mise en page mobile**

En 375 × 812 px :

- le titre, le chrono et le menu gardent leur largeur actuelle ;
- l’avancement reste sur une ligne ;
- le bouton mesure 48 × 48 px ;
- l’icône reste visible pendant le défilement ;
- aucun débordement horizontal n’apparaît.

- [ ] **Step 3: Vérifier les transitions de cartes**

Avec au moins trois exercices :

1. ouvrir toutes les cartes ;
2. appuyer sur « Tout replier » ;
3. vérifier `aria-expanded="false"` sur chaque bouton d’en-tête ;
4. rouvrir une seule carte ;
5. terminer puis décocher sa dernière série et vérifier les automatismes existants.

- [ ] **Step 4: Commit atomique**

```bash
git add src/features/workout/WorkoutScreen.tsx
git commit -m "feat: épingle l'action tout replier"
```

### Task 4: Portes finales et mémoire

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Produces: validation finale du micro-changement.

- [ ] **Step 1: Lancer les quatre portes**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: quatre codes de sortie 0 ; seul le warning Vite historique du chunk principal peut
rester.

- [ ] **Step 2: Mettre à jour et committer `PROGRESS.md`**

Consigner la position de la commande, le résultat mobile 375 × 812 px, les automatismes préservés,
le nombre final de tests et le checkpoint téléphone.

```bash
git add PROGRESS.md
git commit -m "docs: consigne la commande tout replier"
```
