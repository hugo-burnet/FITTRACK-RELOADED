# Benchmark — plan d'implémentation

> Steps use checkbox (`- [ ]`) syntax for tracking. Toutes les cases sont cochées : ce plan est le
> compte rendu d'une exécution, écrit au fil de l'eau.

**Goal :** une séance d'une série menée à l'échec par exercice, dont le bilan propose les charges de travail de
la routine (« ça nous calibre notre coach »).

**Architecture :** une logique pure (`lib/benchmark.ts`), un dépôt (`repositories/benchmark.ts`) qui apporte les
enregistrements et réutilise le chemin d'écriture de la revue des cibles, un marqueur `Workout.kind` lu par les
dépôts qui *prescrivent* (`workoutKinds.ts`), des écrans qui ne lisent que ces dépôts.

**Tech Stack :** TypeScript strict, Dexie, Vitest, Testing Library, Playwright. Aucune dépendance nouvelle,
aucune version de schéma.

**Spec :** `docs/design/specs/2026-10-15-benchmark-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français** dans `src/i18n/fr.ts` (espace de noms `benchmark`,
  vérifié libre avant d'être ouvert).
- `lib/` reste pur : ni Dexie, ni `Date.now()`.
- Une séance de benchmark suit le chemin d'une séance ordinaire : écriture à chaque ✓, reprise après un kill.
- Rien n'est écrit dans la routine sans acceptation.
- TDD : chaque test est vu rouge avant le code qui le fait passer ; chaque garde a été retirée une fois.

---

### Tâche 1 — la logique pure

**Files :** Create `src/lib/benchmark.ts` (+ test) ; Modify `src/lib/oneRepMax.ts` (exporte le domaine).

- [x] `loadForReps` : l'inverse exact des trois formules, aller-retour testé pour 1 à 12 répétitions.
- [x] `referenceReps` : bas de fourchette + 2, plafonné à 12, 8 par défaut. *(remplacé par `capacityForSets`, tâche 8)*
- [x] `floorLoad` : vers le bas, sur la grille du matériel ou à partir de la charge essayée.
- [x] `benchmarkLine` : meilleure série, verdicts (`calibrated`, `too_light`, `no_load`, `recorded`, `skipped`),
      proposition qui décale toutes les séries de travail et préserve une pyramide.
- [x] Douze mutations, douze tuées.

### Tâche 2 — le marqueur et le dépôt

**Files :** Modify `src/data/types.ts`, `src/lib/backup/validate.ts` (+ test), `src/test/factories.ts` ; Create
`src/data/repositories/benchmark.ts`, `workoutKinds.ts` (+ tests).

- [x] `Workout.kind?: 'benchmark'`, validé par la sauvegarde.
- [x] `startBenchmarkFromRoutine` : une série `failure` par exercice, sans cible de répétitions ni de RPE, sans
      emprunter la charge d'un échauffement ; refuse une séance déjà ouverte et une routine vide.
- [x] `loadBenchmarkReport` : rapprochement par (exercice, rang), routine supprimée, formule des réglages.
- [x] `applyBenchmarkProposals` : n'écrit que si la série de référence porte encore ce que le bilan a lu ; compte
      des exercices.

### Tâche 3 — ce qu'un benchmark ne nourrit pas

**Files :** Modify `workoutHistory.ts`, `coachEvaluate.ts`, `lib/coach/backupLines.ts`, `routineTargetReview.ts`,
`home.ts` ; Create `benchmarkExclusion.test.ts`.

- [x] Valeurs fantômes (lecture par pages, hors benchmarks), historique du coach, rejeu de sauvegarde,
      évaluation et suivi d'objectifs, revue des cibles (deux fenêtres), rotation de la routine suggérée.
- [x] Ce qu'il nourrit encore : un jour d'entraînement compte.
- [x] Chaque garde retirée : chacune fait échouer un test.

### Tâche 4 — les écrans

**Files :** Create `src/features/benchmark/*` ; Modify `RoutinesScreen.tsx`, `WorkoutScreen.tsx`,
`WorkoutFinishScreen.tsx`, `HistoryDetailScreen.tsx`, `src/router.tsx`, `src/i18n/fr.ts`.

- [x] Le menu de la routine et la feuille d'explication.
- [x] Le rappel en tête de la séance, la note de fin de séance, la sortie vers le bilan, pas de voix.
- [x] `BenchmarkScreen` : cartes par exercice, interrupteurs, « Appliquer à la routine », retour selon
      l'origine.
- [x] Le lien depuis la fiche d'historique.

### Tâche 5 — la preuve dans un navigateur

**Files :** Create `e2e/benchmark.spec.ts`.

- [x] D'une routine au bilan, puis à la séance suivante (100 kg × 9 → 130 → 105 kg ; « Précédent » vide).
- [x] Cibles de 48 px, pas de débordement à 200 % de police.
- [x] Le benchmark survit à un rechargement.

### Tâche 6 — la documentation

- [x] Spec, décisions et pièges, inventaire, recette téléphone, `PROGRESS.md`.

### Tâche 7 — reprise : la fourchette, le coach, la coche (après la v2.12.2)

**Files :** Modify `src/lib/benchmark.ts` (+ test), `src/data/repositories/benchmark.ts` (+ test), `coachEvaluate.ts`,
`src/features/benchmark/*`, `src/features/workout/{WorkoutSetRow,WorkoutExerciseCard,WorkoutScreen,coachCopy,workoutRecapVoice}.ts(x)`,
`src/lib/coach/{constants,situation}.ts`, `src/data/types.ts`, `src/lib/backup/validate.ts`, `src/i18n/fr.ts`, `e2e/benchmark.spec.ts`.

- [x] La fourchette : `repZone`, référence = bas + 2 sans plafond à 12, Epley seul de 1 à 30 répétitions, « trop léger » au-delà de 30 ;
      un 15 – 20, un 20, un 18 testés.
- [x] L'estimation approximative (plus de six répétitions de la référence) : proposée, dite telle, interrupteur éteint, sans objectif.
- [x] Le coach lit le benchmark : `benchmark_calibrated` (type, validateur, gravité, situation, texte, voix muette), `recordBenchmarkObjectives`
      appelée par `finalizeCoachForWorkout`, objectifs résolus à l'acceptation (suivi / remplacé).
- [x] Les `amrap` : les répétitions d'une série de benchmark ne sont jamais proposées (ligne, carte, écran).
- [x] E2E : un exercice avec historique (« Précédent » offert, coche fermée sans répétitions), le coach qui lit le benchmark, la fourchette
      sur le bilan. Vus rouges quand la garde est retirée.

### Tâche 8 — la charge qui tient les séries (reprise après la tâche 7)

**Files :** Create `src/lib/benchmarkModel.ts`, `src/lib/exerciseClass.ts` (+ tests) ; Modify `src/lib/benchmark.ts` (+ test),
`src/data/repositories/benchmark.ts` (+ test), `src/features/benchmark/{BenchmarkLineCard,benchmarkText}.ts(x)`,
`src/features/workout/coachCopy.ts`, `src/i18n/fr.ts`, `e2e/benchmark.spec.ts`.

- [x] `exerciseClass` : polyarticulaire ou isolation, lu sur `movementPattern` (tout le catalogue rangé), par les muscles pour « autre »
      ou une famille absente, polyarticulaire sans rien savoir.
- [x] Le modèle (`benchmarkModel`) : `setFatigue` (10 % / 8 %, facteur de repos borné), `plannedSets` (séries de travail, six au plus,
      pyramide = une, 3 / 2 par défaut), `capacityForSets` (`(bas + 2) / (1 − φ)^(x − 1)`, plafonnée à 30), `loadForReps` qui accepte une
      capacité non entière. Valeurs de référence calculées à part, dans un script Python écrit hors du dépôt.
- [x] `benchmarkLine` : repos et classe en entrée, `plannedSets` et capacité en sortie, « approximatif » jugé sur la capacité ; le signal du
      coach porte `planned_sets` et `reference_reps`.
- [x] Le dépôt donne à la ligne le repos de la séance et la classe de l'exercice ; le bilan dit « Pour 3 séries : … », le coach « Pour 3 séries
      de 8 – 12 reps, démarre à … kg ».
- [x] E2E : 5×5 — A, squat 100 kg × 9 → 130 → **95 kg** sur cinq séries (et non plus 105 kg).
- [x] Trente-deux mutations, trente-deux tuées (une a survécu à un test de pyramide à trois charges : un cas à deux charges l'a tuée).
- [x] Le module a été coupé en deux (`benchmarkModel` / `benchmark`) : il faisait le modèle et la lecture à la fois.

### Tâche 9 — les défauts de la revue, puis le style du benchmark (reprise après la v2.13.1)

**Files :** Modify `src/data/types.ts`, `src/lib/backup/validate.ts` (+ test), `src/lib/exerciseReplacement.ts` (+ test), `src/lib/benchmarkModel.ts`,
`src/lib/benchmark.ts` (+ tests), `src/data/repositories/{benchmark,history}.ts`, `src/features/benchmark/*`, `src/features/workout/{useActiveWorkout,WorkoutScreen}.ts(x)`,
`src/features/programs/ProgramDetailScreen.tsx`, `src/i18n/fr.ts`, `e2e/benchmark.spec.ts` ; Create `src/test/routineSeed.ts`,
`src/data/repositories/{benchmarkRoutineLink,benchmarkSessionSets,benchmarkGoal}.test.ts`, `src/features/benchmark/{ProgramBenchmarkCard,BenchmarkLaunchSheet}.tsx` (+ tests).

- [x] Le lien stable séance ↔ routine (`WorkoutExercise.routineExerciseId`) : le rang cassait dès qu'on retirait, déplaçait ou remplaçait un exercice, et
      à l'édition de l'historique. Cinq cas rouges avant le code (déplacé, retiré, doublon croisé, historique, objectif du coach) ; remplacement et
      anciennes séances gardés.
- [x] Un échauffement n'est pas l'essai ; une dégressive ne compte pas et ne fait pas une pyramide (rouges avant le code).
- [x] Pas de carte du coach pendant un benchmark (test d'écran rouge avant le code, avec l'attente que la requête vive se pose).
- [x] La pyramide se dimensionne série par série, l'écart le plus prudent ; la charge conseillée est celle de la série la plus lourde ; pas d'objectif
      du coach pour une pyramide. Valeurs de référence calculées à part (script Python hors du dépôt).
- [x] Le style (`Workout.benchmarkGoal`, `BENCHMARK_GOALS`, `goalZone`) : sa fourchette remplace celle de la routine ; `repsHeldAt` dit ce que chaque série
      tient à fond ; l'acceptation écrit la charge et la fourchette (jamais sur l'échauffement ni sur une dégressive), sous la même garde d'ancre.
- [x] Le bilan périmé (`routineChanged`, posé par le dépôt) : interrupteur éteint d'office, avec sa phrase.
- [x] La feuille de lancement avec le choix du style, le rappel en tête de séance, le nom de la séance qui dit le style, le bilan en mots simples.
- [x] La porte du programme (« Calibrer les charges », une ligne par routine du bloc).
- [x] E2E : le style léger de bout en bout (40 × 18 → 37,5 kg, routine réécrite, séance suivante), cibles de 48 px et pas de débordement à 200 %.

### Tâche 10 — très au-dessus de la fourchette : le coach remet dedans (suite de la v2.14.0)

**Files :** Modify `src/lib/benchmarkModel.ts` (`floorLoad` déplacé ici, `loadForRange`, `BENCHMARK_MAX_JUMP`), `src/lib/benchmark.ts` (+ test),
`src/lib/coach/rules/range.ts` (+ test), `src/features/benchmark/{benchmarkText,BenchmarkLineCard}.ts(x)`, `src/features/workout/coachCopy.ts`, `src/i18n/fr.ts`.

- [x] `loadForRange` : le calcul de charge partagé entre le bilan et le coach (valeurs de référence calculées à part en Python).
- [x] « Approximatif » au-dessus de la capacité exigée : le saut de charge (30 %) et non l'écart de répétitions ; 27 à 30 reps en léger sont cochées et
      lues par le coach.
- [x] Plus de 30 répétitions : un minimum (« au moins 45 kg »), sans « tu tiendras » ; le verdict « trop léger » devient `unreadable` (répétitions
      décimales — le message « plus de 30 » y était faux).
- [x] Coach, règle de fourchette : quand un cran ne suffit pas à repasser sous le plafond, la charge qui remet dans la fourchette (RPE compté, plafond
      de 30 %, rien pour une pyramide, une cible unique, un lest, un effort maximal, une reprise). Un test existant du dépôt du coach (100 × 12 sur un
      5 – 12) a fait ajouter le garde-fou « seulement si un cran ne suffit pas ».
- [x] Carte du coach : « Tu es allé jusqu'à 30 reps : à 45 kg, tu retombes dans la fourchette (15 – 20 reps). » ; « un max d'au moins 80 kg » pour un plancher.

## Ce qui reste, et pourquoi

- La fourchette n'est pas affichée sur la ligne de série pendant le benchmark (spec §« Ce qui n'est pas fait »).
- Le bilan n'est pas dans la matrice de mise en page des trois thèmes : sa route porte un identifiant de
  séance qu'un test générique ne connaît pas. Il est vérifié en thème sombre à 100 et 200 % dans son propre
  parcours ; TTY1 et le thème clair restent à l'œil, sur le téléphone.
- La réserve de 2, la fatigue par série (10 % / 8 %), ses bornes de repos, le plafond de six séries, les séries par défaut (3 / 2), la
  limite de 30 répétitions et les trois fourchettes des styles (15 – 20, 8 – 12, 5 – 8 : celles de l'utilisateur) sont des constantes à juger à l'usage, toutes dans
  `benchmarkModel.ts`.
- Le coach ne propose pas le nombre de séries : il dimensionne la charge sur celles de la routine (question posée à l'utilisateur).
