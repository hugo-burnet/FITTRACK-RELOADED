# Program Phase Documentation Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire ouvrir au lien « Ce qu’en dit le corpus » l’article actuel du Guide correspondant à la phase du bloc.

**Architecture:** `phaseEvidenceFor` résout à la fois les informations d’affichage de la section source et l’adresse de l’article qui cite ses fiches. `ProgramDetailScreen` consomme cette adresse sans connaître la structure des routes du Guide.

**Tech Stack:** React 19, TypeScript strict, React Router 7, Vitest, Testing Library.

## Global Constraints

- Ne restaurer aucune route `/knowledge/p/:sectionId`.
- Ne pas ajouter d’écran d’erreur générique dans ce correctif.
- Conserver les phases `construction` et `test` sans lien.
- Ne modifier aucun fichier de badge ou de palier appartenant à Gork.
- Selon la demande utilisateur, ne lancer aucune commande de test avant la vérification finale commune aux deux plans.

## File Structure

- `src/features/programs/phaseEvidence.ts` : résout la section source et l’article actuel.
- `src/features/programs/phaseEvidence.test.ts` : verrouille les quatre adresses de phase.
- `src/features/programs/ProgramDetailScreen.tsx` : consomme l’adresse résolue.
- `src/features/programs/ProgramFlow.integration.test.tsx` : vérifie l’adresse réellement rendue sur la fiche d’un bloc.

---

### Task 1: Résoudre l’article actuel depuis le corpus

**Files:**
- Modify: `src/features/programs/phaseEvidence.test.ts`
- Modify: `src/features/programs/phaseEvidence.ts`

**Interfaces:**
- Consumes: `findProgrammingSection(sectionId: string)`, `findArticleForRow(rowId: string)`, `articleHref(article: WikiArticle)`.
- Produces: `PhaseEvidence` avec `href: string` et `phaseEvidenceFor(phase: ProgramPhase): PhaseEvidence | null`.

- [ ] **Step 1: Écrire le test de régression sans l’exécuter**

Ajouter dans `phaseEvidence.test.ts` :

```ts
it('mène chaque phase documentée à son article actuel du Guide', () => {
  const expected = {
    deload: '/knowledge/programmation/programming-deload',
    progression: '/knowledge/programmation/programming-progression',
    overload: '/knowledge/programmation/programming-volume',
    return: '/knowledge/programmation/programming-fatigue-recovery',
  } as const;

  for (const [phase, href] of Object.entries(expected)) {
    expect(phaseEvidenceFor(phase as keyof typeof expected)?.href, phase).toBe(href);
  }
});
```

Dans le test « ne renvoie jamais un lien mort », ajouter :

```ts
expect(evidence.href, phase).toMatch(/^\/knowledge\/programmation\/[a-z0-9-]+$/u);
```

- [ ] **Step 2: Ajouter l’adresse à `PhaseEvidence`**

Dans `phaseEvidence.ts`, ajouter les imports :

```ts
import { articleHref, findArticleForRow } from '@/features/knowledge/articleCatalogue';
```

Étendre le type :

```ts
export type PhaseEvidence = {
  sectionId: string;
  title: string;
  count: number;
  href: string;
};
```

- [ ] **Step 3: Résoudre l’article depuis une fiche déclarée par le corpus**

Remplacer la fin de `phaseEvidenceFor` par :

```ts
const rows = section.rows.filter((row) => !row.isBibliography);
if (rows.length === 0) return null;
const article = findArticleForRow(rows[0]!.rowId);
if (article === undefined) return null;
return {
  sectionId,
  title: section.title,
  count: rows.length,
  href: articleHref(article),
};
```

Ne lancer aucun test à cette étape.

---

### Task 2: Faire consommer l’adresse par la fiche du bloc

**Files:**
- Modify: `src/features/programs/ProgramFlow.integration.test.tsx`
- Modify: `src/features/programs/ProgramDetailScreen.tsx`

**Interfaces:**
- Consumes: `PhaseEvidence.href` produit par Task 1.
- Produces: un lien React Router vers l’article actuel du Guide.

- [ ] **Step 1: Écrire le test d’intégration sans l’exécuter**

Ajouter dans le premier `describe` de `ProgramFlow.integration.test.tsx` :

```tsx
it('ouvre l’article du Guide correspondant à la phase courante', async () => {
  const routine = await createRoutine('Décharge');
  const program = await createProgramDraft({
    name: 'Bloc décharge',
    startsAt: mondayWeeksAgo(0),
    durationWeeks: 4,
  });
  await createScheduleRevision(program.id, 0, [
    { routineId: routine.id, dayOfWeek: 1, order: 0 },
  ]);
  await replaceProgramWeeks(
    program.id,
    Array.from({ length: 4 }, (_, weekIndex) => ({
      weekIndex,
      loadIndex: weekIndex === 0 ? 60 : 100,
      phase: weekIndex === 0 ? ('deload' as const) : ('construction' as const),
    })),
  );
  await activateProgram(program.id);

  renderProgramFlow(`/programs/${program.id}`);

  expect(
    await screen.findByRole('link', { name: /Ce qu’en dit le corpus/u }),
  ).toHaveAttribute('href', '/knowledge/programmation/programming-deload');
});
```

- [ ] **Step 2: Supprimer la construction de l’ancienne route**

Dans `CurrentIntention`, remplacer :

```tsx
to={`/knowledge/p/${evidence.sectionId}`}
```

par :

```tsx
to={evidence.href}
```

Ne lancer aucun test à cette étape. La vérification commune est définie dans le plan de transition unilatérale.
