# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-10-25 — **v2.16.1 publiée** (PWA et APK) : le coach propose le cran trop gros au lieu de 60 répétitions, et ne
laisse plus de carte « Reprise » périmée.
La v2.16.0 avait ajouté un pas de charge pour toute l'appli (Réglages › Coach) et le coach qui remet dans la fourchette par en dessous.

## Où on en est

- **Publié : v2.16.1**, à la demande de l'utilisateur (« Fusionne dans master et publie une nouvelle version ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.16.1), APK `FitTrack-v2.16.1.apk`
  ([journal](docs/journal/2026-10-25-versions-v2-16-1.md)). **Le cran trop gros** : au-delà de 30 répétitions exigées pour l'absorber, le coach
  propose le cran et dit qu'il est gros (amendement R3 du 2026-10-25). **La carte périmée** : chaque exercice travaillé retire ses cartes en
  attente en fin de séance (`supersedePendingRecommendations`). Recette § 2. Publiée par le tag `v2.16.1` poussé depuis le poste de
  l'utilisateur (le chemin normal d'`android.yml`) ; `gh` n'y est pas installé.
- **Avant : v2.16.0**, à la demande de l'utilisateur (« fusionne et publie ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.16.0), APK `FitTrack-v2.16.0.apk`
  ([journal](docs/journal/2026-10-16-versions-v2-16.md)). Sa demande : « Oui et oui » aux deux questions qui restaient ouvertes. **Un pas de charge pour toute l'appli** :
  Réglages › Coach › « Pas de charge par défaut » (vide d'office = la table du matériel ; « 1,125 » vaut pour toute fiche sans incrément, la fiche passant avant) — lu par le
  coach, le benchmark, la revue des cibles et les programmes ; la fiche d'un exercice le montre dans son champ vide. **Le coach par en dessous** : quand le bas de la
  fourchette est manqué deux séances de suite et qu'un cran de moins ne ramène pas la pire série dedans, il enlève autant de crans qu'il en faut (40 kg, 8 · 7 · 6 sur un
  15 – 20 : 32,5 kg, pas 37,5), 30 % de moins au plus ; à une répétition du bas, un cran comme avant. Détail et choix à relire : `docs/progress/decisions-et-pieges.md`
  (entrée « Oui et oui »), amendement R3 du coach v2, recette § 3 ter.
- **Avant : v2.15.0** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.15.0), APK `FitTrack-v2.15.0.apk`
  ([journal](docs/journal/2026-10-16-versions-v2-15.md)) : au bilan du benchmark, un essai très au-dessus de la fourchette (27 à 30 reps en léger) est coché et lu par le coach,
  plus de 30 reps donnent un minimum (« au moins 47,5 kg ») ; en séance normale, le coach propose la charge qui remet dans la fourchette quand un cran ne suffit pas
  (40 kg × 30 · 28 · 26 sur un 15 – 20 : 47,5 kg) ; les propositions s'arrondissent au pas renseigné, au plus proche (35 × 20 à 1,125 : 35, et non plus 33,875).
- **Avant : v2.14.0** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.14.0), APK `FitTrack-v2.14.0.apk`
  ([journal](docs/journal/2026-10-16-versions-v2-14.md)) : le style du benchmark (`Workout.benchmarkGoal` : classique 8 – 12, léger 15 – 20, lourd 5 – 8, ou « Comme ma
  routine »), six défauts d'une revue de code corrigés (ligne de routine retrouvée par un lien posé au lancement, vieux bilan qui réécrivait une routine,
  pyramide, dégressive, échauffement coché, carte du coach pendant un benchmark), « Calibrer les charges » depuis la fiche d'un programme.
- **Avant : v2.13.0 → v2.13.1** — [v2.13.1](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.13.1) : le « ? » de l'écran de bilan du
  benchmark proposait « Expliquer cette page : Accueil » (route inconnue du didacticiel, depuis la v2.12.0) ; il n'y est plus
  (`showTutorialHelp={false}`), et un test garde toutes les routes contre ce piège (`tutorialRoutes.test.ts`).
  [v2.13.0](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.13.0) : le benchmark lit la fourchette de chaque exercice (Epley, 1 à 30
  répétitions) et propose la charge qui **tient toutes les séries de la routine** (la dernière garde deux répétitions en réserve ; fatigue de 10 % par
  série, 8 % pour une isolation, plus haute quand le repos est court — des chiffres **au pif**, `lib/benchmarkModel.ts`) ; le coach le lit
  (`benchmark_calibrated`) et accepter le bilan suit son objectif ; la coche ne propose plus les répétitions de la dernière fois comme maximum ; la
  feuille de saisie des mensurations ne reprend plus le brouillon d'avant. Le coach n'écrit jamais un nombre de séries (tranché : R6 s'en charge).
  Le détail, la voie de la publication et ses vérifications : [`docs/journal/2026-10-15-versions-v2-13.md`](docs/journal/2026-10-15-versions-v2-13.md) ;
  les choix à relire : `docs/progress/decisions-et-pieges.md`, entrées du 2026-10-15.
- **Avant : v2.12.0 → v2.12.2** — la coche qui n'écrase plus la saisie, le coach R6 (volume par muscle), le benchmark (puis sa porte dans
  l'éditeur de la routine, puis le remplacement de l'objectif de charge du coach), les mensurations, « Remplacer l'exercice », le rappel de
  sauvegarde, l'E2E commité. Le détail des trois versions, la voie de la publication et ses vérifications :
  [`docs/journal/2026-10-15-versions-v2-12.md`](docs/journal/2026-10-15-versions-v2-12.md).
