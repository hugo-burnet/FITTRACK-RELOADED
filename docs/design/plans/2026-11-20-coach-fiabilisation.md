# Fiabilisation du coach — plan d'exécution

> **Pour l'exécutant :** un groupe = un sous-agent. Les cases `- [ ]` se cochent au fil de l'eau.
> Lis `CLAUDE.md` et la spec avant de commencer. Tu ne vois que ton groupe : le bloc « Interfaces » dit
> ce que les autres groupes attendent de toi.

**But :** corriger les défauts de l'audit du coach (lots A à E), test d'abord, sans toucher à la
politique du RPE ni des sauts de charge.

**Architecture :** rien ne bouge. Le moteur pur reste dans `src/lib/coach/`, les écritures dans
`src/data/repositories/coach*.ts`, l'écran dans `src/features/workout/`. Aucun changement de schéma
Dexie, aucun champ ajouté à un type stocké.

**Stack :** TypeScript strict, Vitest + `fake-indexeddb`, Dexie, React, Playwright.

**Spec :** `docs/design/specs/2026-11-20-coach-fiabilisation-design.md`

## Contraintes globales

- **Ne pas toucher** à `src/lib/backup/validate.ts`, `src/data/repositories/backup.ts`, `backend/`,
  `src/lib/sync/`, `src/stores/sync*`, `vite.config.ts`, `package.json`, `package-lock.json` : une
  branche de synchronisation non publiée les réécrit.
- Aucun changement de schéma (`src/data/db.ts`) ni de type stocké (`src/data/types.ts`).
- Textes d'interface en français dans `src/i18n/fr.ts`, jamais en dur. N'ajouter une clé que si
  nécessaire, à côté des clés `coach.*` existantes.
- Pas de `any`. Dates en epoch ms. Un commentaire dit **pourquoi** (quel défaut réel il empêche).
- TDD : le test échoue d'abord, et tu le **vois** échouer pour la bonne raison.
- Un test existant qui casse : ne change son assertion que si la règle change **dans ce plan** ; dis-le
  dans ton rapport, test par test. Sinon c'est ton code qui a tort.
- Seuils fixés par la spec : refus **14 jours**, carte chiffrée périmée à **28 jours**, reprise
  **strictement plus de 14 jours civils**.
- **Vague 1 : quatre agents travaillent en même temps dans le même dossier, sur des fichiers
  disjoints.** Ne modifie que les fichiers de ton groupe. **Ne commite pas, ne lance ni `git add` ni
  `git stash` ni `git checkout`.** Ne lance que tes tests ciblés (`npx vitest run <fichiers>`), pas la
  suite complète (dix minutes), pas le build. Un échec qui vient d'un fichier hors de ton groupe : attends
  une minute, relance ; s'il persiste, signale-le sans y toucher.
