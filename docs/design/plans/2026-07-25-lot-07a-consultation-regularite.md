# Lot 07A — Consultation et régularité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l’écran Historique vide par un journal paginé, un calendrier mensuel et une carte de régularité dont l’objectif hebdomadaire suit les changements de programme.

**Architecture:** La logique calendaire reste pure dans `src/lib/history.ts`. Les lectures IndexedDB et la persistance du réglage passent par deux repositories, puis l’écran s’abonne à leurs résultats avec `useLiveQuery`. Les composants visuels sont séparés par responsabilité afin de garder `HistoryScreen.tsx` comme orchestrateur.

**Tech Stack:** React 19, TypeScript strict, Dexie 4, `dexie-react-hooks`, Tailwind CSS v4, Vitest et `fake-indexeddb`.

## Global Constraints

- Toute la fonctionnalité marche hors-ligne, sans compte ni réseau.
- Aucune limite artificielle : la pagination ne tronque jamais l’historique stocké.
- L’interface est en français et chaque texte vit dans `src/i18n/fr.ts`.
- Les composants n’importent jamais `db` directement.
- Les cibles tactiles font au moins 48 px.
- Une semaine suit le calendrier local, du lundi 00:00 au lundi suivant ; aucun calcul n’ajoute sept jours fixes en millisecondes.
- Le premier objectif hebdomadaire vaut pour tout l’historique ; les changements suivants prennent effet le lundi de leur semaine et ne réécrivent pas les semaines antérieures.
- `sessions` est un entier strictement positif sans maximum artificiel.

---

### Task 1: Moteur calendaire et streak

**Files:**
- Create: `src/lib/history.ts`
- Test: `src/lib/history.test.ts`

**Interfaces:**
- Consumes: timestamps epoch en millisecondes des séances terminées.
- Produces:

```ts
export interface WeeklyTrainingGoal {
  effectiveFromWeek: number;
  sessions: number;
}

export interface WeeklyRegularity {
  currentCompleted: number;
  currentGoal: number | null;
  streak: number;
}

export function startOfLocalWeek(timestamp: number): number;
export function addLocalWeeks(weekStart: number, amount: number): number;
export function resolveWeeklyGoal(
  history: readonly WeeklyTrainingGoal[],
  weekStart: number,
): number | null;
export function calculateWeeklyRegularity(
  completedWorkoutTimestamps: readonly number[],
  history: readonly WeeklyTrainingGoal[],
  now: number,
): WeeklyRegularity;
```

- [ ] **Step 1: Écrire les tests qui fixent les semaines locales et la chronologie des objectifs**

```ts
describe('startOfLocalWeek', () => {
  it('ramène un dimanche au lundi local précédent', () => {
    const sunday = new Date(2026, 6, 26, 18).getTime();
    expect(new Date(startOfLocalWeek(sunday))).toEqual(new Date(2026, 6, 20));
  });
});

describe('resolveWeeklyGoal', () => {
  const history = [
    { effectiveFromWeek: 0, sessions: 4 },
    { effectiveFromWeek: new Date(2026, 7, 3).getTime(), sessions: 3 },
  ];

  it('applique le premier objectif à tout le passé', () => {
    expect(resolveWeeklyGoal(history, new Date(2025, 0, 6).getTime())).toBe(4);
  });

  it('préserve le nouvel objectif à partir de son lundi', () => {
    expect(resolveWeeklyGoal(history, new Date(2026, 7, 3).getTime())).toBe(3);
  });
});
```

Ajouter des cas pour : absence d’objectif, séances dupliquées le même jour, semaine courante sous
l’objectif, semaine courante atteignant l’objectif, semaine close ratée, changement d’objectif,
et changement d’heure traversé par `addLocalWeeks`.

- [ ] **Step 2: Lancer le test et constater l’échec attendu**

Run: `npm run test:run -- src/lib/history.test.ts`

Expected: FAIL avec l’import `@/lib/history` introuvable.

- [ ] **Step 3: Implémenter le moteur minimal**

