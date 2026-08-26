# Routines, Wiki and Live Coach UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier la bibliothèque de routines, transformer les articles du Wiki en lecture éditoriale et rendre toute écriture proposée par le coach explicite pendant une séance.

**Architecture:** Les changements restent dans les composants de présentation existants et préservent les repositories, les stores et les contrats du corpus. `Screen` expose un opt-out d’aide centralisé par un cadre Knowledge, `RoutineCollection` demeure la projection unique des dossiers, et `CoachCard` porte localement l’état éphémère de son action asynchrone.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Dexie/useLiveQuery, Zustand, Vitest, Testing Library.

## Global Constraints

- Interface en français et chaînes nouvelles uniquement dans `src/i18n/fr.ts`.
- Cibles tactiles d’au moins 48 × 48 px ; aucun contrôle `fixed` ou `sticky` ajouté.
- Réutiliser `OrderLockButton`, `CollapseAllIcon`, `ExpandAllIcon`, `ChevronDownIcon` et `Button`.
- Aucune nouvelle dépendance, couleur, police, ombre décorative ou animation de page.
- Aucun changement de repository, de seuil du coach, de `claimId`, de `rowId` ou de texte canonique du corpus.
- Le Wiki ne rend plus l’aide contextuelle ; le tutoriel reste inchangé ailleurs.
- L’objectif coach n’écrit qu’après activation du bouton `Appliquer … kg`.
- Le nettoyage de `wikiDocuments` et de l’export mort `wikiSections` reste dans cette livraison.

---

### Task 1: Finaliser le nettoyage mort de `wikiIndex`

**Files:**
- Modify: `src/features/knowledge/wikiIndex.ts`
- Test: `src/features/knowledge/wikiIndex.test.ts`

**Interfaces:**
- Consumes: `evidence-index.json` et ses claims/sections.
- Produces: `findWikiSection(sectionId): WikiSection | undefined` et `findSectionIdForClaim(claimId): string | undefined` sans tableau documentaire public.

- [ ] **Step 1: Vérifier la couverture publique après suppression**

Le test doit importer uniquement :

```ts
import { findSectionIdForClaim, findWikiSection, type WikiSection } from './wikiIndex';
```

Il collecte les sections atteignables via les deux fonctions publiques et ne teste plus `wikiDocuments` ni `wikiSections`.

- [ ] **Step 2: Exécuter le test ciblé**

Run:

```bash
npm run test:run -- src/features/knowledge/wikiIndex.test.ts
```

Expected: 11 tests passent ; aucune référence à `wikiDocuments` ou à l’export `wikiSections`.

- [ ] **Step 3: Vérifier la surface du module**

Run:

```bash
rg -n "WikiDocument|wikiDocuments|export const wikiSections" src/features/knowledge
```

Expected: aucune sortie.

- [ ] **Step 4: Committer le nettoyage**

```bash
git add -- src/features/knowledge/wikiIndex.ts src/features/knowledge/wikiIndex.test.ts
git commit -m "refactor: supprimer les projections wiki mortes"
```

---

### Task 2: Aligner les commandes de Routines sur la séance en cours