- Rapport final, court : fichiers modifiés, tests ajoutés (nom + ce qu'ils prouvent), tests existants
  dont l'assertion a changé et pourquoi, sortie de la dernière exécution des tests, tout écart au plan.

## Points de relecture

Ce que la spec implique et qu'un test doit tenir (chacun est rattaché à son groupe ci-dessous) :

1. Une recommandation ignorée **avant** ce correctif (ligne `dismissed` sans `resolvedAt`) : on retombe
   sur `updatedAt` ; elle ne doit ni planter ni bloquer pour toujours. (G1)
2. « Appliquer » quand la ligne de l'exercice n'a **que** des échauffements non validés : rien d'écrit,
   carte toujours en attente. (G2)
3. Une séance dont **toutes** les séries sont sans cible (séance libre, import Hevy) : le moteur lit
   exactement comme avant. (G5)
4. Reprise au changement d'heure : deux séances à 14 jours civils d'écart mais 14 × 24 h + 1 h en
   millisecondes ne sont **pas** une reprise. (G5)
5. `finalizeCoachForWorkout` appelée deux fois de suite : un seul jeu de lignes. (G1)

---

## Vague 1 — quatre groupes en parallèle

### Groupe G1 — Enregistrement des cartes (A2, A3, C1, C2, C5, C6, C7)

**Fichiers :**
- Modifier : `src/data/repositories/coachRecommendations.ts`, `src/data/repositories/coachEvaluate.ts`
- Tests : `src/data/repositories/coachRecommendations.test.ts`, `src/data/repositories/coachEvaluate.test.ts`

**Interfaces — produit :**
- `export const DISMISSAL_DAYS = 14` et `export const PENDING_MAX_AGE_DAYS = 28` dans
  `coachRecommendations.ts`.
- `export function isRefused(rows: readonly CoachRecommendation[], signal: CoachSignal, at: number): boolean`
  dans `coachRecommendations.ts` : vrai si une ligne `dismissed` porte la même proposition
  (`sameProposal`) et que `at - (row.resolvedAt ?? row.updatedAt) < DISMISSAL_DAYS` jours.
- `listPendingRecommendations(exerciseIds?, now = Date.now())` : second paramètre facultatif.
- Signatures inchangées pour tout le reste (`finalizeCoachForWorkout`, `evaluateCoachForWorkout`,
  `recordCoachSignals`, `reconcileFollowedLoads`, `supersedePendingRecommendations`).

- [ ] **C1 — test** (`coachRecommendations.test.ts`) : carte `range_ceiling_reached` à 102,5 ignorée à
  `T`. `recordCoachSignals` de la même proposition à `T + 13 j` → rien de créé ; à `T + 14 j` → une ligne
  `pending`. Point de relecture 1 : une ligne `dismissed` dont on a retiré `resolvedAt` bloque selon son
  `updatedAt`, sans exception.
- [ ] **C1 — code** : `isRefused`, utilisé par `recordCoachSignals` à la place du `existing.some(...)`.
- [ ] **C5 — test** (`coachEvaluate.test.ts`) : une proposition ignorée il y a 2 jours n'est **pas** dans
  le retour de `evaluateCoachForWorkout` ; ignorée il y a 15 jours, elle y est.
- [ ] **C5 — code** : `evaluateCoachForWorkout` filtre son résultat final par `isRefused` (lecture des
  lignes des exercices concernés, `at = Date.now()`).
- [ ] **C6 — test** : une carte `pending` chiffrée (`nextLoadKg` défini) de 29 jours n'est pas rendue par
  `listPendingRecommendations(ids, now)` ; à 28 jours elle l'est ; une carte sans charge de 60 jours
  l'est toujours ; la ligne en base garde `status: 'pending'`.
- [ ] **C6 — code** : filtre à la lecture dans `newestPerExercise` ou juste avant, **après** le choix de
  la plus récente (une vieille carte ne doit pas remonter parce que la récente est écartée — ici il n'y
  a qu'une `pending` vivante par exercice, mais ne t'appuie pas dessus).
- [ ] **C7 — test** : objectif 102,5 en attente ; séance hors programme `102,5 × 8`, `102,5 × 8`,
  `95 × 10` (dernière série allégée) → la carte passe `followed` avec `outcomeLoadKg: 102.5`, pas
  `superseded`.
- [ ] **C7 — code** : dans `finalizeCoachForWorkout`, un `outcome` par **charge distincte** des séries de
  travail validées de l'exercice (toutes ses lignes confondues), au lieu de la seule dernière série.
  `reconcileFollowedLoads` ne doit écrire qu'une fois par ligne de recommandation.
- [ ] **C2 — test** : objectif 102,5 en attente, puis séance allégée (`deloadPercent: 60` sur la séance)
  de l'exercice → après `finalizeCoachForWorkout`, la carte est toujours `pending`, aucune ligne
  nouvelle. Même attente pour une séance de semaine de décharge d'un programme si le fichier de test a
  déjà de quoi en construire une ; sinon, le dire dans le rapport.
- [ ] **C2 — code** : `finalizeCoachForWorkout` ne fait ni suivi, ni retrait, ni enregistrement pour une
  séance allégée. Même définition que le moteur : `isDeloadLine` de `src/lib/coach/sets.ts` sur les
  lignes de la séance (l'importer depuis `@/lib/coach/sets` ; ne pas modifier ce fichier). Elle retourne
  quand même les signaux évalués.
- [ ] **A2 — test** : faire échouer `db.coachRecommendations.add` (espion qui rejette) pendant
  `finalizeCoachForWorkout` alors qu'une carte est en attente → l'appel rejette **et** la carte d'avant
  est toujours `pending`.
- [ ] **A2 — code** : suivi + retrait + enregistrement dans une seule
  `db.transaction('rw', db.coachRecommendations, …)`. Toutes les lectures d'autres tables
  (`getWorkoutDetail`, l'évaluation) **avant** la transaction. Les transactions internes des fonctions
  appelées s'emboîtent ; pas d'`await` non-Dexie à l'intérieur.
- [ ] **A3 — test** (point de relecture 5) : deux appels de suite → mêmes lignes qu'un seul (compter par
  statut).
- [ ] **A3 — code** : dans la transaction, sortir si une ligne vivante porte déjà
  `sourceWorkoutId === workoutId`. Ne pas toucher au chemin benchmark (`recordBenchmarkObjectives`).
- [ ] Vérifier : `npx vitest run src/data/repositories/coachRecommendations.test.ts src/data/repositories/coachEvaluate.test.ts src/data/repositories/coachApply.test.ts src/data/repositories/benchmark.test.ts`

### Groupe G2 — « Appliquer » (B1 à B5)

**Fichiers :**
- Modifier : `src/data/repositories/coachApply.ts`, `src/features/workout/WorkoutScreen.tsx`
  (uniquement les props `onDismissCoach` / `onApplyCoach` et leurs imports),
  `src/features/workout/CoachCard.tsx` si nécessaire
- Tests : `src/data/repositories/coachApply.test.ts`, `src/features/workout/WorkoutScreen.integration.test.tsx`

**Interfaces — produit :**
- `export async function applyCoachRecommendation(recommendationId: string, workoutId: string): Promise<number>`
  dans `coachApply.ts`. Une transaction sur `workoutSets`, `workoutExercises`, `exercises`,
  `coachRecommendations`. Lit la recommandation (vivante, `pending`, `nextLoadKg` défini, sinon `0`),
  écrit la charge sur **toutes** les lignes vivantes de la séance dont `exerciseId` est celui de la
  recommandation, et **si au moins une série a été écrite** passe la recommandation en `followed`
  (`resolvedAt`, `outcomeWorkoutId`, `outcomeLoadKg`). Retourne le nombre de séries écrites.
- `applyCoachObjective(workoutExerciseId, loadKg)` garde sa signature.

- [ ] **B1 — test** : ligne avec `warmup 20 kg`, `warmup 40 kg`, `normal 50`, `normal 50`, `dropset 35`,
  toutes non validées ; `applyCoachObjective(row, 52.5)` → les deux `normal` à 52,5 ; échauffements et
  dégressive inchangés ; retour `2`.
- [ ] **B1 — code** : filtre `isWorkingSet` (`@/lib/records`) et `setType !== 'dropset'`.
- [ ] **B2/B3 — tests** : (a) exercice présent sur deux lignes → `applyCoachRecommendation` écrit sur les
  deux et la recommandation est `followed` ; (b) toutes les séries de travail déjà validées → retour `0`,
  recommandation toujours `pending` ; (c) point de relecture 2 : seulement des échauffements non validés
  → `0`, `pending` ; (d) recommandation déjà `dismissed` → `0`, rien d'écrit.
- [ ] **B2/B3 — code** : `applyCoachRecommendation`, qui réutilise le cœur de `applyCoachObjective` (une
  fonction interne partagée, appelée dans la transaction).
- [ ] **B4/B5 — test** (`WorkoutScreen.integration.test.tsx`, en suivant les tests de carte du coach déjà
  présents) : séance allégée (`deloadPercent` égal à `DELOAD_PERCENT`) avec un objectif chiffré en attente
  → la carte est affichée, le bouton « Appliquer » absent.
- [ ] **B4/B5 — code** dans `WorkoutScreen.tsx` : `onApplyCoach` appelle
  `applyCoachRecommendation(objective.id, workout.id)` et vaut `undefined` quand `deloadActive` ;
  `onDismissCoach` rattrape le rejet (`.catch(() => undefined)`, la carte reste). Retirer l'import devenu
  inutile de `markRecommendationFollowed` s'il ne sert plus dans ce fichier.
- [ ] Vérifier : `npx vitest run src/data/repositories/coachApply.test.ts src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/CoachCard.test.tsx`

### Groupe G4 — Écran, voix, réglage (A1, D1, D2, D3)

**Fichiers :**
- Modifier : `src/features/workout/WorkoutFinishScreen.tsx` (la requête `coachSignals` seulement),
  `src/features/workout/useActiveWorkout.ts` (la requête `pendingCoach` seulement),
  `src/features/home/HomeVolumeCard.tsx`, `src/features/workout/workoutRecapVoice.ts`,
  `src/features/workout/coachCopy.ts`, `src/features/settings/DefaultLoadStepRow.tsx`, `src/i18n/fr.ts`
- Tests : `src/features/workout/WorkoutFinishScreen.test.tsx`, `src/features/workout/workoutRecapVoice.test.ts`,
  `src/features/workout/coachCopy.test.ts`, `src/features/home/HomeVolumeCard.test.tsx`,
  `src/features/settings/CoachSettings.test.tsx`

- [ ] **A1 — test** (`WorkoutFinishScreen.test.tsx`) : `evaluateCoachForWorkout` rejette → l'écran de fin
  s'affiche quand même avec son bouton d'enregistrement, et l'enregistrement aboutit (suivre le test
  d'enregistrement existant du fichier). Même idée pour `HomeVolumeCard` : `listVolumeLow` rejette → la
  carte ne rend rien, pas d'exception.
- [ ] **A1 — code** : `try/catch` **dans** la fonction passée à `useLiveQuery`, qui rend `[]`. Une
  requête vive qui rejette relance l'erreur au rendu et l'écran d'erreur global remplace l'écran : c'est
  le défaut, dis-le dans le commentaire. Trois endroits : `WorkoutFinishScreen` (`coachSignals`),
  `useActiveWorkout` (`pendingCoach`), `HomeVolumeCard` (`lows`).
- [ ] **D1 — test** (`workoutRecapVoice.test.ts`) : signal `range_ceiling_reached` **sans** `nextLoadKg`
  et sans preuve `ceiling_grinding` / `step_needs_reps` → la réplique n'est pas `coach-recap-increase`
  (attendu : `coach-recap-progress`) ; `range_missed` sans `nextLoadKg` → pas de `coach-recap-adjust`
  (attendu : aucune réplique). Avec `nextLoadKg`, les deux répliques d'aujourd'hui restent.
- [ ] **D1 — code** : `signalCue` dans `workoutRecapVoice.ts`.
- [ ] **D2 — test** (`coachCopy.test.ts`) : pour chacun des codes `returning`, `range_ceiling_reached`
  avec `ceiling_grinding`, `intra_session_drop`, `consolidating`, portant le drapeau de progression
  différée, `coachSignalMessage` contient **à la fois** la mention de maintien et le constat que rend le
  même signal sans le drapeau. Et il ne contient jamais « → » suivi d'une charge quand `nextLoadKg` est
  absent.
- [ ] **D2 — code** : dans `coachCopy.ts`, la branche `FLAG_PROGRESSION_DEFERRED` préfixe le constat
  (comme `coach.controlledAttempt`, qui prend `{ reason }`) au lieu de le remplacer. Nouvelle clé dans
  `fr.ts` si besoin (par exemple `coach.progressionDeferredWith`), l'ancienne reste si un autre appelant
  s'en sert.
- [ ] **D3 — test** : dans le formulaire du pas de charge, `0,1` n'est pas enregistrable, `0,25` l'est
  (suivre les tests de `CoachSettings.test.tsx`).
- [ ] **D3 — code** : `valid` compare à `LOAD_STEP_MIN_KG` (déjà importé) au lieu de `> 0`.
- [ ] Vérifier : `npx vitest run src/features/workout/WorkoutFinishScreen.test.tsx src/features/workout/workoutRecapVoice.test.ts src/features/workout/coachCopy.test.ts src/features/home/HomeVolumeCard.test.tsx src/features/settings/CoachSettings.test.tsx`

### Groupe G5 — Moteur (E1 à E8)

**Fichiers :**
- Modifier : `src/lib/coach/sets.ts`, `src/lib/coach/history.ts`, `src/lib/coach/evaluate.ts`,
  `src/lib/coach/rules/range.ts`, `src/lib/coach/rules/plateau.ts`, `src/lib/coach/volume.ts`,
  `src/data/repositories/workoutSets.ts` (`duplicateLastSet` seulement)
- Tests : `src/lib/coach/evaluate.test.ts`, `src/lib/coach/volume.test.ts`, et le fichier de test qui
  couvre déjà `duplicateLastSet` (le chercher : `grep -rl duplicateLastSet src --include=*.test.ts*`)

**Interfaces — produit :** aucune signature publique ne change. Un helper nouveau dans `sets.ts` :
`export function prescribedSets(sets: readonly CoachSetInput[]): CoachSetInput[]` — les séries qui
portent une cible (`targetReps` ou `targetRepsMax` défini) quand au moins une en porte, sinon toutes.

Tous les scénarios ci-dessous : exercice `weight_reps`, barre, 100 kg, fourchette 8 – 12 sauf mention.

- [ ] **E1 — test** : dernière série de travail validée `reps: 10, targetReps: 8, targetRepsMax: 12` →
  la série ajoutée par `duplicateLastSet` a `targetReps: 8, targetRepsMax: 12`. Dernière série sans
  aucune cible, `reps: 10` → comportement actuel inchangé (`targetReps: 10`).
- [ ] **E1 — code** : dans `duplicateLastSet`, si `last.targetReps !== undefined`, recopier
  `targetReps` et `targetRepsMax` tels quels. Le reste (charge, durée, distance) ne bouge pas.
- [ ] **E2 — tests** : (a) `12 · 12 · 12` ciblées + une quatrième série **sans cible** à 6 reps →
  `range_ceiling_reached` avec charge proposée ; (b) deux séances `7 · 7 · 7` ciblées (manque du bas),
  la seconde avec une série sans cible en plus → `range_missed` ; (c) point de relecture 3 : séance où
  aucune série n'a de cible → mêmes signaux qu'avant (aucun de fourchette).
- [ ] **E2 — code** : `prescribedSets`, appliqué dans `rangePartitionSignal` (à `working` et `judged`),
  dans `floorMiss`, et dans `contractKey` (les paires ne viennent que des séries qui portent une cible).
- [ ] **E3 — test** : trois séances à 100 kg `10 · 9 · 8` → `10 · 10 · 8` → `10 · 10 · 9` : pas de signal
  `plateau`, et `allowedActions` contient `increase_reps`. Contre-épreuve : `10 · 9 · 8` trois fois →
  `plateau` (comportement actuel).
- [ ] **E3 — code** : dans `plateauSignal`, après la garde « une répétition de plus à la même charge » :
  si le **total** des répétitions des séries de travail à la charge du haut de la dernière séance dépasse
  le plus grand total des séances précédentes de la fenêtre à cette même charge, pas de plateau.
- [ ] **E4 — tests** : (a) séances le 1er à 19 h et le 15 à 8 h (heure locale, 14 jours civils) → pas de
  `returning` ; (b) le 1er à 8 h et le 16 à 8 h (15 jours civils) → `returning` avec `gap_days: 15` ;
  (c) point de relecture 4 : 14 jours civils à cheval sur un changement d'heure (construire les dates
  avec `new Date(année, mois, jour, heure)`, pas en additionnant des millisecondes) → pas de `returning`.
- [ ] **E4 — code** : `sinceLatestReturn` compte en jours civils locaux (différence des minuits locaux,
  arrondie), reprise si **strictement supérieur** à `RETURN_GAP_DAYS`. Des tests existants posent une
  reprise à 14 jours pile : c'est la règle qui change (spec E4) — les passer à 15 jours et le lister dans
  le rapport.
- [ ] **E5 — test** : dernière séance après 20 jours avec seulement un échauffement validé → aucun signal
  `returning`. **Code** : dans `evaluatePerformance`, `returning` exige au moins une série de travail
  validée dans `latest` (`completedWorkingSets`).
- [ ] **E6 — test** : séries `targetReps: 10, targetRepsMax: 8`, `10 · 10 · 10` → lu comme une cible
  unique de 10 (plafond atteint), et jamais `range_missed` en même temps. **Code** : `effectiveCeiling`
  rend `targetRepsMax` seulement s'il est strictement supérieur à `targetReps` (ou si `targetReps` est
  absent).
