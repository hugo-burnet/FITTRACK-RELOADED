# Analytics Period Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centraliser les deux lectures et la cohérence des fenêtres utilisées par les trois analyses globales sans modifier leurs résultats métier.

**Architecture:** Un hook profond dans `features/analytics` calcule la fenêtre, lance les repositories existants et retourne un snapshot atomique identifié par sa fenêtre. Les écrans continuent de posséder leurs sélecteurs et leurs calculs purs, mais ne connaissent plus la stratégie de chargement.

**Tech Stack:** React 19, TypeScript strict, Dexie `useLiveQuery`, Vitest, Testing Library, `fake-indexeddb`.

## Global Constraints

- Aucune limite artificielle sur l’historique.
- Fonctionnement local-first, sans réseau.
- Aucun changement de schéma Dexie ni migration.
- Code et noms en anglais ; aucun nouveau texte UI.
- Accès aux données uniquement via les repositories existants.
- Les résultats analytiques, tris, périodes et règles historiques restent identiques.

---

### Task 1: Verrouiller l’interface du hook et la cohérence des snapshots

**Files:**
- Create: `src/features/analytics/useHistoricalPeriod.test.tsx`
- Create: `src/features/analytics/useHistoricalPeriod.ts`

**Interfaces:**
- Consumes: `periodBounds(PeriodKey, number)`, `listHistoricalWorkouts(HistoricalScope)`, `listCompletedWorkoutTimestamps()`.
- Produces: `useHistoricalPeriod(period: PeriodKey, openedAt: number): HistoricalPeriodResult`.

- [ ] **Step 1: Écrire le test avant l’implémentation**

Créer trois tests avec `renderHook` et la base de test réelle :

```tsx
it('charge la fenêtre et distingue un historique antérieur', async () => {
  const { result } = renderHook(() => useHistoricalPeriod('4w', openedAt));
  expect(result.current).toEqual({ data: undefined, stale: true });
  await waitFor(() => expect(result.current.stale).toBe(false));
  expect(result.current.data?.workouts.map(({ workoutId }) => workoutId)).toEqual([
    recent.id,
  ]);
  expect(result.current.data?.hasEarlierHistory).toBe(true);
});

it('charge tout l’historique sans inventer de fenêtre antérieure', async () => {
  const { result } = renderHook(() => useHistoricalPeriod('all', openedAt));
  await waitFor(() => expect(result.current.stale).toBe(false));
  expect(result.current.data?.bounds.from).toBeUndefined();
  expect(result.current.data?.hasEarlierHistory).toBe(false);
});

it('garde le snapshot précédent cohérent pendant un changement de période', async () => {
  const { result, rerender } = renderHook(
    ({ period }) => useHistoricalPeriod(period, openedAt),
    { initialProps: { period: '4w' as PeriodKey } },
  );
  await waitFor(() => expect(result.current.stale).toBe(false));
  const previous = result.current.data;
  rerender({ period: 'all' });
  expect(result.current).toEqual({ data: previous, stale: true });
  await waitFor(() => expect(result.current.stale).toBe(false));
  expect(result.current.data?.bounds.from).toBeUndefined();
});
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```powershell
npm.cmd run test:run -- src/features/analytics/useHistoricalPeriod.test.tsx
```

Expected: FAIL parce que `useHistoricalPeriod` n’existe pas encore.

- [ ] **Step 3: Implémenter le hook minimal**

Créer un résultat interne qui porte `requestKey`, `bounds`, `workouts` et
`hasEarlierHistory`. Les deux repositories sont lus dans un même
`Promise.all`. Retourner le dernier snapshot disponible et calculer :

```ts
stale: loaded?.requestKey !== requestKey
```

La dépendance de `useLiveQuery` est la clé stable construite avec `from` et
`to`.

- [ ] **Step 4: Vérifier le passage au vert**

Run:

```powershell
npm.cmd run test:run -- src/features/analytics/useHistoricalPeriod.test.tsx
```

Expected: 3 tests PASS.

### Task 2: Migrer les trois analyses globales

**Files:**
- Modify: `src/features/analytics/WeeklySessionsScreen.tsx`
- Modify: `src/features/analytics/MuscleBalanceScreen.tsx`
- Modify: `src/features/analytics/WeeklyVolumeScreen.tsx`

**Interfaces:**
- Consumes: `useHistoricalPeriod(period, openedAt)`.
- Produces: les mêmes écrans et résultats visibles, sans imports directs des deux repositories communs.

- [ ] **Step 1: Migrer `WeeklySessionsScreen`**

Remplacer les deux `useLiveQuery` historiques et `periodBounds` par le hook.
Conserver `useLiveQuery(getWeeklyTrainingGoalHistory, [])`. Construire les
seaux uniquement depuis `data.workouts`, `data.bounds` et
`data.hasEarlierHistory`. L’état `stale` combine celui du hook et le chargement
des objectifs.

- [ ] **Step 2: Migrer `MuscleBalanceScreen`**

Supprimer les imports des repositories et de `useLiveQuery`. Utiliser le
snapshot commun pour les séances, la fenêtre, l’antériorité et l’état `stale`.

- [ ] **Step 3: Migrer `WeeklyVolumeScreen`**

Supprimer `ResolvedVolumeQuery`, `resolvedQuery`, les deux lectures locales et
leur synchronisation pendant le rendu. Utiliser directement le snapshot commun.

- [ ] **Step 4: Vérifier les tests ciblés**

Run:

```powershell
npm.cmd run test:run -- src/features/analytics/useHistoricalPeriod.test.tsx src/features/analytics/WeeklyVolumeScreen.test.tsx src/lib/analytics/weeks.test.ts src/lib/analytics/muscles.test.ts src/lib/analytics/volume.test.ts
```

Expected: tous les tests PASS.

### Task 3: Vérification et mémoire du projet

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: le diff complet et les sorties des commandes.
- Produces: un état de reprise fidèle et un commit atomique de refactorisation.

- [ ] **Step 1: Vérifier les imports et la duplication**

Run:

```powershell
rg -n "listHistoricalWorkouts|listCompletedWorkoutTimestamps|periodBounds" src/features/analytics
```

Expected: les deux lectures communes n’apparaissent plus dans les trois écrans
globaux ; `ExerciseAnalyticsScreen` conserve sa portée spécialisée.

- [ ] **Step 2: Lancer la vérification complète**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: quatre commandes avec code de sortie 0.

- [ ] **Step 3: Mettre à jour `PROGRESS.md`**

Ajouter la date, l’interface du hook, les trois consommateurs migrés, les
preuves exécutées et le checkpoint téléphone.

- [ ] **Step 4: Relire et commiter**

Run:

```powershell
git diff --check
git diff --stat
git status --short
git add docs/superpowers/specs/2026-07-29-analytics-period-loading-design.md docs/superpowers/plans/2026-07-29-analytics-period-loading.md src/features/analytics/useHistoricalPeriod.ts src/features/analytics/useHistoricalPeriod.test.tsx src/features/analytics/WeeklySessionsScreen.tsx src/features/analytics/MuscleBalanceScreen.tsx src/features/analytics/WeeklyVolumeScreen.tsx PROGRESS.md
git commit -m "refactor: centralise le chargement des périodes d’analyse"
```

Expected: un commit atomique, sans fichier étranger.
