# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-10-15 — **v2.13.1 publiée** (PWA et APK) : le « ? » du bilan du benchmark n'explique plus l'accueil ;
la v2.13.0 avait fait lire au benchmark la fourchette et les séries de chaque exercice, et au coach le benchmark.
**Non publié, sur la branche `ccr-a1ec0e4b-s9kwdx`** : le benchmark a un style (léger, classique, force), six défauts relevés par une revue de code sont
corrigés, la fiche d'un programme propose « Calibrer les charges ».

## Où on en est

- **Non publié — branche `ccr-a1ec0e4b-s9kwdx`** (`git log 10f08c9..`), **pas fusionnée dans `master`**, à la demande de l'utilisateur :
  « tu as fait 40×18, je te propose … trois fois ; en classique 8-12 … ; la force, je connais pas ; on peut avoir l'option ; c'est pertinent pour
  commencer les programmes ; à toi de définir les calculs ». **Le style** (`Workout.benchmarkGoal`) : classique 8 – 12, léger 15 – 20, force 3 – 5, ou
  « Comme ma routine » (d'office, le benchmark d'avant) ; sa fourchette remplace celle de la routine pour dimensionner la charge, et accepter le bilan
  écrit la charge **et** la fourchette. Le bilan se lit en une phrase (« 52,5 kg pour 3 séries de 8 – 12 reps ») puis « tu tiendras environ 13 · 11 · 10
  reps à fond ». **Six défauts d'une revue de code**, reproduits puis corrigés : le bilan retrouvait sa ligne de routine par le rang (cassé dès qu'on
  retire ou déplace un exercice, ou qu'on corrige l'historique) — il le fait maintenant par un lien posé au lancement ; un vieux bilan réécrivait une
  routine qui avait progressé (90 → 72,5) — interrupteur éteint d'office ; une pyramide ascendante montait son sommet à 94 % du max ; une dégressive
  faisait une « pyramide » ; un échauffement coché devenait l'essai ; la carte du coach restait proposée pendant un benchmark. Le coach ne pose pas
  d'objectif pour une pyramide. Détail et choix à relire : `docs/progress/decisions-et-pieges.md` (entrée « revue de code, puis les styles »), spec
  §3 bis, recette §3 ter. **Pour publier** : fusionner `--no-ff` dans `master` puis la voie de release ci-dessous — sur demande explicite.
- **Publié : v2.13.1** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.13.1), APK `FitTrack-v2.13.1.apk`
  signé avec la clé de release ([journal](docs/journal/2026-10-15-versions-v2-13.md)). Le « ? » de l'écran de bilan du benchmark proposait
  « Expliquer cette page : Accueil » (route inconnue du didacticiel, depuis la v2.12.0) : il n'y est plus (`showTutorialHelp={false}`), et un
  test garde toutes les routes contre ce piège (`tutorialRoutes.test.ts`). Rien d'autre ne change dans l'application.
- **Avant : v2.13.0** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.13.0), APK `FitTrack-v2.13.0.apk`.
  Le benchmark repris, à la demande de l'utilisateur : il lit la fourchette de chaque exercice (Epley, 1 à 30 répétitions) et propose la
  charge qui **tient toutes les séries de la routine** (la dernière garde deux répétitions en réserve ; fatigue de 10 % par série, 8 % pour une
  isolation, plus haute quand le repos est court — des chiffres **au pif**, `lib/benchmarkModel.ts`) ; le coach le lit (`benchmark_calibrated`) et
  accepter le bilan suit son objectif ; la coche ne propose plus les répétitions de la dernière fois comme maximum ; la feuille de saisie des
  mensurations ne reprend plus le brouillon d'avant. Le coach n'écrit jamais un nombre de séries (tranché : R6 s'en charge). Le détail, la
  voie de la publication et ses vérifications : [`docs/journal/2026-10-15-versions-v2-13.md`](docs/journal/2026-10-15-versions-v2-13.md) ;
  les choix à relire : `docs/progress/decisions-et-pieges.md`, entrées du 2026-10-15.
- **Avant : v2.12.0 → v2.12.2** — la coche qui n'écrase plus la saisie, le coach R6 (volume par muscle), le benchmark (puis sa porte dans
  l'éditeur de la routine, puis le remplacement de l'objectif de charge du coach), les mensurations, « Remplacer l'exercice », le rappel de
  sauvegarde, l'E2E commité. Le détail des trois versions, la voie de la publication et ses vérifications :
  [`docs/journal/2026-10-15-versions-v2-12.md`](docs/journal/2026-10-15-versions-v2-12.md).
- **Portes** : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 694 tests**, 307 fichiers, 1 ignoré), `build` et `test:e2e`
  (**36 parcours**, 8 fichiers, à 390 px) — verts sur la branche `ccr-a1ec0e4b-s9kwdx` ; `master` à la v2.13.1 : 3 608 tests, 35 parcours.