- [ ] **E7 — test** : séries à `weight: NaN`, plafond atteint → signal sans `nextLoadKg` et sans preuve
  `next_load_kg` ni `current_load_kg` à `NaN`. **Code** : `Number.isFinite` là où `rangePartitionSignal`
  et `floorMiss` choisissent la charge de référence.
- [ ] **E8 — test** (`volume.test.ts`) : entrées chaque lundi à 19 h, `now` un lundi à 8 h →
  `rollingWeekSets` ne compte pas le lundi précédent. **Code** : la borne basse est le minuit local d'il
  y a six jours civils (sept jours civils, aujourd'hui compris), entrées `>=` borne et `<= now`.
- [ ] Vérifier : `npx vitest run src/lib/coach src/data/repositories/coachEvaluate.test.ts src/data/repositories/coachVolume.test.ts` plus le fichier de test de `duplicateLastSet`.

---

## Vague 2 — après relecture et commit de la vague 1

### Groupe G3 — Séance abandonnée, supprimée, corrigée (C3, C4)

**Fichiers :**
- Modifier : `src/data/repositories/workoutLifecycle.ts` (`discardWorkout`, `deleteWorkout`),
  `src/data/repositories/history.ts` (`saveArchivedWorkout`), `src/data/repositories/coachRecommendations.ts`
- Tests : `src/data/repositories/coachRecommendations.test.ts`, plus les fichiers de test existants de
  `discardWorkout` / `deleteWorkout` / `saveArchivedWorkout` (les chercher)

**Interfaces — produit**, dans `coachRecommendations.ts`, toutes deux à appeler **dans** la transaction
de l'appelant (qui doit lister `db.coachRecommendations`) :
- `reopenRecommendationsFollowedBy(workoutId: string, exerciseIds: readonly string[]): Promise<void>` —
  les lignes `followed` dont `outcomeWorkoutId === workoutId` redeviennent `pending`, sans `resolvedAt`
  ni `outcomeWorkoutId` ni `outcomeLoadKg`.
- `retirePendingRecommendationsFrom(workoutId: string, exerciseIds: readonly string[], at: number): Promise<void>`
  — les lignes `pending` dont `sourceWorkoutId === workoutId` passent `superseded`, `resolvedAt: at`.

- [ ] **C3 — test** : objectif appliqué en séance (`followed`, `outcomeWorkoutId` = la séance), puis
  `discardWorkout` → la ligne est `pending` et `listPendingRecommendations` la rend.
- [ ] **C3 — code** : `discardWorkout` ajoute `db.coachRecommendations` à sa transaction et appelle
  `reopenRecommendationsFollowedBy`.
- [ ] **C4 — tests** : carte `pending` issue de la séance S ; `deleteWorkout(S)` → `superseded` ;
  `saveArchivedWorkout` sur S (une charge corrigée) → `superseded`. Une carte issue d'une **autre** séance
  du même exercice n'est pas touchée.
- [ ] **C4 — code** : `deleteWorkout` et `saveArchivedWorkout` appellent
  `retirePendingRecommendationsFrom` dans leur transaction.
- [ ] Vérifier : les fichiers de test touchés, plus `src/data/repositories/coachEvaluate.test.ts`.
- [ ] Commit : `fix(coach): une séance abandonnée, supprimée ou corrigée ne laisse plus de carte fausse`

### Groupe G6 — Parcours E2E

**Fichiers :** `e2e/` (suivre le parcours du coach existant : `grep -rl -i coach e2e`).

- [ ] « Appliquer » avec un échauffement : la série d'échauffement garde sa charge, les séries de travail
  prennent celle de la carte.
- [ ] « Ignorer » : la carte disparaît et ne revient pas à la séance suivante de l'exercice.
- [ ] Vérifier : `npx playwright test <fichier> --trace off` (le build d'abord : `npm run build`).
- [ ] Commit : `test(e2e): « Appliquer » sous un échauffement, et « Ignorer »`

---

## Fin (agent principal)

- [ ] `npm run typecheck && npm run lint && npm run test:run && npm run build && npm run test:e2e`
- [ ] Amender R5 dans `docs/design/specs/2026-10-04-coach-v2-design.md` (14 jours civils, strict).
- [ ] `PROGRESS.md`, `docs/progress/decisions-et-pieges.md` (choix de l'agent + dette : pas de rattrapage
  au démarrage, validation de sauvegarde en attente de la synchro), `docs/recette-telephone.md`.
- [ ] Pousser `ccr-b3ae37ca-mh5kh3`. Pas de fusion, pas de release.