```ts
export function startOfLocalWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - mondayOffset);
  return date.getTime();
}

export function addLocalWeeks(weekStart: number, amount: number): number {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + amount * 7);
  return date.getTime();
}
```

Normaliser l’historique par `effectiveFromWeek`, compter chaque workout une seule fois dans sa
semaine, puis parcourir les semaines en arrière. La semaine courante compte si elle atteint son
objectif ; si elle est incomplète, commencer le streak à la semaine close précédente. Arrêter au
premier objectif manqué.

- [ ] **Step 4: Vérifier le moteur**

Run: `npm run test:run -- src/lib/history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/history.ts src/lib/history.test.ts
git commit -m "feat(lot-07): calcule la régularité hebdomadaire"
```

### Task 2: Persistance de l’objectif hebdomadaire

**Files:**
- Modify: `src/data/repositories/settings.ts`
- Modify: `src/data/repositories/settings.test.ts`

**Interfaces:**
- Consumes: `WeeklyTrainingGoal` et `startOfLocalWeek` de Task 1.
- Produces:

```ts
export function getWeeklyTrainingGoalHistory(): Promise<WeeklyTrainingGoal[]>;
export function setWeeklyTrainingGoal(
  sessions: number,
  now?: number,
): Promise<WeeklyTrainingGoal[]>;
```

- [ ] **Step 1: Écrire les tests de validation et de versionnement**

```ts
it('enregistre le premier objectif comme base rétroactive', async () => {
  await setWeeklyTrainingGoal(4, new Date(2026, 6, 25).getTime());
  expect(await getWeeklyTrainingGoalHistory()).toEqual([
    { effectiveFromWeek: 0, sessions: 4 },
  ]);
});

it('remplace un changement fait dans la même semaine', async () => {
  await setWeeklyTrainingGoal(4, new Date(2026, 6, 25).getTime());
  await setWeeklyTrainingGoal(5, new Date(2026, 7, 4).getTime());
  await setWeeklyTrainingGoal(3, new Date(2026, 7, 8).getTime());
  expect(await getWeeklyTrainingGoalHistory()).toEqual([
    { effectiveFromWeek: 0, sessions: 4 },
    { effectiveFromWeek: new Date(2026, 7, 3).getTime(), sessions: 3 },
  ]);
});
```

Ajouter les refus de `0`, valeur négative, décimale, `NaN`, ainsi que la normalisation défensive
d’une valeur IndexedDB corrompue.

- [ ] **Step 2: Lancer le test et constater l’échec attendu**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: FAIL car les deux exports n’existent pas.

- [ ] **Step 3: Implémenter la clé et ses gardes**

```ts
const WEEKLY_TRAINING_GOAL_HISTORY_KEY = 'weeklyTrainingGoalHistory';

export async function setWeeklyTrainingGoal(
  sessions: number,
  now = Date.now(),
): Promise<WeeklyTrainingGoal[]> {
  if (!Number.isInteger(sessions) || sessions < 1) {
    throw new RangeError('Weekly training goal must be a positive integer');
  }

  const current = await getWeeklyTrainingGoalHistory();
  const effectiveFromWeek = current.length === 0 ? 0 : startOfLocalWeek(now);
  const next = current.filter((goal) => goal.effectiveFromWeek !== effectiveFromWeek);
  next.push({ effectiveFromWeek, sessions });
  next.sort((a, b) => a.effectiveFromWeek - b.effectiveFromWeek);
  await db.settings.put({
    key: WEEKLY_TRAINING_GOAL_HISTORY_KEY,
    value: next,
    updatedAt: Date.now(),
  });
  return next;
}
```

`getWeeklyTrainingGoalHistory` ne garde que les objets ayant un `effectiveFromWeek` fini,
positif ou nul, et un `sessions` entier positif ; il trie et déduplique par semaine.

- [ ] **Step 4: Vérifier le repository**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/settings.ts src/data/repositories/settings.test.ts
git commit -m "feat(lot-07): mémorise l'objectif hebdomadaire"
```

### Task 3: Repository de consultation

**Files:**
- Create: `src/data/repositories/history.ts`
- Test: `src/data/repositories/history.test.ts`

**Interfaces:**
- Consumes: tables `workouts`, `workoutExercises`, `workoutSets`, `exercises`.
- Produces:

```ts
export interface HistoryFilters {
  exerciseId?: string;
}

