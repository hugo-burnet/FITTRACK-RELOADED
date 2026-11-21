# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-11-21 — **v3.0.1**, le repos sur une rangée ([journal](docs/journal/2026-11-21-versions-v3-0-1.md)) ; avant, la v3.0.0, la refonte par objets.

## Où on en est

- **Publié : v3.0.1** ([journal](docs/journal/2026-11-21-versions-v3-0-1.md)) : en séance, le repos tient sur une
  rangée et « Terminer la séance » s'efface pendant un repos (le bas de l'écran passe de 230 à 126 px). **Dû** : recette,
  section « Mise à jour v3.0.1 ».
- **Avant : v3.0.0** ([journal](docs/journal/2026-11-21-versions-v3-0-0.md)) : une page par objet (exercice, séance
  passée, programme), Progression en tableau de bord de tuiles, records en cours, accueil jamais sans « Démarrer » et
  séance libre, « programme » partout, grille modulaire et finition des quatre thèmes. **Dû** : la recette, section
  « Mise à jour v3.0.0 » — à cocher sur le téléphone : https://claude.ai/artifact/QtYMeWrAWLWPLE2CQMLXxU (les coches et
  les notes s'y lisent ; « Problème » = à corriger).
- **Reste de la v3** : les pages **Muscle** et **Semaine** (cartographie §5.3, §5.4), qui attendent la décision de
  l'utilisateur sur le volume par muscle (séries directes ou secondaires pondérés ; semaine civile ou 7 jours glissants).
  Le **lot F du coach** (signaler une gêne) attend la sauvegarde JSON pour `npm run coach:replay`. Petites suites de la
  relecture et de la finition, non faites : à 200 %, le nom d'exercice en séance reste serré (chrono et chevron à côté) ;
  « PRÉCÉDENT / kg » de la séance à 200 % ; le lien « Voir la fiche » de la vue plein écran d'un exercice empile un écran.
  Un échec sur ~85 passages sous charge dans un test de cadence reste sans cause (rien de contourné). Le commit `5d51e05`
  porte le message « x » (correctif de l'accueil, réécriture d'historique refusée).
- **Piège des agents en parallèle** : arbres isolés = références git partagées (un nom de branche par agent) **et** port
  4173 partagé par l'E2E (`reuseExistingServer`) — un agent peut tester le build d'un autre. Un E2E d'agent se lance sur
  une copie de config avec un autre port ; la passe finale se refait à la main sur la branche fusionnée.
- **Avant : v2.19.0** ([journal](docs/journal/2026-11-21-versions-v2-19-0.md)) : RPE 8,5, Réglages en sommaire, tutoriel
  supprimé, sept correctifs.
- **Avant : v2.18.0**, le coach fiabilisé ([journal](docs/journal/2026-11-20-versions-v2-18-0.md)). Audit en trois passes, puis une
  trentaine de défauts corrigés test d'abord : fin de séance qui ne casse plus et s'enregistre d'un bloc, « Appliquer » qui n'écrit que
  les séries de travail, refus de 14 jours, plus de carte fausse après une séance allégée, abandonnée, supprimée ou corrigée, série
  ajoutée et double progression lues juste, reprise en jours civils. Choix de l'agent à relire : `decisions-et-pieges.md` (2026-11-20).
  Fusion `5e6c03a`. **Dû** : recette § 2, lignes *(v2.18.0)*. **Reste** : le lot F (RPE et sauts de charge) — il faut la sauvegarde
  JSON pour `npm run coach:replay` ; le CSV montre un yo-yo de charge, sans dire si le coach le proposait.
- **CI E2E** : `ubuntu-latest` est passé à 26.04, que Playwright 1.56 ne sait pas équiper ; job épinglé sur `ubuntu-24.04` (`ac5d52f`).
  **Branche de synchro** `ccr-homelab-sync-20261108` (16 commits, attend Caddy) : non touchée ; elle réécrit `validate.ts`, où attend
  la validation stricte des recommandations restaurées.

