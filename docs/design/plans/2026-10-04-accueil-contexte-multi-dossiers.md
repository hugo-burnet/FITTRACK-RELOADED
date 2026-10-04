# « À lancer » sur plusieurs dossiers — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** que la suggestion de l'accueil puisse suivre plusieurs dossiers à la fois, pour qu'un cycle
qui les traverse se lise comme une suite.

**Architecture :** le réglage gagne une forme « plusieurs dossiers » (les deux anciennes restent lues et
écrites pour un choix unique) ; un module pur porte la forme et ses conversions ; la projection de
l'accueil classe l'union dossier après dossier ; la feuille de choix passe en cases à cocher sur un
brouillon, écrit une fois.

**Tech Stack :** React 19 + TypeScript strict, Dexie, Vitest + Testing Library + `fake-indexeddb`.

**Spec :** `docs/design/specs/2026-10-04-accueil-contexte-multi-dossiers-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** : chaque phrase vit dans `src/i18n/fr.ts`.
- Aucune table, aucun index, aucune version de schéma ; aucun réglage existant ne se migre.
- `pickSuggestedRoutine` ne change pas : la règle reste « la moins récemment réalisée ».
- La feuille ne passe pas par `MultiOptionSheet` : elle écrit un réglage local et doit rester ouverte si
  l'écriture échoue.
- À la fin : `npm run typecheck`, `npm run lint`, `npm run test:run` et `npm run build` verts.

---

### Task 1 : le module pur du contexte (TDD)

**Files:**

- Create: `src/lib/routineContext.ts`, `src/lib/routineContext.test.ts`

**Interfaces:**

- Produces: `RoutineFolderContext` (trois formes), `RoutineContextValue`,
  `normalizeRoutineFolderContext`, `routineContextValues`, `routineContextFromValues`.

- [ ] **Step 1 :** tests de la lecture défensive (formes historiques, plusieurs dossiers, doublons,
  racine seule, et treize entrées invalides qui valent « aucun choix »), des valeurs d'un réglage, du
  réglage d'une sélection (aucun, un seul dans sa forme historique, plusieurs, doublon, identifiant qui
  contient `:`) et de l'aller-retour.
- [ ] **Step 2 :** les voir échouer, puis écrire le module.

### Task 2 : le réglage et la projection de l'accueil

**Files:**

- Modify: `src/data/repositories/settings.ts`, `src/data/repositories/home.ts`
- Test: `src/data/repositories/settings.test.ts`, `src/data/repositories/home.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: `HomeDashboardData.routineContext.selected: RoutineContextValue[]` (vide tant que rien de
  valide n'est choisi) ; `getRoutineFolderContext` relit la nouvelle forme.

- [ ] **Step 1 :** `settings.ts` importe le type et la lecture du module pur et les ré-exporte ; ses
  tests couvrent la nouvelle forme et les sélections invalides.
- [ ] **Step 2 :** `home.test.ts` : passer l'existant à la forme tableau, puis écrire les neuf cas
  (plus ancienne de l'union, passage d'un dossier au suivant, premier dossier de la bibliothèque, ordre de
  la bibliothèque, dossier non coché jamais proposé, racine, dossier supprimé, tous supprimés, dossier
  unique inchangé). Les voir échouer.
- [ ] **Step 3 :** `getHomeDashboard` : la sélection valide est lue dans l'ordre des options ; les
  candidats sont classés par `(rang du dossier, Routine.order, id)` et reçoivent leur position pour
  `order`.

### Task 3 : la feuille et la carte

**Files:**

- Modify: `src/features/home/HomeRoutineContextSheet.tsx`, `HomeSuggestionCard.tsx`,
  `homeRoutineContextPresentation.ts`, `src/i18n/fr.ts`
- Test: `HomeRoutineContextSheet.test.tsx`, `HomeSuggestionCard.test.tsx`, `HomeScreen.test.tsx`

- [ ] **Step 1 :** réécrire les tests de la feuille : rien d'écrit avant « Terminé », forme historique
  pour un choix unique, ordre de la bibliothèque, départ depuis la sélection enregistrée, sélection vide
  refusée, phrase d'aide, écriture bloquante puis échec, brouillon oublié à la fermeture, cibles de 56 px.
- [ ] **Step 2 :** la feuille : cases à cocher, brouillon local réinitialisé à chaque ouverture, une
  écriture au « Terminé ».
- [ ] **Step 3 :** la carte liste les dossiers suivis, adapte la règle écrite et le message de vide.
- [ ] **Step 4 :** le titre de la feuille tient en une ligne à 390 px (« Choisir les dossiers ») : la
  première version, plus longue, était tronquée.

### Task 4 : vérification

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.
- [ ] Chromium à 390 px, thèmes Sombre et TTY1 : la feuille (requise, deux cases cochées), la carte à
  deux dossiers qui propose la plus ancienne, aucune erreur de console.