**Files:**
- Modify: `src/features/routines/RoutineCollection.tsx`
- Modify: `src/features/routines/RoutineCollection.test.tsx`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`

**Interfaces:**
- Produces: `collapsibleRoutineFolderIds(summaries, folders): string[]`.
- Consumes: `useRoutineLibraryView`, `OrderLockButton`, `CollapseAllIcon`, `ExpandAllIcon`, `ChevronDownIcon`.
- Preserves: `RoutineCollectionIntent` et le placement complet utilisé par `ReorderableList`.

- [ ] **Step 1: Écrire le test rouge de la racine vide**

Remplacer le test qui exige actuellement la racine vide par :

```tsx
it('omet la racine vide même lorsqu’un dossier existe', () => {
  const push = folder('folder-push', 'Push');
  render(<Collection summaries={[]} folders={[push]} onIntent={vi.fn()} />);

  expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Push' })).toBeVisible();
});
```

Ajouter un test du contrat de repli :

```tsx
expect(collapsibleRoutineFolderIds([], [push])).toEqual([push.id]);
expect(collapsibleRoutineFolderIds([summary(rootRoutine)], [push])).toEqual(['root', push.id]);
```

- [ ] **Step 2: Vérifier l’échec attendu**

Run:

```bash
npm run test:run -- src/features/routines/RoutineCollection.test.tsx
```

Expected: FAIL parce que « Sans dossier » est encore rendu et que `collapsibleRoutineFolderIds` n’existe pas.

- [ ] **Step 3: Implémenter la projection unique des dossiers repliables**

Dans `RoutineCollection.tsx`, ajouter et réutiliser :

```ts
export function collapsibleRoutineFolderIds(
  summaries: readonly RoutineSummary[],
  folders: readonly RoutineFolder[],
): string[] {
  const hasRootRoutines = summaries.some((summary) => summary.routine.folderId === '');
  return [...(hasRootRoutines && folders.length > 0 ? ['root'] : []), ...folders.map(({ id }) => id)];
}
```

`projectEntries` ne pousse l’en-tête `root` que lorsque `hasRootRoutines` est vrai et qu’au moins un dossier existe.

- [ ] **Step 4: Ajouter le test rouge de la barre d’outils**

Dans `RoutineFlow.integration.test.tsx`, créer un dossier PPL, déplacer une routine dedans, rendre `/routines`, puis vérifier :

```tsx
expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Déverrouiller l’ordre des routines' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Tout replier' })).toBeVisible();
expect(screen.getByRole('button', { name: 'Tout replier' })).not.toHaveTextContent('Tout replier');

await user.click(screen.getByRole('button', { name: 'Tout replier' }));
expect(screen.getByRole('button', { name: /PPL/u })).toHaveAttribute('aria-expanded', 'false');
expect(screen.getByRole('button', { name: 'Tout déplier' })).toBeVisible();
```

- [ ] **Step 5: Vérifier l’échec attendu de l’intégration**

Run:

```bash
npm run test:run -- src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: FAIL parce que « Tout replier » est encore un bouton texte et que la racine vide participe encore au calcul de `collapsibleIds`.

- [ ] **Step 6: Implémenter la barre compacte et le chevron de dossier**

Dans `RoutinesScreen.tsx` :

```tsx
const collapsibleIds = loaded ? collapsibleRoutineFolderIds(summaries, folders) : [];

<div className="flex min-h-12 items-center border-y border-[var(--border)] pl-1">
  <p className="label-xs min-w-0 flex-1 font-semibold text-[var(--text-2)]">
    <span className="record-figure mr-1.5 text-base text-[var(--text-1)]">
      {summaries.length.toLocaleString('fr-FR')}
    </span>
    {t('routines.countUnit')}
  </p>
  <OrderLockButton
    unlocked={reorderUnlocked}
    onToggle={() => setReorderUnlocked(!reorderUnlocked)}
    unlockLabel={t('common.unlockRoutineOrder')}
    lockLabel={t('common.lockRoutineOrder')}
  />
  <button
    type="button"
    aria-label={t(allCollapsed ? 'routines.expandAll' : 'routines.collapseAll')}
    disabled={reorderUnlocked || collapsibleIds.length === 0}
    onClick={() => (allCollapsed ? expandAll() : collapseAll(collapsibleIds))}
    className="flex size-12 shrink-0 items-center justify-center text-[var(--text-2)]
      transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]
      disabled:opacity-40"
  >
    {allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
  </button>
</div>
```

Le compteur quitte `Screen.action`, qui ne garde que `HeaderAction` avec `PlusIcon`. Dans `RoutineCollection.tsx`, placer `ChevronDownIcon` avant le nom et lui appliquer `-rotate-90` lorsque `collapsed` vaut `true`.

- [ ] **Step 7: Rejouer les tests Routines**

