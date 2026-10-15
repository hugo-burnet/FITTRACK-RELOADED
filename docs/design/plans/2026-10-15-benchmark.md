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
- [x] `referenceReps` : bas de fourchette + 2, plafonné à 12, 8 par défaut.
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

## Ce qui reste, et pourquoi

- La fourchette n'est pas affichée sur la ligne de série pendant le benchmark (spec §« Ce qui n'est pas fait »).
- Le bilan n'est pas dans la matrice de mise en page des trois thèmes : sa route porte un identifiant de
  séance qu'un test générique ne connaît pas. Il est vérifié en thème sombre à 100 et 200 % dans son propre
  parcours ; TTY1 et le thème clair restent à l'œil, sur le téléphone.
- Le seuil « 12 répétitions » et la réserve de 2 sont des constantes à juger à l'usage.
