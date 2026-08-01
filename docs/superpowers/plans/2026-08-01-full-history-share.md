# Full History Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter dans Réglages une action qui partage toutes les séances terminées dans le format Markdown FitTrack existant.

**Architecture:** `SettingsScreen` prépare réactivement le document avec la portée canonique `all-history`, puis appelle l’adaptateur `shareText` directement depuis le geste utilisateur. La lecture Dexie, la projection et la sérialisation restent dans leurs modules existants.

**Tech Stack:** React 19, TypeScript strict, Dexie `useLiveQuery`, Testing Library, Vitest.

## Global Constraints

- Toute l’interface utilisateur est en français et vit dans `src/i18n/fr.ts`.
- Aucun composant n’importe `db` directement.
- L’export reste 100 % local et hors ligne.
- Les cibles tactiles conservent une hauteur minimale de 48 px.
- TDD : observer l’échec attendu avant d’écrire le code de production.

---

### Task 1: Parcours de partage global

**Files:**
- Create: `src/features/settings/SettingsScreen.test.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `listHistoricalWorkouts({ kind: 'all-history' })`, `projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, now)`, `serializeMarkdown(data)`, `shareText({ title, text })`.
- Produces: une ligne Réglages nommée par `settings.exportHistoryLink`, désactivée si le Markdown est vide ou encore indéfini, et les messages `settings.exportHistoryCopied` / `settings.exportHistoryFailed`.

- [ ] **Step 1: Write the failing interaction tests**

Créer `SettingsScreen.test.tsx` avec un helper qui insère deux séances terminées et leurs graphes via `newEntity`, puis vérifier :

```tsx
it('shares every completed workout in one Markdown document', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  installShare({ share, clipboard: { writeText: vi.fn() } });
  await seedCompletedWorkout('Upper A', Date.UTC(2026, 6, 27, 16));
  await seedCompletedWorkout('Lower B', Date.UTC(2026, 6, 29, 16));
  renderSettings();

  const action = await screen.findByRole('button', {
    name: /Exporter tout l’historique/,
  });
  await waitFor(() => expect(action).toBeEnabled());
  await userEvent.click(action);

  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const payload = share.mock.calls[0]![0] as { title: string; text: string };
  expect(payload.title).toBe('FitTrack — historique complet');
  expect(payload.text).toContain('Périmètre : tout l’historique');
  expect(payload.text).toContain('Upper A');
  expect(payload.text).toContain('Lower B');
});

it('disables the action when history is empty', async () => {
  renderSettings();
  expect(await screen.findByRole('button', {
    name: /Exporter tout l’historique/,
  })).toBeDisabled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd run test:run -- src/features/settings/SettingsScreen.test.tsx`  
Expected: FAIL because the export row and translations do not exist.

- [ ] **Step 3: Add the minimal production behavior**

Dans `SettingsScreen`, ajouter les imports d’export, `useLiveQuery` et l’adaptateur de partage, puis préparer le texte :

```tsx
const historyMarkdown = useLiveQuery(async () => {
  const scope = { kind: 'all-history' } as const;
  const sources = await listHistoricalWorkouts(scope);
  if (sources.length === 0) return '';
  return serializeMarkdown(
    projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.now()),
  );
}, []);
```

Ajouter une `ListRow` avant les outils de réparation, avec
`disabled={historyMarkdown === undefined || historyMarkdown === ''}` et un
`onClick` qui appelle `shareText` sans `await` préalable. Mapper `copied` et
`failed` vers un état de message accessible `role="status"`, sans message pour
`shared` ou `cancelled`.

Ajouter dans `settings` :

```ts
exportHistoryLink: 'Exporter tout l’historique',
exportHistoryHint: 'Partage toutes tes séances dans un document texte lisible.',
exportHistoryTitle: 'FitTrack — historique complet',
exportHistoryCopied: 'Historique copié dans le presse-papiers.',
exportHistoryFailed: 'L’historique n’a pas pu être partagé ni copié.',
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd run test:run -- src/features/settings/SettingsScreen.test.tsx src/features/history/HistoryDetailScreen.test.tsx src/platform/share.test.ts`  
Expected: all selected tests PASS.

- [ ] **Step 5: Commit the feature**

```bash
git add -- src/features/settings/SettingsScreen.tsx src/features/settings/SettingsScreen.test.tsx src/i18n/fr.ts
git commit -m "feat(export): partage tout l historique"
```

### Task 2: Documentation et vérification finale

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: résultat vérifié de Task 1.
- Produces: état de session et checkpoint téléphone à jour.

- [ ] **Step 1: Update project progress**

Ajouter en tête de `PROGRESS.md` une entrée datée du 2026-08-01 décrivant la
ligne Réglages, la portée `all-history`, le partage natif/repli presse-papiers,
les tests ajoutés et ce checkpoint :

> Réglages → Données → Exporter tout l’historique ; vérifier que la feuille de
> partage contient les premières et dernières séances et annonce bien
> « Périmètre : tout l’historique ».

- [ ] **Step 2: Run the complete verification ritual**

Run, séparément :

```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
```

Expected: exit code 0 for all four commands and zero failing tests.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`.  
Expected: no whitespace errors; only `PROGRESS.md` remains uncommitted.

- [ ] **Step 4: Commit progress**

```bash
git add -- PROGRESS.md
git commit -m "docs: consigne l export complet de l historique"
```