```bash
npm run test:run -- src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: PASS ; le réordonnancement clavier conserve toutes les routines.

- [ ] **Step 8: Committer Routines**

```bash
git add -- src/features/routines/RoutineCollection.tsx src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutinesScreen.tsx src/features/routines/RoutineFlow.integration.test.tsx
git commit -m "fix: clarifier les commandes de la bibliothèque"
```

---

### Task 3: Retirer l’aide contextuelle de toutes les pages Knowledge

**Files:**
- Modify: `src/app/Screen.tsx`
- Create: `src/features/knowledge/KnowledgeScreenFrame.tsx`
- Modify: `src/features/knowledge/KnowledgeScreen.tsx`
- Modify: `src/features/knowledge/LearnProgrammingScreen.tsx`
- Modify: `src/features/knowledge/WikiArticleScreen.tsx`
- Modify: `src/features/knowledge/WikiProgrammingScreen.tsx`
- Modify: `src/features/knowledge/WikiQuestionsScreen.tsx`
- Modify: `src/features/knowledge/WikiSectionScreen.tsx`
- Modify: `src/features/knowledge/KnowledgeScreen.test.tsx`

**Interfaces:**
- Produces: `ScreenProps.showTutorialHelp?: boolean`, vrai par défaut.
- Produces: `KnowledgeScreenFrame(props)` qui force `showTutorialHelp={false}`.
- Preserves: l’aide sur toutes les pages hors `src/features/knowledge/`.

- [ ] **Step 1: Écrire le test rouge de l’aide absente**

Entourer `KnowledgeScreen` d’un `TutorialContext.Provider` non nul et ajouter :

```tsx
expect(screen.queryByRole('button', { name: 'Aide sur cette page' })).not.toBeInTheDocument();
```

- [ ] **Step 2: Vérifier l’échec attendu**

```bash
npm run test:run -- src/features/knowledge/KnowledgeScreen.test.tsx
```

Expected: FAIL parce que `Screen` rend encore le bouton d’aide dès que le provider existe.

- [ ] **Step 3: Ajouter le contrat explicite à `Screen`**

Exporter les props et calculer une seule condition :

```tsx
export type ScreenProps = {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  showTutorialHelp?: boolean;
  children: ReactNode;
};

export function Screen({
  title,
  onBack,
  action,
  sub,
  footer,
  showTutorialHelp = true,
  children,
}: ScreenProps) {
  const tutorial = useTutorialControls();
  const hasTutorialHelp = showTutorialHelp && tutorial !== null;
  // le conteneur d’action et HeaderAction utilisent hasTutorialHelp
}
```

- [ ] **Step 4: Centraliser l’opt-out Knowledge**

Créer `KnowledgeScreenFrame.tsx` :

```tsx
import { Screen, type ScreenProps } from '@/app/Screen';

type Props = Omit<ScreenProps, 'showTutorialHelp'>;

export function KnowledgeScreenFrame(props: Props) {
  return <Screen {...props} showTutorialHelp={false} />;
}
```

Remplacer `Screen` par `KnowledgeScreenFrame` dans les six écrans Knowledge. Dans `WikiArticleScreen`, aligner aussi le résumé :

```tsx
sub={<p className="px-4 text-sm leading-6 text-[var(--text-2)]">{article.summary}</p>}
```

- [ ] **Step 5: Rejouer les tests Knowledge ciblés**

```bash
npm run test:run -- src/features/knowledge/KnowledgeScreen.test.tsx src/features/knowledge/WikiProgrammingScreen.test.tsx src/features/knowledge/LearnProgrammingScreen.test.tsx
```

Expected: PASS et aucun bouton « Aide sur cette page » dans Knowledge lorsque le provider existe.

- [ ] **Step 6: Committer le contrat d’écran**

```bash
git add -- src/app/Screen.tsx src/features/knowledge/KnowledgeScreenFrame.tsx src/features/knowledge/KnowledgeScreen.tsx src/features/knowledge/LearnProgrammingScreen.tsx src/features/knowledge/WikiArticleScreen.tsx src/features/knowledge/WikiProgrammingScreen.tsx src/features/knowledge/WikiQuestionsScreen.tsx src/features/knowledge/WikiSectionScreen.tsx src/features/knowledge/KnowledgeScreen.test.tsx
git commit -m "fix: retirer l’aide contextuelle du wiki"
```

---

### Task 4: Transformer `ArticleBody` en lecture éditoriale traçable

**Files:**
- Modify: `src/features/knowledge/ArticleBody.tsx`
- Create: `src/features/knowledge/ArticleBody.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: une provenance native `<details>` fermée par défaut et intitulée `Sources`.
- Preserves: tous les `claimIds`, `rowIds`, champs de fiches et blocs éditoriaux.

- [ ] **Step 1: Écrire les tests rouges de provenance et de regroupement**

Construire un `WikiArticle` minimal avec deux blocs factuels consécutifs, un bloc éditorial, puis une fiche `rowId`. Vérifier :

