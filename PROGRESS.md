# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-10-15 — **v2.13.0 publiée** (PWA et APK) : le benchmark lit la fourchette et les séries de chaque
exercice, et le coach le lit.

## Où on en est

- **Publié : v2.13.0** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.13.0), APK `FitTrack-v2.13.0.apk`
  signé avec la clé de release. **Le benchmark repris**, à la demande de l'utilisateur (« le coach doit lire ce benchmark et te proposer des
  charges adaptées… et ça doit bien prendre en compte la fourchette : 8, 12, 15, 18, 20 », puis « je choisis ma charge d'essai, le coach
  extrapole la meilleure charge sur x séries »).
  - **La fourchette.** La charge se dimensionnait sur « bas + 2, plafonné à 12 » : un 15 – 20 recevait celle d'une série de 12, bien trop
    lourde. Désormais la fourchette est celle de la routine (cible unique = fourchette d'un point), Epley seul de 1 à 30 répétitions ; un
    essai loin de ce que la première série doit tenir est dit approximatif, interrupteur éteint.
  - **Les séries.** La charge conseillée **tient toutes les séries de la routine** (six au plus ; une pyramide compte pour une ; sans
    série de travail, 3 pour un polyarticulaire, 2 pour une isolation) : la première doit pouvoir faire `(bas + 2) / (1 − φ)^(x − 1)`
    répétitions pour que la dernière garde deux répétitions en réserve. φ = 10 % par série (8 % pour une isolation), plus haut quand le
    repos est court. Exemple : 80 kg × 17 sur un 15 – 20, trois séries → 72,5 kg. Les chiffres de fatigue sont **au pif**, comme les
    « 3 et 2 séries » de la demande : `lib/benchmarkModel.ts`, à régler sur le terrain. Le coach n'écrit jamais un nombre de séries
    (tranché avec l'utilisateur : R6 s'en charge).
  - **Le coach lit le benchmark.** Signal `benchmark_calibrated`, posé à l'enregistrement par le chemin des objectifs ; la carte de
    l'exercice l'affiche à la séance suivante. Accepter le bilan écrit la routine et **suit** cet objectif.
  - **Un défaut trouvé en route.** Pour un exercice qui avait un historique, la coche enregistrait les répétitions de la dernière fois
    comme maximum du benchmark. Corrigé (`amrap`), avec l'E2E « un exercice a un historique » qui manquait.
  - Détail et choix à relire : `docs/progress/decisions-et-pieges.md`, entrées du 2026-10-15 (« la charge du benchmark tient les séries de
    la routine », « le benchmark suit la fourchette, et le coach le lit »).
- **Avant : v2.12.0 → v2.12.2** — la coche qui n'écrase plus la saisie, le coach R6 (volume par muscle), le benchmark (puis sa porte dans
  l'éditeur de la routine, puis le remplacement de l'objectif de charge du coach), les mensurations, « Remplacer l'exercice », le rappel de
  sauvegarde, l'E2E commité. Le détail des trois versions, la voie de la publication et ses vérifications :
  [`docs/journal/2026-10-15-versions-v2-12.md`](docs/journal/2026-10-15-versions-v2-12.md).
- **Portes** : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 602 tests**, 300 fichiers, 1 ignoré), `build` et `test:e2e`
  (**35 parcours**, 8 fichiers, à 390 px) — verts sur `master` à la v2.13.0.
- **Branches distantes.** `ccr-449df1c1-etmya3` et `ccr-57f17af8-maxzqv`, fusionnées, sont à supprimer à la main : le refus de
  supprimer une branche distante vaut toujours pour une session d'agent. **Garder les trois `archive/*`** : `make-fragments.mjs` lit
  `archive/fittrack-kb-corpus`.
- **Pour publier la suivante** : `chore: prepare release vX.Y.Z` (`package.json` et son lock), `master` poussé sans force, puis le
  `workflow_dispatch` d'`android.yml` avec `release_tag`. **Un commit poussé pendant un déploiement annule celui-ci** (groupe `pages`) :
  pousser les commits de documentation avant de lancer la release, ou accepter le déploiement du suivant.

## À juger sur le terrain (v2.12.0 → v2.13.0)

- **Benchmark** : la réserve de 2 répétitions, la fatigue par série (10 % / 8 %), ses bornes de repos, le plafond de six séries, les
  séries par défaut (3 / 2) et la limite de 30 répétitions sont des constantes (`lib/benchmarkModel.ts`) ; si les charges proposées
  paraissent trop basses ou trop hautes, c'est là. Le test sur le terrain : trois séries à la charge conseillée doivent laisser environ
  deux répétitions en réserve à la dernière.
- **Coach R6** : le plafond ne change presque rien tant qu'on ne le relève pas — c'est la décision, pas un défaut (`effectiveCeiling`,
  un seul endroit).
- **Un E2E des mensurations a bloqué une fois** (`corriger puis supprimer une mesure`, délai de 60 s dans une passe complète ; non
  reproduit en 12 relances et sur la CI). Si cela revient, garder la trace avant de relancer.
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
| [2026-10-15-versions-v2-12.md](docs/journal/2026-10-15-versions-v2-12.md) | Version v2.12.0 (2026-10-14 → 2026-10-15) |
| [2026-10-14-versions-v2.md](docs/journal/2026-10-14-versions-v2.md) | Versions v2.4 à v2.11.1 (2026-08-29 → 2026-10-13) |
| [2026-08-29-versions-v0-v1.md](docs/journal/2026-08-29-versions-v0-v1.md) | Versions v0–v1 |
| [journal-2026.md](docs/progress/journal-2026.md) | Sessions 2026 (tutoriel, wiki, investigation) |
| [lots.md](docs/progress/lots.md) | Journaux des lots 0 à 7 |
| [decisions-et-pieges.md](docs/progress/decisions-et-pieges.md) | Décisions, pièges, dette technique |