- **Avant : v2.17.5**, à la demande de l'utilisateur (« Merge push et versionne ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.17.5), APK `FitTrack-v2.17.5.apk`
  ([journal](docs/journal/2026-11-06-versions-v2-17-5.md)). Thème Cyber : au −15 s, la barre de repos encaisse comme une barre de vie
  — la vie chute, le morceau perdu flashe blanc puis rouge et se vide ; deux −15 rapprochés s'additionnent. Fusion `4f4fd17`, quatre
  workflows verts. **Dû** : recette § 6, « La barre de vie prend des dégâts ».

- **Avant : v2.17.4 — à la demande du propriétaire.** Correction de compilation Windows,
  fondations backend et export SQLite, documentation et CI backend. Aucun
  parcours de synchronisation livré dans l'APK. Voir
  [le journal](docs/journal/2026-11-06-versions-v2-17-4.md). La recette téléphone
  « Mise à jour v2.17.4 » reste due ; installer par-dessus, sans désinstaller.
  Les 43 parcours Chromium passent sur le build v2.17.4, ainsi que typecheck,
  lint et build ; suite frontend complète déjà vérifiée (3 862 réussites, un ignoré).
  Fusion `c81a07e` sur `master`, tag `v2.17.4` sur ce même commit. Les quatre
  workflows du push sont verts ; les **34 tests backend passent sous Linux sans
  exclusion**. Le [workflow du tag](https://github.com/hugo-burnet/FITTRACK-RELOADED/actions/runs/42277283282)
  a publié `FitTrack-v2.17.4.apk` (11 193 980 octets) et Pages est déployé.
  SHA-256 de l'APK fourni par GitHub :
  `648c08c377e23761c07453fb96be22b51b30d040037b39af610497a7b9312795`.

- **Export backend cohérent ajouté, local seulement.** `backup_sync` exporte par
  l'API SQLite les écritures validées (WAL compris), vérifie l'intégrité et écrit
  un manifeste avec empreinte, sans secret ni configuration de génération
  restaurable. Destination neuve obligatoire, permissions privées POSIX,
  synchronisation des fichiers et dossiers avant succès. **34 tests backend
  exécutés sous Windows : 32 réussis, deux contrôles POSIX ignorés** ; les sept
  tests d'export sous Linux donnent six réussites, seule l'intégration Django
  étant ignorée dans cet environnement sans Django. Relecture indépendante :
  correction de la synchronisation du dossier parent. Ni planification serveur
  ni restauration opérable livrées. Voir `backend/README.md`.

- **En préparation, non déployé — backend homelab multi-utilisateur.** Demande : héberger les sites et leurs backends sur le homelab, avec synchronisation APK/PC et comptes distincts accessibles depuis Internet sans VPN. Priorité à l’isolation de la connexion domestique. Première tranche locale `backend/` : persistance par compte, révisions atomiques SQLite, idempotence, génération des sessions et configuration fermée par défaut ; **27 tests Django passent**, dépendances verrouillées avec empreintes. La relecture indépendante a fait corriger un dossier de données implicite. Voir `backend/README.md` et `docs/design/plans/2026-11-06-sync-backend.md`. **Pas déployable publiquement** : connexion/inscriptions/invitations/MFA/récupération, limites d’abus/stockage, restauration opérable, client web et pont Android restent à livrer. La v2.17.4 ne livre pas encore de synchronisation dans l’APK.
- **Compatibilité Windows corrigée.** `cyberGlitch.ts` devient `cyberGlitchRules.ts` : sous Windows l’import du composant `CyberGlitch.tsx` se résolvait sur le module `.ts` dont le nom ne différait que par la casse. Typecheck, build, lint et sept tests ciblés passent. Le lint exclut les seuls environnements Python installés `backend/.venv*/**` pour ne pas analyser le JavaScript tiers de Django. Suite complète vérifiée avec `npm run test:run -- --pool=threads --maxWorkers=1` : **3 862 tests passent, un ignoré ; 319 fichiers passent, un ignoré** (651,74 s). Le premier passage concurrent avec le build avait échoué sur deux tests de cadence, ensuite verts seuls, dans leur fichier complet et dans cette suite complète ; aucune assertion ni logique de séance n’a été modifiée.
- **Avant : v2.17.3**, à la demande de l'utilisateur (« Publie ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.17.3), APK `FitTrack-v2.17.3.apk`
  ([journal](docs/journal/2026-11-02-versions-v2-17-3.md)). Le nom de l'écran en typographie cinétique est retiré (« l'écriture
  n'apporte rien ») ; le contenu reprend toute la largeur. **Dû** : la recette § 6.
- **Avant : v2.17.2**, à la demande de l'utilisateur (« Merge, push et versionne ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.17.2), APK `FitTrack-v2.17.2.apk`
  ([journal](docs/journal/2026-11-02-versions-v2-17-2.md)). Le nom de l'écran dans une colonne de 34 px au bord droit (ni devant ni
  derrière le contenu) ; le bouton principal sans hachure dès 130 % de police. **Dû** : la recette § 6.