- **Portes** : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 794 tests**, 307 fichiers, 1 ignoré), `build` et `test:e2e`
  (**39 parcours**, 9 fichiers, à 390 px) — verts à la v2.16.1 ; la v2.16.0 : 3 787 tests.
- **Branches distantes.** `ccr-57f17af8-maxzqv` et `ccr-a1ec0e4b-s9kwdx` (v2.14.0 à v2.16.0), fusionnées, sont à supprimer à la main
  (`ccr-449df1c1-etmya3` l'a été) : le refus de supprimer une branche distante vaut toujours pour une session d'agent. **Garder les trois `archive/*`** : `make-fragments.mjs` lit
  `archive/fittrack-kb-corpus`.
- **Pour publier la suivante** : `chore: prepare release vX.Y.Z` (`package.json` et son lock), `master` poussé sans force, puis le
  `workflow_dispatch` d'`android.yml` avec `release_tag`. **Un commit poussé pendant un déploiement annule celui-ci** (groupe `pages`) :
  pousser les commits de documentation avant de lancer la release, ou accepter le déploiement du suivant. **`git merge -F fichier`, pas `-F -`** (il ne lit
  pas l'entrée standard), et `git fetch origin master` avant de compter les commits d'avance : le `origin/master` d'un clone de session est celui du démarrage.
  **Un test qui rougit sur le push de la fusion** (v2.16.0, un test intermittent du bilan du benchmark) : chercher la cause avant de relancer, la corriger, pousser après la fin du
  déploiement, attendre les trois workflows, puis lancer la release sur le nouveau commit — le tag suit le commit construit.

## À juger sur le terrain (v2.12.0 → v2.16.0)

- **Benchmark, les styles** : les trois fourchettes (15 – 20, 8 – 12, 5 – 8, `GOAL_ZONES`) sont celles de l'utilisateur (« lourd 5 – 8, normal 8 – 12, léger
  entre 15 et 20 ») ; les essais conseillés (18, 12, 8) sont des choix de produit. **« 40 × 14 » de la demande est ce que donnerait un léger à 12 – 15**
  (40 kg, on tient 18 · 16 · 14) ; il garde 15 – 20, donc le bilan propose 37,5 kg. « Classique » garde son nom (« Normal » se lirait comme le défaut).
  Si les charges paraissent trop basses, c'est la réserve (ci-dessous), un seul chiffre.
- **Remise dans la fourchette** (`BENCHMARK_MAX_JUMP`, 30 %) : le plafond de saut, le RPE qui ajoute de la réserve à la capacité du coach. Le coach ne sait pas la classe ni le repos
  de l'exercice : polyarticulaire, deux minutes. **Par en dessous** (v2.16.0) : le moins de crans qui remet la pire série au bas, à une demi-répétition près, 30 % de moins au
  plus ; sans RPE la capacité est lue à l'échec (réserve zéro), la lecture qui allège le plus. Deux cibles différentes, voulues : au-dessus le bas de la fourchette avec réserve,
  en dessous le bas à l'échec.
- **L'arrondi au plus proche** (`roundLoad`) : une proposition peut dépasser le calcul d'un demi-pas — 0,56 kg avec un pas de 1,125, **2,5 kg sur une machine dont le pas
  n'est pas saisi** (le 5 kg du matériel). Si des charges paraissent trop hautes sur une machine, c'est le pas à saisir sur sa fiche (Incrément de charge) — ou le pas
  de toute l'appli (Réglages › Coach, v2.16.0). **Ce pas vaut aussi pour une barre ou des haltères** sans incrément saisi, où 1,125 n'existe pas : y saisir 2,5 sur la fiche.
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
| [2026-10-25-versions-v2-16-1.md](docs/journal/2026-10-25-versions-v2-16-1.md) | Version v2.16.1 (2026-10-25) |
| [2026-10-16-versions-v2-16.md](docs/journal/2026-10-16-versions-v2-16.md) | Version v2.16.0 (2026-10-16) |
| [2026-10-16-versions-v2-15.md](docs/journal/2026-10-16-versions-v2-15.md) | Version v2.15.0 (2026-10-16) |
| [2026-10-16-versions-v2-14.md](docs/journal/2026-10-16-versions-v2-14.md) | Version v2.14.0 (2026-10-16) |
| [2026-10-15-versions-v2-13.md](docs/journal/2026-10-15-versions-v2-13.md) | Versions v2.13.0 et v2.13.1 (2026-10-15) |
| [2026-10-15-versions-v2-12.md](docs/journal/2026-10-15-versions-v2-12.md) | Versions v2.12.0 à v2.12.2 (2026-10-14 → 2026-10-15) |
| [2026-10-14-versions-v2.md](docs/journal/2026-10-14-versions-v2.md) | Versions v2.4 à v2.11.1 (2026-08-29 → 2026-10-13) |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