```tsx
const sources = screen.getAllByText('Sources');
expect(sources).toHaveLength(3);
for (const label of sources) {
  expect(label.closest('details')).not.toHaveAttribute('open');
}
expect(screen.getByText('claim.test')).toBeInTheDocument();
expect(screen.getByText('row.test')).toBeInTheDocument();
expect(container.querySelectorAll('[data-article-evidence-group]')).toHaveLength(2);
```

- [ ] **Step 2: Vérifier l’échec attendu**

```bash
npm run test:run -- src/features/knowledge/ArticleBody.test.tsx
```

Expected: FAIL parce que la provenance est un `div` toujours déplié et que chaque bloc est une carte indépendante.

- [ ] **Step 3: Rendre la note de revue compacte**

`UnreviewedNotice` devient une ligne sans carte :

```tsx
<section className="border-y border-[var(--border)] px-1 py-3">
  <p className="text-sm leading-6 text-[var(--text-2)]">
    <span className="label-xs mr-2 font-semibold">{t('knowledge.article.unreviewedLabel')}</span>
    {t('knowledge.article.unreviewedBody')}
  </p>
</section>
```

Raccourcir `unreviewedBody` sans retirer l’avertissement scientifique :

```ts
unreviewedBody:
  'Matière non vérifiée ligne par ligne ; le remaniement éditorial ne vaut pas validation scientifique.',
sourcesLabel: 'Sources',
```

- [ ] **Step 4: Replier la provenance avec la sémantique native**

Remplacer `Provenance` par :

```tsx
function Provenance({ sources }: { sources: readonly string[] }) {
  return (
    <details className="mt-4 border-t border-[var(--border)] pt-1">
      <summary className="label-xs flex min-h-12 cursor-pointer items-center font-semibold text-[var(--text-2)]">
        {t('knowledge.article.sourcesLabel')}
      </summary>
      <p className="record-figure break-words pb-3 text-xs leading-5 text-[var(--text-2)]">
        {sources.join(' · ')}
      </p>
    </details>
  );
}
```

- [ ] **Step 5: Regrouper les unités factuelles consécutives**

Supprimer `SourcedCard`. Ajouter `groupRuns(groups)` qui crée une nouvelle surface seulement après un bloc éditorial :

```tsx
type Run =
  | { kind: 'editorial'; key: string; block: WikiArticleBlock }
  | { kind: 'sourced'; key: string; groups: Group[] };

function groupRuns(groups: readonly Group[]): Run[] {
  const runs: Run[] = [];
  for (const group of groups) {
    if (group.kind === 'block' && group.block.editorial) {
      runs.push({ kind: 'editorial', key: group.key, block: group.block });
      continue;
    }

    const last = runs.at(-1);
    if (last?.kind === 'sourced') last.groups.push(group);
    else runs.push({ kind: 'sourced', key: `sourced:${group.key}`, groups: [group] });
  }
  return runs;
}
```

Dans `ArticleBody`, rendre les runs avec les composants existants :

```tsx
{groupRuns(groupBlocks(section.blocks)).map((run) =>
  run.kind === 'editorial' ? (
    <ProseBlock key={run.key} block={run.block} />
  ) : (
    <div
      key={run.key}
      data-article-evidence-group
      className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl bg-[var(--surface-1)]"
    >
      {run.groups.map((group) =>
        group.kind === 'row' ? (
          <RowCard key={group.key} blocks={group.blocks} />
        ) : (
          <ProseBlock key={group.key} block={group.block} />
        ),
      )}
    </div>
  ),
)}
```

`RowCard` et la branche factuelle de `ProseBlock` deviennent des `<article className="p-5">`; aucun rail accent n’est rendu. La branche éditoriale reste directement sur le fond de page.

- [ ] **Step 6: Rejouer le test ArticleBody et le catalogue**

```bash
npm run test:run -- src/features/knowledge/ArticleBody.test.tsx src/features/knowledge/articleCatalogue.test.ts
```

Expected: PASS ; les identifiants existent dans le DOM même lorsque `<details>` est fermé.

- [ ] **Step 7: Committer la lecture Wiki**

```bash
git add -- src/features/knowledge/ArticleBody.tsx src/features/knowledge/ArticleBody.test.tsx src/i18n/fr.ts
git commit -m "fix: alléger la lecture des articles wiki"
```

---

### Task 5: Implémenter la variante A du coach en séance

