# Hevy Import Confirmation Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre chaque association Hevy visiblement cochée ou décochée et garantir un retour visible après l’action finale « Importer ».

**Architecture:** `HevyMappingDraftRow.resolution` reste l’unique état de validation ; le composant de liste ne fait qu’en dériver son indicateur. Un composant d’état d’opération, rendu sous la revue, occupe le même emplacement pour l’attente et l’échec afin que le retour reste visible au niveau de défilement courant. Le repository et le schéma IndexedDB ne changent pas sauf si la reproduction démontre un défaut de transaction.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Dexie, navigateur intégré en 375 × 812 px.

## Global Constraints

- Une proposition n’est jamais cochée avant un choix explicite.
- Une résolution sauvegardée et encore valide arrive précochée.
- Aucun état `checked` parallèle n’est ajouté.
- Le texte visible continue de distinguer « Proposition », « Associé » et « Association mémorisée ».
- « Continuer » reste désactivé tant qu’une ligne n’a pas de résolution.
- Les choix restent en mémoire après un échec d’import.
- Tous les textes vivent dans `src/i18n/fr.ts`.
- Aucun composant n’importe `db`.
- Les cibles tactiles restent au moins égales à 48 px.

---

### Task 1: Indicateur coché ou décoché sur chaque association

**Files:**
- Modify: `src/features/history/HevyImportMappingStep.tsx`

**Interfaces:**
- Consumes: `HevyMappingDraftRow.resolution`.
- Produces: un cercle d’état décoratif, sans nouvelle donnée persistée.

- [ ] **Step 1: Ajouter l’indicateur dérivé de la résolution**

Importer `CheckIcon`, calculer `const confirmed = row.resolution !== undefined`, puis conserver le
chevron après l’indicateur :

```tsx
<span
  aria-hidden="true"
  className={`flex size-6 shrink-0 items-center justify-center rounded-full border
    ${
      confirmed
        ? 'border-[var(--accent-ink)] bg-[var(--accent-ink)] text-[var(--surface-0)]'
        : 'border-[var(--text-2)] text-transparent'
    }`}
>
  {confirmed && <CheckIcon width={14} height={14} strokeWidth={2.5} />}
</span>
<ChevronRightIcon className="shrink-0 text-[var(--text-2)]" />
```

Le cercle reste `aria-hidden` : le sous-texte de la ligne annonce déjà l’état en toutes lettres.

- [ ] **Step 2: Vérifier le typage et le lint ciblé**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS, sans chaîne UI en dur ni import inutilisé.

- [ ] **Step 3: Commit atomique**

```bash
git add src/features/history/HevyImportMappingStep.tsx
git commit -m "fix(lot-07): coche les associations Hevy validées"
```

### Task 2: Retour visible pendant et après l’import

**Files:**
- Create: `src/features/history/HevyImportOperationStatus.tsx`
- Modify: `src/features/history/HevyImportScreen.tsx`

**Interfaces:**
- Consumes: `kind: 'working' | 'failed'`.
- Produces: `role="status"` pendant l’écriture et `role="alert"` en cas d’échec.

- [ ] **Step 1: Reproduire le symptôme avant modification**

Depuis `/history/import`, charger `src/test/fixtures/hevy-workout-data.csv`, résoudre les cinq
associations, atteindre la revue et cliquer « Importer ». Relever :

- la présence du clic dans le DOM ;
- le texte du pied juste après le clic ;
- le résultat ou l’alerte ;
- les erreurs de console.

Expected sur le code actuel : le pied peut changer, mais aucun statut n’est rendu dans le contenu ;
en cas de rejet, l’alerte est insérée avant la revue et peut rester hors de la zone visible.

- [ ] **Step 2: Créer le composant d’état d’opération**

```tsx
import { useEffect, useRef } from 'react';
import { t } from '@/i18n/fr';
import { Card } from '@/ui';

export function HevyImportOperationStatus({
  kind,
}: {
  kind: 'working' | 'failed';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const failed = kind === 'failed';

  useEffect(() => {
    if (failed) ref.current?.focus();
  }, [failed]);

  return (
    <div
      ref={ref}
      role={failed ? 'alert' : 'status'}
      tabIndex={failed ? -1 : undefined}
      className="outline-none"
    >
      <Card padded>
        <p
          className={`text-sm ${
            failed
              ? 'text-[var(--danger-ink)]'
              : 'font-semibold text-[var(--text-1)]'
          }`}
        >
          {t(
            failed
              ? 'history.importFailed'
              : 'history.importWorking',
          )}
        </p>
      </Card>
    </div>
  );
}
```

Le focus de l’alerte la ramène dans la vue et l’annonce, sans effacer le brouillon.

- [ ] **Step 3: Placer le statut après la revue**

Dans `HevyImportScreen`, supprimer l’ancienne alerte située avant `HevyImportReview`, puis rendre :

```tsx
<HevyImportReview data={state.data} draft={state.draft} />
{state.step === 'importing' && (
  <HevyImportOperationStatus kind="working" />
)}
{state.step === 'review' && state.failed && (
  <HevyImportOperationStatus kind="failed" />
)}
```

Conserver les transitions existantes de `runImport` :

```ts
setState({ step: 'importing', ...ready });
try {
  const result = await importHevyWorkouts(
    ready.data,
    resolutionsFromHevyDraft(ready.draft),
  );
  setState({ step: 'done', result });
} catch {
  setState({ step: 'review', failed: true, ...ready });
}
```

- [ ] **Step 4: Vérifier les deux issues**

Run:

```bash
npm run typecheck
npm run lint
npm run test:run -- src/data/repositories/hevyImport.test.ts
```

Expected: PASS. En navigateur, un import valide atteint « Import terminé » ; un rejet simulé
affiche l’alerte sous la revue sans perdre les associations.

- [ ] **Step 5: Commit atomique**

```bash
git add src/features/history/HevyImportOperationStatus.tsx src/features/history/HevyImportScreen.tsx
git commit -m "fix(lot-07): rend l'état d'import Hevy visible"
```

### Task 3: Checkpoint mobile et portes finales

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: le parcours complet de l’import.
- Produces: preuve de validation et mémoire de reprise.

- [ ] **Step 1: Vérifier le parcours en 375 × 812 px**

Contrôler dans le navigateur :

1. propositions décochées ;
2. choix explicites cochés après plusieurs écrans de défilement ;
3. mappings mémorisés précochés à la seconde ouverture ;
4. « Continuer » activé uniquement à zéro association restante ;
5. statut « Import en cours… » après le clic ;
6. résultat ou erreur visible ;
7. aucune erreur console et aucun débordement horizontal.

- [ ] **Step 2: Lancer les quatre portes**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: quatre commandes avec code de sortie 0 ; seul le warning Vite historique sur le chunk
principal peut rester.

- [ ] **Step 3: Mettre à jour et committer la mémoire**

Inscrire dans `PROGRESS.md` le résultat exact du clic d’import, le nombre final de tests et le
checkpoint téléphone restant.

```bash
git add PROGRESS.md
git commit -m "docs: consigne les retours visuels de l'import Hevy"
```