- **Branches distantes.** `ccr-57f17af8-maxzqv`, fusionnée, est à supprimer à la main (`ccr-449df1c1-etmya3` l'a été) : le refus de
  supprimer une branche distante vaut toujours pour une session d'agent. **Garder les trois `archive/*`** : `make-fragments.mjs` lit
  `archive/fittrack-kb-corpus`.
- **Pour publier la suivante** : `chore: prepare release vX.Y.Z` (`package.json` et son lock), `master` poussé sans force, puis le
  `workflow_dispatch` d'`android.yml` avec `release_tag`. **Un commit poussé pendant un déploiement annule celui-ci** (groupe `pages`) :
  pousser les commits de documentation avant de lancer la release, ou accepter le déploiement du suivant.

## À juger sur le terrain (v2.12.0 → v2.13.1, puis la branche non publiée)

- **Benchmark, les styles** : les trois fourchettes (15 – 20, 8 – 12, 3 – 5, `GOAL_ZONES`) et les essais conseillés (18, 12, 6) sont des choix de
  produit. **« 40 × 14 » de la demande est ce que donnerait un léger à 12 – 15** (40 kg, on tient 18 · 16 · 14) ; à 15 – 20 le bilan propose 37,5 kg. La
  force est le style que l'utilisateur connaît le moins. Si les charges paraissent trop basses, c'est la réserve (ci-dessous), un seul chiffre.
- **Benchmark** : la réserve de 2 répétitions, la fatigue par série (10 % / 8 %), ses bornes de repos, le plafond de six séries, les
  séries par défaut (3 / 2) et la limite de 30 répétitions sont des constantes (`lib/benchmarkModel.ts`) ; si les charges proposées
  paraissent trop basses ou trop hautes, c'est là. Le test sur le terrain : trois séries à la charge conseillée doivent laisser environ
  deux répétitions en réserve à la dernière.
- **Coach R6** : le plafond ne change presque rien tant qu'on ne le relève pas — c'est la décision, pas un défaut (`effectiveCeiling`,
  un seul endroit).
- **L'E2E des mensurations qui bloquait** (`corriger puis supprimer une mesure`, délai de 60 s) : **expliqué et corrigé à la v2.13.0**. Une
  feuille de saisie rouverte dans les 250 ms de sa sortie reprenait le brouillon — la date — de la précédente, et écrasait une mesure en
  silence ; une clé par ouverture, un test. `VolumeBoundsSheet` a le même motif, **non corrigé** (aucun échec observé) ; les autres feuilles
  ne sont pas auditées (`docs/progress/decisions-et-pieges.md`, entrée « la feuille de saisie des mensurations »).
- **Coach sur l'historique réel** : non rejoué, la sauvegarde n'est pas dans le dépôt (`npm run coach:replay`).

## Ce qui reste

### Coach : quatre écarts de l'audit du 13 octobre, spec à rouvrir avant tout code

Les deux autres (cible unique, blocs entrelacés) sont corrigés ci-dessus. Ceux-ci sont des **choix de
règle**, pas des défauts, et demandent l'historique réel pour être jugés (`coach:replay`) :

- le seuil de 14 jours est un couperet pour un exercice fait tous les 14 jours ;
- une baisse nette s'appelle « plateau » (la règle demande l'absence de progrès, pas l'absence de baisse) ;
- une seule série à −1 rep deux séances de suite suffit à `range_missed` ;
- la moyenne du RPE dilue la dernière série.

### Décisions qui attendent l'utilisateur

- **Le wiki et le corpus** (`fittrack-kb-contract`, 9 Mo ; ~1,8 Mo de JSON embarqués ; le `prebuild`
  dépend de `kb:check-articles`) sont la plus grosse surface de maintenance hors du cœur de l'app : les
  faire vivre, ou les figer.
- **Unités kg/lb (RF-50)** : jamais livrées, malgré le checkpoint du Lot 8. Décision prise en autonomie le
  2026-10-14 : **hors périmètre** (utilisateur en kg), consignée dans la roadmap. À rouvrir au besoin.
- **TTY1 à 200 % de police** : la barre du bas déborde (police bitmap à tailles fixes). Non corrigé, non testé.
- **Export automatique** sans geste : il faudrait un plugin SAF et un essai sur téléphone.
- **Capacitor 8.5.2** et la suite : avec un checkpoint (icône, barres du système, bas de l'écran de séance).

### Lacunes connues

- **Couverture du corpus éditorial.** Aucun article ne couvre les muscles `neck`, `full_body`,
  `cardio` et `other`, ni la famille de mouvement `autre`. Conséquence mesurée sur le
  catalogue : 4 exercices ne projettent aucun article (flexion de nuque, étirements,
  mobilité, rouleau de massage) et 7 n'en projettent qu'un (crunchs, extensions de nuque,
  corde à sauter). Un seul groupe musculaire porte un article **propre à ses exercices** —
  le triceps, via `exercise-triceps-extensions` déclaré sur 8 slugs. Combler cela demande de
  rédiger des articles sourcés dans `fittrack-kb-contract/editorial/articles/`, pas de
  toucher à l'app : le validateur exige des `claimId` réels, et l'écran a pour règle de
  montrer la lacune plutôt que de la deviner.

## Checkpoints téléphone

**Rien n'est validé à ce jour.** La liste complète, dédoublonnée et rangée par endroit, est dans
[`docs/recette-telephone.md`](docs/recette-telephone.md) : une passe d'une trentaine de minutes, avec le
résultat attendu de chaque ligne. L'ancienne liste figure en bas de l'archive de la v2.

## Archives de progression

| Fichier | Contenu |
| --- | --- |
| [2026-10-15-versions-v2-13.md](docs/journal/2026-10-15-versions-v2-13.md) | Versions v2.13.0 et v2.13.1 (2026-10-15) |
| [2026-10-15-versions-v2-12.md](docs/journal/2026-10-15-versions-v2-12.md) | Versions v2.12.0 à v2.12.2 (2026-10-14 → 2026-10-15) |
| [2026-10-14-versions-v2.md](docs/journal/2026-10-14-versions-v2.md) | Versions v2.4 à v2.11.1 (2026-08-29 → 2026-10-13) |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