**Files:**
- Modify: `src/features/workout/CoachCard.tsx`
- Create: `src/features/workout/CoachCard.test.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Changes: `CoachCard.onApply?: () => void | Promise<void>`.
- Changes: `WorkoutExerciseCard.onApplyCoach?: () => void | Promise<void>`.
- Produces: `coach.applyButton` pour le texte visible et `coach.hideObservation` pour une observation.
- Preserves: `applyCoachObjective`, `markRecommendationFollowed`, `dismissRecommendation` et leurs transitions repository.

- [ ] **Step 1: Écrire le test rouge « la prose n’applique rien »**

Dans le test d’intégration existant, avant le clic d’application :

```tsx
await user.click(screen.getByText('47,5 → 50 kg car 3 × 12 a atteint le haut de la fourchette.'));
expect(await firstSet(workoutId)).toMatchObject({ targetWeight: undefined, isCompleted: 0 });

await user.click(screen.getByRole('button', { name: 'Appliquer 50 kg aux séries restantes' }));
```

- [ ] **Step 2: Écrire les tests rouges du composant**

Dans `CoachCard.test.tsx`, vérifier :

```tsx
expect(screen.getByRole('button', { name: t('coach.applyAction', { weight: '50' }) }))
  .toHaveTextContent('Appliquer 50 kg');
expect(screen.getByRole('button', { name: 'Ignorer' })).toBeVisible();
```

Avec un `onApply` différé, cliquer une fois et vérifier que le bouton reste désactivé jusqu’à résolution. Avec un signal `long_rest` sans `nextLoadKg`, vérifier l’absence de bouton `/Appliquer/u` et la présence de `Masquer`.

- [ ] **Step 3: Vérifier les échecs attendus**

```bash
npm run test:run -- src/features/workout/CoachCard.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx
```

Expected: FAIL parce que la prose est encore incluse dans le bouton, aucun texte visible `Appliquer 50 kg` n’existe et l’état asynchrone n’est pas suivi.

- [ ] **Step 4: Ajouter les chaînes d’action**

Dans `src/i18n/fr.ts` :

```ts
applyButton: 'Appliquer {weight} kg',
hideObservation: 'Masquer',
```

Conserver `applyAction` comme libellé accessible complet.

- [ ] **Step 5: Construire la décision explicite dans `CoachCard`**

Importer `useState` et `Button`, supprimer `ChevronRightIcon`, puis calculer le rôle et l’objectif affiché :

```tsx
const hasLoad = signal.nextLoadKg !== undefined;
const applicable = hasLoad && onApply !== undefined;
const weight = hasLoad ? formatNumber(signal.nextLoadKg!) : undefined;
const role = variant === 'strip' ? t('coach.title') : tone === 'objective' ? t('coach.objective') : t('coach.title');
```

Porter l’état asynchrone dans `CoachCard` :

```tsx
const [applying, setApplying] = useState(false);

const apply = async () => {
  if (onApply === undefined || applying) return;
  setApplying(true);
  try {
    await onApply();
  } catch {
    // La recommandation pending reste visible et réessayable.
  } finally {
    setApplying(false);
  }
};
```

Le corps n’est plus pressable. Le label et la charge utilisent une ligne de lecture dédiée :

```tsx
<div className="flex items-start justify-between gap-4">
  <div className="min-w-0">
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <p className="label-xs font-semibold text-[var(--accent-ink)]">{role}</p>
      {dateLabel !== undefined && <p className="text-sm text-[var(--text-2)]">{dateLabel}</p>}
      {statusLabel !== undefined && <p className="label-xs font-semibold text-[var(--text-2)]">{statusLabel}</p>}
    </div>
    {exerciseName !== undefined && exerciseName !== '' && (
      <p className="mt-1.5 truncate text-base font-medium text-[var(--text-1)]">{exerciseName}</p>
    )}
  </div>
  {weight !== undefined && (
    <p className="record-figure shrink-0 text-[1.75rem] leading-none font-semibold text-[var(--text-1)]">
      {weight}<span className="ml-1 text-sm text-[var(--text-2)]">{t('units.kg')}</span>
    </p>
  )}
