# État d'avancement — FitTrack

> Mis à jour à la fin de chaque session. C'est la mémoire du projet entre les sessions.
> **Court par construction.** Une version publiée et close part dans `docs/journal/` (lecture seule) ;
> les décisions, les pièges et la dette vont dans `docs/progress/decisions-et-pieges.md`. Ce fichier ne
> garde que ce qui est vivant : où on en est, ce qui reste, ce qui est dû.

**Dernière mise à jour :** 2026-10-15 — **v2.12.2 publiée** (PWA et APK). `master` (`3903dc8`) porte la branche de session
`ccr-57f17af8-maxzqv`, fusionnée `--no-ff`.

## Où on en est

- **Publié : v2.12.2** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.12.2), APK `FitTrack-v2.12.2.apk`
  signé avec la clé de release. Appliquer un benchmark **remplace** l'objectif de charge que le coach avait déjà posé sur l'exercice (il
  restait affiché à côté de la cible écrite par le benchmark : deux chiffres pour un exercice). Précisé : le moteur du coach ne lit aucune
  charge cible de routine, il juge des séries faites ; le benchmark le calibre par les cibles de la routine, et il en prend acte à la
  première séance ordinaire faite à cette charge (`docs/progress/decisions-et-pieges.md`, entrée du benchmark).
- **Avant : v2.12.1** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.12.1), APK `FitTrack-v2.12.1.apk`
  signé avec la clé de release. Une ligne **« Benchmark de cette routine » dans l'éditeur de la routine** (le benchmark n'était que dans
  le menu ⋮ de la liste, et ne se trouvait pas) ; rien d'autre ne change depuis la v2.12.0.
- **Avant : v2.12.0** — [la release](https://github.com/hugo-burnet/FITTRACK-RELOADED/releases/tag/v2.12.0) : la coche qui n'écrase plus la
  saisie, le coach R6, le benchmark, les mensurations, « Remplacer l'exercice », le rappel de sauvegarde, l'E2E commité. Le détail des trois
  versions, la voie de la publication et ses vérifications : [`docs/journal/2026-10-15-versions-v2-12.md`](docs/journal/2026-10-15-versions-v2-12.md).
- **Portes** : `typecheck` (`src` et `e2e`), `lint`, `test:run` (**3 531 tests**, 299 fichiers, 1 ignoré), `build` et `test:e2e`
  (**34 parcours**, 8 fichiers, à 390 px) — verts sur `master`, y compris sur la CI.
- **Branches distantes.** `ccr-449df1c1-etmya3` et `ccr-57f17af8-maxzqv`, fusionnées, sont à supprimer à la main : le refus de
  supprimer une branche distante vaut toujours pour une session d'agent. **Garder les trois `archive/*`** : `make-fragments.mjs` lit
  `archive/fittrack-kb-corpus`.
- **Pour publier la suivante** : `chore: prepare release vX.Y.Z` (`package.json` et son lock), `master` poussé sans force, puis le
  `workflow_dispatch` d'`android.yml` avec `release_tag`. **Un commit poussé pendant un déploiement annule celui-ci** (groupe `pages`) :
  pousser les commits de documentation avant de lancer la release, ou accepter le déploiement du suivant.

## À juger sur le terrain (v2.12.0)

- **Un lien plus profond entre benchmark et coach** (le coach partant du 1RM du benchmark, ou posant la charge calibrée comme objectif) :
  non fait, c'est une règle nouvelle ; à demander si la calibration par la routine ne suffit pas.
- **Benchmark** : la réserve de 2 répétitions et la limite de 12 sont des constantes (`lib/benchmark.ts`) ; si les charges proposées
  paraissent trop basses ou trop hautes, c'est là.
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