- **Avant : v2.17.1**, à la demande de l'utilisateur (« Merge, push, versionne ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.17.1), APK `FitTrack-v2.17.1.apk`
  ([journal](docs/journal/2026-11-01-versions-v2-17-1.md)). Ses retours sur la v2.17.0 : l'impact à **chaque** validation ; la perte en
  barres qui s'évaporent (repos) et en lambeaux (compteur) ; le filigrane cinétique en arrière-plan derrière des plaques translucides ;
  « Exporter » ; et la fluidité — la barre de repos anime un `scaleX`, tous thèmes, Cyber au niveau de Sombre. **Dû** : la recette § 6.
- **Avant : v2.17.0**, à la demande de l'utilisateur (« Fusionne dans master et publie une nouvelle version ») :
  [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.17.0), APK `FitTrack-v2.17.0.apk`
  ([journal](docs/journal/2026-11-01-versions-v2-17.md)). **Le thème Cyber** (Réglages › Apparence) : la grammaire visuelle de Cyberpunk 2077
  sans ses marques — coche percutante, barres de vie, glitchs, police Cyber Sans, fonds de grille et de halos. **−15 s / +15 s** pendant le repos,
  pour tous les thèmes. Publiée par le `workflow_dispatch` d'`android.yml` (`release_tag`), après les trois workflows verts sur la fusion `c3db3e5`.
  **Dû** : la recette téléphone § 6 — le son, la vibration et le ressenti de la coche ne se jugent qu'au doigt.
- **Avant : v2.16.1**, à la demande de l'utilisateur (« Fusionne dans master et publie une nouvelle version ») :
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
- **Portes** : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 865 tests**, 320 fichiers, 1 ignoré), `build` et `test:e2e`
  (**43 parcours**, 9 fichiers, à 390 px) — verts à la v2.17.1 ; la v2.16.1 : 3 794 tests, 39 parcours.
- **Branches distantes.** `ccr-8abf77c4-43lck3` (v2.17.0), `ccr-57f17af8-maxzqv` et `ccr-a1ec0e4b-s9kwdx` (v2.14.0 à v2.16.0), fusionnées, sont à supprimer à la main
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

- ~~le seuil de 14 jours est un couperet pour un exercice fait tous les 14 jours~~ : réglé le 2026-11-20 (strictement plus de 14 jours civils) ;
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
| [2026-11-21-versions-v3-0-1.md](docs/journal/2026-11-21-versions-v3-0-1.md) | Version v3.0.1 (2026-11-21) |
| [2026-11-21-versions-v3-0-0.md](docs/journal/2026-11-21-versions-v3-0-0.md) | Version v3.0.0 (2026-11-21) |
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