</div>
<p className="mt-2 text-sm leading-snug text-pretty text-[var(--text-1)]">{reason}</p>
```

Pour une charge applicable, rendre sous la raison :

```tsx
<div className="mt-3 flex flex-col gap-2 min-[23rem]:flex-row">
  <Button
    variant="primary"
    fullWidth
    disabled={applying}
    aria-label={t('coach.applyAction', { weight })}
    onClick={() => void apply()}
  >
    {t('coach.applyButton', { weight })}
  </Button>
  <Button variant="ghost" disabled={applying} onClick={onDismiss}>
    {t('coach.dismiss')}
  </Button>
</div>
```

Pour une observation, rendre uniquement le bouton fantôme `Masquer`. Le label et la charge partagent la ligne supérieure ; la raison reste une ligne séparée. `variant="strip"` continue d’utiliser `--surface-2` sans carte imbriquée.

- [ ] **Step 6: Propager la promesse d’application**

Dans `WorkoutExerciseCard`, accepter `onApplyCoach?: () => void | Promise<void>`. Dans `WorkoutScreen`, retourner la chaîne complète :

```tsx
onApplyCoach={async () => {
  const objective = coachByExercise.get(line.row.exerciseId)!;
  await applyCoachObjective(line.row.id, objective.nextLoadKg!);
  await markRecommendationFollowed(objective.id, {
    workoutId: workout.id,
    loadKg: objective.nextLoadKg,
  });
}}
```

- [ ] **Step 7: Rejouer les tests coach**

```bash
npm run test:run -- src/features/workout/CoachCard.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/WorkoutFinishScreen.test.tsx src/features/workout/coachCopy.test.ts
```

Expected: PASS ; la page de fin conserve ses lectures non interactives.

- [ ] **Step 8: Committer le coach explicite**

```bash
git add -- src/features/workout/CoachCard.tsx src/features/workout/CoachCard.test.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/i18n/fr.ts
git commit -m "fix: expliciter la décision du coach en séance"
```

---

### Task 6: Vérification mobile, documentation et livraison

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: build de production, navigateur local à 375 × 812 et 320 px.
- Produces: checkpoint manuel reproductible pour l’APK.

- [ ] **Step 1: Lancer les vérifications ciblées réunies**

```bash
npm run test:run -- src/features/knowledge/wikiIndex.test.ts src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutineFlow.integration.test.tsx src/features/knowledge/KnowledgeScreen.test.tsx src/features/knowledge/ArticleBody.test.tsx src/features/workout/CoachCard.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx
```

Expected: PASS sans warning React ni rejet de promesse.

- [ ] **Step 2: Vérifier visuellement les trois surfaces**

Avec le serveur de développement :

```bash
npm run dev
```

À 375 × 812 puis 320 px :

- Routines : aucun « Sans dossier 0 », compteur dans la barre, cadenas et repli identiques à la séance, chevron visible.
- Wiki : résumé aligné, note « Non relu » compacte, aucun `?`, sources repliées, première fiche visible sans grand avertissement.
- Séance : objectif coach lisible, bouton `Appliquer … kg`, action secondaire, aucune écriture en touchant la prose, actions empilées à 320 px.

- [ ] **Step 3: Exécuter le rituel complet**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
git diff --check
```

Expected: cinq commandes avec code de sortie 0.

- [ ] **Step 4: Mettre à jour `PROGRESS.md`**

Ajouter une entrée datée 2026-08-26 contenant exactement les résultats fonctionnels :

```markdown
### Reprise UI Routines, Wiki et coach en séance

- Routines réutilise les commandes de verrou/repli de la séance, masque la racine vide et annonce le repli par chevron.
- Les articles Wiki ont un en-tête aligné, une note de revue compacte, des surfaces factuelles groupées et des sources repliables ; l’aide contextuelle y est supprimée.
- Le coach en séance applique une charge uniquement via un bouton explicite et distingue les observations sans charge.
- Nettoyage : suppression de `wikiDocuments` et de l’export mort `wikiSections`, sans retirer la recherche globale.
- Checkpoint téléphone : vérifier à 320–375 px avec une séance active, puis appliquer et masquer une recommandation hors ligne.
```

- [ ] **Step 5: Committer la trace de livraison**

```bash
git add -- PROGRESS.md
git commit -m "docs: consigner la reprise UI du coach et du wiki"
```

- [ ] **Step 6: Vérifier l’état Git final**

```bash
git status --short
```

Expected: aucune modification suivie ; `.codex-remote-attachments/` reste non suivie et intacte.
