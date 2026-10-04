# Un split sur plusieurs semaines — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** qu'un bloc puisse rejouer un cycle de une à quatre semaines au lieu d'une seule semaine.

**Architecture :** deux champs facultatifs et non indexés (`cycleWeeks` sur la révision, `cycleWeek` sur la
séance planifiée) ; la résolution du split vit dans trois fonctions pures de `lib/programs/schedule.ts` ;
tout lecteur de la semaine qui se joue passe déjà par `resolveSchedule` et n'a rien à changer.

**Tech Stack :** React 19 + TypeScript strict, Dexie, Vitest + Testing Library + `fake-indexeddb`.

**Spec :** `docs/design/specs/2026-10-04-programme-cycle-multi-semaines-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** : chaque phrase vit dans `src/i18n/fr.ts`.
- **Aucune version de schéma Dexie.** Les champs ne sont pas indexés ; absents, ils valent 1 et 0.
- Le passé ne se réécrit jamais : aucune séance faite, aucun `programWeekIndex` n'est touché.
- Un fichier, une responsabilité : la séance du split devient son propre composant plutôt que d'allonger
  l'étape.
- À la fin : `npm run typecheck`, `npm run lint`, `npm run test:run` et `npm run build` verts.

---

### Task 1 : la résolution du cycle (logique pure, TDD)

**Files:**

- Modify: `src/lib/programs/schedule.ts`, `src/lib/programs/schedule.test.ts`, `src/lib/programs/index.ts`

**Interfaces:**

- Produces: `MAX_CYCLE_WEEKS`, `cycleLength`, `entryCycleWeek`, `cyclePosition`, `resolveRevision`,
  `resolveSplitFrom` ; `resolveSchedule` rend désormais les seules séances de la semaine du cycle.

- [ ] **Step 1 :** écrire les tests : alternance sur deux semaines, comptage depuis la semaine d'effet,
  ligne ancienne (ni `cycleWeeks` ni `cycleWeek`) lue comme une semaine qui se répète, semaine de repos,
  séance hors cycle jamais montrée, longueur illisible, position modulo pour une semaine antérieure.
- [ ] **Step 2 :** les voir échouer, puis écrire `cycleLength`, `entryCycleWeek`, `cyclePosition`,
  `resolveRevision`, `resolveSchedule` (sur `resolveRevision`) et `resolveSplitFrom`.
- [ ] **Step 3 :** tester la rotation : `resolveSplitFrom` à la semaine N, réécrite en révision à N,
  rejoue **semaine pour semaine** ce que jouait l'ancienne révision.
- [ ] **Step 4 :** exporter depuis `lib/programs/index.ts`.

### Task 2 : le dépôt (écriture, activation, propriété, réparation)

**Files:**

- Modify: `src/data/types.ts`, `src/data/repositories/programSchedules.ts`,
  `src/data/repositories/programLifecycle.ts`, `src/data/repositories/programs.ts`,
  `src/lib/backup/validate.ts`
- Create: `src/data/repositories/programCycle.test.ts`
- Test: `src/lib/backup/validate.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: `createScheduleRevision(programId, semaine, séances, cycleWeeks = 1)`,
  `ProgramScheduleEntryDraft.cycleWeek?`.

- [ ] **Step 1 :** écrire `programCycle.test.ts` (dix cas) et les voir échouer.
- [ ] **Step 2 :** `types.ts` : `cycleWeeks?` et `cycleWeek?`, commentés comme facultatifs et non indexés.
- [ ] **Step 3 :** `validateScheduleInput` : longueur de cycle de 1 à 4, semaine de chaque séance dans le
  cycle, collision par `semaine : jour : rang`. `writeScheduleRevisionInTransaction` pose les deux champs.
- [ ] **Step 4 :** le « cycle précédent » du calcul des exercices introduits et la validation de
  l'activation lisent `resolveRevision` (tout le cycle), pas `resolveSchedule`.
- [ ] **Step 5 :** `replaceMissingProgramRoutine` lit `resolveSplitFrom` et réécrit le split entier, tourné.
- [ ] **Step 6 :** `readProgramDetail` trie les séances de la révision par semaine du cycle d'abord.
- [ ] **Step 7 :** **contrôle de mutation** — remettre `resolveSchedule` dans le calcul des exercices
  introduits : le test « pas introduits » doit échouer ; le rétablir.
- [ ] **Step 8 :** la validation de sauvegarde déclare `cycleWeeks` (entier ≥ 1) et `cycleWeek` (entier
  ≥ 0) comme facultatifs, avec ses tests : acceptés, absents acceptés, valeurs invalides refusées.

### Task 3 : le modèle de l'éditeur (TDD)

**Files:**

- Modify: `src/features/programs/programEditorModel.ts`
- Create: `src/features/programs/programEditorModel.test.ts`

- [ ] **Step 1 :** tests de `emptySplit`, `orderedSplit` (rang par semaine **et** par jour), `resizeCycle`
  (agrandir ne perd rien, raccourcir replie dans la dernière semaine, ordre conservé), `addSplitSession`
  (en fin de semaine, liste toujours triée par semaine), `splitIssue`, `splitForWeek` (tournée).
- [ ] **Step 2 :** implémenter ; `splitForWeek` passe par `resolveSplitFrom`.

### Task 4 : l'éditeur et la fiche

**Files:**

- Create: `src/features/programs/ProgramSplitSession.tsx`
- Modify: `src/features/programs/ProgramSplitStep.tsx`, `ProgramEditorScreen.tsx`,
  `ProgramDetailScreen.tsx`, `ProgramSessionList.tsx`, `src/i18n/fr.ts`
- Test: `src/features/programs/ProgramFlow.integration.test.tsx`

- [ ] **Step 1 :** `ProgramSplitSession` : le jour, la routine et la sortie de secours d'**une** séance,
  extraits tels quels de l'étape (ancres du tutoriel comprises, portées par la première séance).
- [ ] **Step 2 :** `ProgramSplitStep` : durée du cycle (quatre pastilles), une liste par semaine du cycle,
  « Ajouter à la semaine N » (libellé court : un « 1 » seul passait à la ligne), phrase de redémarrage.
- [ ] **Step 3 :** `ProgramEditorScreen` tient un brouillon `{ cycleWeeks, entries }` et l'enregistre
  avec sa durée de cycle à chaque endroit où il écrit une révision.
- [ ] **Step 4 :** la fiche juge un brouillon sur tout le cycle (`resolveRevision`), dit la semaine du
  cycle, et affiche la liste même pour une semaine de repos complet.
- [ ] **Step 5 :** quatre parcours d'intégration : création à deux semaines, raccourcissement sans perte,
  lecture de la semaine du cycle, réécriture d'un bloc actif sans décalage.

### Task 5 : vérification

- [ ] `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.
- [ ] Chromium à 390 px, thèmes Sombre et TTY1 : le split sur deux semaines, la fiche, aucune erreur de
  console.
