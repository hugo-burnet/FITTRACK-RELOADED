# Ajouter un dossier au split d'un bloc — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** poser d'un appui toutes les routines d'un dossier dans une semaine du cycle d'un split.

**Architecture :** deux fonctions pures dans le modèle du split (`addFolderSessions`,
`splitFolderChoices`), les dossiers lus avec les routines par l'éditeur, un bouton par semaine et une
feuille à choix unique dans l'étape Split.

**Tech Stack :** React 19 + TypeScript strict, Dexie, Vitest + Testing Library + `fake-indexeddb`.

**Spec :** `docs/design/specs/2026-10-04-split-ajouter-un-dossier-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** : chaque phrase vit dans `src/i18n/fr.ts`.
- Aucune table, aucun index, aucune version de schéma, aucune requête réseau.
- Un fichier, une responsabilité : le modèle du split quitte `programEditorModel.ts` (devenu trop long)
  pour son propre module.
- Cibles tactiles de 48 px au moins ; le libellé du bouton tient sur une ligne à 390 px, dans la police du
  thème TTY1 comme dans les autres.
- À la fin : `npm run typecheck`, `npm run lint`, `npm run test:run` et `npm run build` verts.

---

### Task 1 : les deux fonctions pures (TDD)

**Files:**

- Modify: `src/features/programs/programEditorModel.ts`, `src/features/programs/programEditorModel.test.ts`

**Interfaces:**

- Produces: `addFolderSessions(split, cycleWeek, routineIds): ProgramSplitDraft`,
  `splitFolderChoices(folders, routines): SplitFolderChoice[]` (`name: null` pour la racine).

- [ ] **Step 1 :** écrire les tests (douze) : emplacement vide remplacé et jours consécutifs ; départ au
  lendemain du dernier jour ; retour au lundi après le dimanche ; rangement sous la bonne semaine, liste
  triée ; seuls les emplacements de la semaine visée remplacés ; séances remplies conservées ; dossier vide
  sans effet ; durée du cycle conservée et brouillon d'entrée intact ; ordre des dossiers, ordre des routines ;
  dossier vide écarté ; « Sans dossier » en dernier ; rien sans dossier.
- [ ] **Step 2 :** les voir échouer, puis écrire les deux fonctions.

### Task 2 : le modèle du split dans son module

**Files:**

- Create: `src/features/programs/programSplitModel.ts`
- Rename: `programEditorModel.test.ts` → `programSplitModel.test.ts`
- Modify: `programEditorModel.ts`, `ProgramEditorScreen.tsx`, `ProgramSplitStep.tsx`

- [ ] **Step 1 :** `programEditorModel.ts` dépasse 300 lignes et fait deux métiers : déplacer
  `emptySplit`, `orderedSplit`, `resizeCycle`, `addSplitSession`, `addFolderSessions`,
  `splitFolderChoices`, `splitForWeek` et `splitIssue` dans `programSplitModel.ts`. Le fichier de tests, qui
  ne couvrait que le split, suit.
- [ ] **Step 2 :** mettre les imports à jour ; typecheck, lint et tests de `features/programs` verts.

### Task 3 : les dossiers dans l'éditeur

**Files:**

- Modify: `src/features/programs/useProgramEditorData.ts`, `ProgramEditorScreen.tsx`,
  `ProgramSplitStep.tsx`, `src/i18n/fr.ts`
- Test: `src/features/programs/ProgramFlow.integration.test.tsx`

- [ ] **Step 1 :** `useProgramEditorData` lit `listFolders()` avec les résumés de routines, dans la même
  lecture réactive, et expose `folders`.
- [ ] **Step 2 :** `ProgramSplitStep` : un bouton « Ajouter un dossier » sous « Ajouter à la semaine N »,
  seulement s'il y a un dossier à proposer ; son nom accessible dit la semaine quand le cycle en a
  plusieurs. Une `OptionSheet` liste les dossiers (« N routines »), sans présélection.
- [ ] **Step 3 :** textes dans `fr.ts` ; le titre de la feuille est court (« Ajouter un dossier ») : la
  première version, plus longue, était tronquée dans la police du terminal.
- [ ] **Step 4 :** deux parcours d'intégration : UL puis PPL jusqu'à l'activation, avec le split relu en
  base ; aucun bouton sans dossier.

### Task 4 : vérification

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.
- [ ] Chromium à 390 px, thèmes Sombre et TTY1 : le bouton, la feuille, dix séances posées en deux appuis,
  aucune erreur de console.