export interface HistoryWorkoutSummary {
  workoutId: string;
  name: string;
  startedAt: number;
  durationSeconds: number;
  exerciseCount: number;
  completedSetCount: number;
}

export interface HistoryPage {
  items: HistoryWorkoutSummary[];
  hasMore: boolean;
}

export function listCompletedWorkoutTimestamps(filters?: HistoryFilters): Promise<number[]>;
export function listHistoryPage(
  filters: HistoryFilters,
  offset: number,
  limit?: number,
): Promise<HistoryPage>;
export function listHistoryDay(
  filters: HistoryFilters,
  localDay: number,
): Promise<HistoryWorkoutSummary[]>;
export function listHistoryExerciseOptions(): Promise<Array<{ id: string; name: string }>>;
```

- [ ] **Step 1: Écrire les tests de lecture**

```ts
it('rend uniquement les séances terminées, récentes en premier', async () => {
  await seedWorkout({ exerciseId: 'bench', performedAt: day(1), sets: [[100, 5]] });
  await seedWorkout({ exerciseId: 'bench', performedAt: day(8), sets: [[102.5, 5]] });
  const page = await listHistoryPage({}, 0, 20);
  expect(page.items.map((item) => item.startedAt)).toEqual([day(8), day(1)]);
  expect(page.hasMore).toBe(false);
});
```

Ajouter : soft-delete ignoré, workout actif ignoré, compte des séries validées seulement,
pagination `20 + 1` sans perte, filtre par exercice et options limitées aux exercices présents
dans des séances terminées.

- [ ] **Step 2: Lancer le test et constater l’échec attendu**

Run: `npm run test:run -- src/data/repositories/history.test.ts`

Expected: FAIL avec le module `./history` absent.

- [ ] **Step 3: Implémenter des lectures groupées**

Lire les workouts terminés vivants, trier par `startedAt DESC` puis `id`, appliquer le filtre
exercice avant `slice(offset, offset + limit + 1)`. Charger ensuite les lignes et séries des seuls
workouts de la page avec `anyOf`, construire les compteurs en mémoire et retourner au plus
`limit` éléments avec `hasMore`.

- [ ] **Step 4: Vérifier les lectures**

Run: `npm run test:run -- src/data/repositories/history.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/history.ts src/data/repositories/history.test.ts
git commit -m "feat(lot-07): expose l'historique paginé"
```

### Task 4: Carte de régularité et journal

**Files:**
- Create: `src/features/history/HistorySummaryCard.tsx`
- Create: `src/features/history/WeeklyGoalSheet.tsx`
- Create: `src/features/history/HistoryJournal.tsx`
- Modify: `src/features/history/HistoryScreen.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `WeeklyRegularity`, `HistoryWorkoutSummary`, `setWeeklyTrainingGoal`.
- Produces: écran Journal utilisable, carte cliquable et feuille de réglage.

- [ ] **Step 1: Ajouter tout le vocabulaire français**

```ts
history: {
  title: 'Historique',
  journal: 'Journal',
  calendar: 'Calendrier',
  streak: 'Semaines',
  weeklyGoal: 'Objectif hebdo',
  defineGoal: 'Définir',
  goalPrompt: 'Choisis ton rythme pour suivre ta régularité.',
  goalSheetTitle: 'Séances par semaine',
  goalInput: 'Nombre de séances par semaine',
  goalSave: 'Enregistrer',
  showMore: 'Afficher plus',
  exerciseCount: '{count} exercices',
  setCount: '{count} séries',
}
```

Ajouter les variantes singulières et les états chargement/erreur sans chaîne en dur.

- [ ] **Step 2: Construire la feuille avec saisie directe sans plafond**

```tsx
<NumberInput
  value={draft}
  onChange={setDraft}
  min={1}
  max={Number.MAX_SAFE_INTEGER}
  step={1}
  integer
  aria-label={t('history.goalInput')}
/>
```

