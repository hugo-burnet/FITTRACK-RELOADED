# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-10-15 — la branche de session `ccr-57f17af8-maxzqv` est **fusionnée dans `master`**
(`--no-ff`) ; **v2.12.0** est préparée (`package.json` à 2.12.0) et se publie par le `workflow_dispatch` d'`android.yml`
avec `release_tag`. Dernière version publiée avant elle : **v2.11.1** (2026-10-13).

## Où on en est

- **Publié : v2.11.1** (PWA et APK) ; **v2.12.0** est en cours de publication.
- **Portes**, sur `master` : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 527 tests**, 299 fichiers,
  1 ignoré), `build` et `test:e2e` (**34 parcours**, 8 fichiers, à 390 px).
- **Branches distantes.** `ccr-449df1c1-etmya3`, fusionnée, est à supprimer à la main : le refus de
  supprimer une branche distante vaut toujours pour une session d'agent. **Garder les trois
  `archive/*`** : `make-fragments.mjs` lit `archive/fittrack-kb-corpus`.

## Cette session (2026-10-14 → 2026-10-15)

Origine : une revue d'ensemble du projet (« quelles améliorations proposes-tu ? »), puis « corrige tout en
autonomie », puis une idée de l'utilisateur en cours de route : le **benchmark**. Chaque ligne est un commit de
la branche ; le raisonnement est dans `docs/progress/decisions-et-pieges.md`.

**Corrections**

- **La coche écrasait ce qu'on venait de taper.** Un poids tapé puis ✓ aussitôt pouvait être remplacé par la
  valeur proposée : l'écran passait une photo périmée à `completeSet`. Désormais la coche ne remplit que les
  cases vides de la ligne relue **dans** la transaction. Trouvé par un E2E intermittent, corrigé de façon
  déterministe.
- **Coach, cible unique.** Un 5×5 ou un 3×10 ne se voyait jamais proposer le cran : R3.2 exigeait une
  répétition de plus que la cible. Elle se tait sans fourchette. Vu dans le navigateur (« 100 → 102,5 kg »).
  **Non rejoué sur l'historique réel** — la sauvegarde n'est pas dans le dépôt : `npm run coach:replay`.
- **Coach, blocs entrelacés.** Deux blocs du même exercice repartaient de `order: 0` et se lisaient A0, B0,
  A1, B1 : un « Repos long » sur des repos de deux minutes. Rangés par l'heure de leur première série faite.
- **En-tête à 200 % de police.** Les cibles de 3 rem passaient à 96 px et repoussaient l'aide hors de l'écran.
- **Dépendances.** Production à **0 vulnérabilité** (Capacitor 8.5.1, react-router-dom 7.18.2).
  `@capacitor/assets` retiré. Trois avis modérés restent, en outil de dev. Capacitor **8.5.2 n'est pas pris**.

**Ajouts**

- **Benchmark.** Planifier › ⋯ d'une routine › « Benchmark de cette routine » : une série à l'échec par exercice,
  puis un bilan (1RM estimé, charge de travail conseillée, ce que la routine porte) qui propose d'écrire ces
  charges dans la routine — **sur acceptation**. Écarté de tout ce qui prescrit (valeurs fantômes, historique du
  coach, revue des cibles, rotation de l'accueil) ; compte pour les records, le volume et l'historique.
  `Workout.kind`, aucune version de schéma. **Réserve de 2 répétitions et limite de 12 : à juger à l'usage.**
- **Coach R6, volume par muscle.** Le coach ne propose plus d'ajouter une série à un muscle qui a déjà tenu ce
  volume ; un écran « Volume par muscle » (Réglages › Coach) pose ses bornes ; une carte d'accueil « Volume bas »
  parle d'un plancher que la personne a posé. **Le plafond ne change presque rien tant qu'on ne le relève
  pas** — c'est la décision, à juger sur le terrain (`effectiveCeiling`, un seul endroit).
- **Mensurations** (sans photos). Quinze mesures et des champs libres, saisie à n'importe quelle date, courbe à
  abscisse proportionnelle au temps ; le poids de corps est la même mesure que celui de l'accueil.
- **Remplacer l'exercice** depuis la séance en cours : la ligne change d'occupant à la même place, les séries
  déjà faites restent.
- **Rappel de sauvegarde.** Trois séances que nulle sauvegarde ne contient : une carte sous la séance à
  lancer, une ligne d'état dans Réglages, le stockage persistant demandé au démarrage.
- **E2E Playwright**, commité : 34 parcours à 390 px. `npm run test:e2e`. Workflow `e2e.yml` **à part** : il
  ne garde pas le déploiement.
- **`docs/recette-telephone.md`** : tous les checkpoints dus, en une passe de 30 minutes.

**Rangement**

- **`evaluate.ts`** (1 051 lignes) découpé en sept modules sans changer un corps de fonction.
- **`PROGRESS.md`** : 1 245 lignes → ce fichier ; les journaux de v2.4 à v2.11.1 sont dans
  `docs/journal/2026-10-14-versions-v2.md`. `CLAUDE.md` remis d'accord avec le dépôt.

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
| [2026-10-14-versions-v2.md](docs/journal/2026-10-14-versions-v2.md) | Versions v2.4 à v2.11.1 (2026-08-29 → 2026-10-13) |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