Le bouton `Enregistrer` est désactivé tant que `draft` n’est pas un entier positif. La feuille
appelle `setWeeklyTrainingGoal(draft)` puis se ferme.

- [ ] **Step 3: Construire la carte et son rail proportionnel**

Le bouton de l’objectif occupe une cible d’au moins 48 px. Quand l’objectif existe, le rail utilise
`transform: scaleX(Math.min(currentCompleted / currentGoal, 1))` avec origine à gauche. Quand il
n’existe pas, afficher `Définir`, le libellé et l’aide sans inventer la valeur `4`.

- [ ] **Step 4: Brancher le Journal**

`HistoryScreen` utilise `useLiveQuery` pour les timestamps, l’historique d’objectifs et la page.
Le bouton `Afficher plus` augmente la taille demandée par pas de 20, sans changer les données.
Pendant le jalon 07A, chaque séance est un article lisible ; le plan 07B le transformera en lien
vers le détail au moment où cette destination existera.

- [ ] **Step 5: Vérifier le slice**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:run -- src/lib/history.test.ts src/data/repositories/settings.test.ts src/data/repositories/history.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/history src/i18n/fr.ts
git commit -m "feat(lot-07): affiche le journal et la régularité"
```

### Task 5: Calendrier mensuel et filtre exercice

**Files:**
- Create: `src/features/history/HistoryCalendar.tsx`
- Create: `src/features/history/HistoryExerciseFilter.tsx`
- Modify: `src/features/history/HistoryScreen.tsx`
- Modify: `src/i18n/fr.ts`
- Test: `src/lib/history.test.ts`

**Interfaces:**
- Consumes: timestamps terminés, `listHistoryExerciseOptions`, `HistoryFilters`.
- Produces: calendrier lundi–dimanche, mois navigable et filtre partagé avec le journal.

- [ ] **Step 1: Étendre le moteur pur avec la grille mensuelle**

```ts
export interface CalendarDay {
  timestamp: number;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  hasWorkout: boolean;
}

export function buildMonthGrid(
  visibleMonth: number,
  completedWorkoutTimestamps: readonly number[],
): CalendarDay[];
```

Tester un mois commençant un dimanche, février bissextile, passage d’année et marquage de plusieurs
séances le même jour.

- [ ] **Step 2: Vérifier l’échec puis implémenter**

Run: `npm run test:run -- src/lib/history.test.ts`

Expected avant implémentation: FAIL car `buildMonthGrid` manque.

Expected après implémentation: PASS avec 42 jours, du lundi au dimanche.

- [ ] **Step 3: Construire le calendrier**

Les boutons précédent/suivant, les cellules de jour et le sélecteur Journal/Calendrier font tous
au moins 48 px. Un jour d’entraînement porte un point accent ; un jour sélectionné affiche sous la
grille le résultat complet de `listHistoryDay`, via les mêmes résumés que le Journal.

- [ ] **Step 4: Brancher le filtre partagé**

La feuille liste seulement les exercices réellement présents dans l’historique et propose
`Tous les exercices`. La valeur `exerciseId` alimente la page Journal, les timestamps du calendrier
et la liste du jour sélectionné.

- [ ] **Step 5: Vérifier le jalon 07A**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:run`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/history.ts src/lib/history.test.ts src/features/history src/i18n/fr.ts
git commit -m "feat(lot-07): ajoute le calendrier historique"
```

---

## Plans suivants du Lot 07

Une fois ce jalon vérifié, deux plans autonomes couvriront les autres frontières déjà validées
dans la spec :

1. **Lot 07B — détail, édition et suppression** : routes archivées, brouillon transactionnel,
   correction des séries et confirmation destructive.
2. **Lot 07C — import Hevy CSV** : parseur RFC 4180, aperçu, correspondance des exercices,
   déduplication et transaction atomique.

Ces jalons ne modifient pas les interfaces publiques définies ici ; ils consomment les résumés,
la navigation et la logique de calendrier de 07A.
