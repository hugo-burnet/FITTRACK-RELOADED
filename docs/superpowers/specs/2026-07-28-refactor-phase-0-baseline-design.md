# Phase 0 — Baseline de refactorisation

**Date :** 2026-07-28  
**Statut :** validé  
**Source :** `FITTRACK_02_REFACTOR_CLEANING_SKILLS_V2.md`

## Objectif

Figer une référence reproductible de FitTrack avant les correctifs P0 et les
refactorisations. Cette phase ne modifie aucun comportement de l’application,
aucun schéma Dexie, aucun texte d’interface et aucune donnée utilisateur.

## Périmètre retenu

La baseline comprend :

- l’état Git exact de `master` et un tag local annoté sur le commit de départ ;
- `git diff --check`, lint, typecheck, tests unitaires et build de production ;
- le nombre de fichiers et de tests observé ;
- les 40 fichiers TypeScript/TSX les plus longs ;
- la taille brute et gzip des artefacts JavaScript et CSS produits par Vite ;
- un générateur déterministe de gros historique réservé aux tests ;
- une mesure reproductible des lectures historiques sur ce gros historique ;
- un rapport Markdown versionné dans `docs/baselines/` ;
- un scan d’architecture réactualisé, limité aux zones récemment modifiées et
  aux risques P0/P1 décrits par l’audit.

La sauvegarde des données du téléphone est explicitement exclue : l’utilisateur
a confirmé qu’aucune donnée FitTrack irremplaçable ne nécessite une copie à ce
stade. La validation sur téléphone reste un checkpoint manuel, sans bloquer les
mesures du dépôt.

## Dataset volumineux

Le dataset doit réutiliser les fabriques de `src/test/factories.ts` et rester
hors du bundle de production. Il est déterministe : horloge, identifiants,
nombre de séances, exercices et séries ne dépendent ni du réseau ni de
`Date.now()`.

Le profil de référence représente plusieurs années d’usage personnel :

- 2 000 séances terminées ;
- 8 exercices par séance ;
- 4 séries validées par exercice ;
- aucune photo ni blob ;
- dates strictement ordonnées et reproductibles.

Le générateur expose une seule interface de haut niveau. Son implémentation
absorbe la création en masse et les détails Dexie afin de conserver la
**localité** des futures mesures. Les tests et mesures utilisent cette interface,
qui constitue leur **seam** stable.

## Mesures

Les mesures de performance portent sur les interfaces publiques déjà utilisées
par l’historique et les analyses. Elles ne créent pas de nouveau repository de
production et ne modifient pas les requêtes existantes.

Le rapport consigne :

- environnement Node/npm et commit ;
- durée de chaque porte qualité ;
- compte de tests issu de Vitest ;
- taille totale et principaux chunks du build ;
- durée de génération du dataset ;
- durée des lectures historiques retenues ;
- limites de la mesure, notamment l’écart entre `fake-indexeddb` et un téléphone.

Les chiffres servent de référence comparative. Ils ne créent pas encore de
seuil CI et ne déclenchent aucun correctif opportuniste.

## Skills d’architecture et de refactorisation

Trois skills cités par l’audit ont une source publique vérifiée et sont installés
dans le répertoire personnel Codex :

- `refactoring` depuis `citypaul/.dotfiles` ;
- `improve-codebase-architecture` depuis `mattpocock/skills` ;
- `codebase-design` depuis `mattpocock/skills`.

`improve-codebase-architecture` gouverne le scan réactualisé.
`codebase-design` fournit le vocabulaire du rapport : **module**, **interface**,
**implémentation**, **depth**, **seam**, **adapter**, **leverage** et
**locality**. `refactoring` sert de garde : la phase 0 s’arrête à l’évaluation,
car aucune refactorisation ne doit commencer avant une baseline verte et
commitée.

`reduce-system-complexity` est mentionné par le skill `refactoring`, mais aucune
source publique installable n’a été identifiée dans le document ou dans le
dépôt source. Il reste donc non installé plutôt que d’être recréé sous un nom
trompeur. Une éventuelle création ou adoption d’un équivalent formera une
décision séparée.

## Artefacts

- `src/test/largeHistory.ts` : générateur déterministe et profond ;
- `src/test/largeHistory.test.ts` : preuve des relations et de la
  reproductibilité sur un profil réduit, afin de ne pas alourdir chaque
  `npm run test:run` ;
- `src/data/repositories/history.bench.ts` : profil complet et mesures bornées
  sur les interfaces publiques existantes, exécutées uniquement à la demande ;
- un script npm `bench:history` qui lance ce benchmark une fois ;
- `docs/baselines/2026-07-28-refactor-baseline.md` : résultats de référence ;
- un rapport HTML d’architecture dans le dossier temporaire du système, non
  versionné, conformément au skill `improve-codebase-architecture`.

## Portes et arrêt

La phase 0 est terminée lorsque :

- les cinq contrôles Git/qualité sont verts ;
- le dataset est reproductible et ses tests passent ;
- les mesures et leurs limites sont consignées ;
- le scan d’architecture ne modifie aucun fichier applicatif ;
- le tag local pointe sur le commit de départ ;
- le rapport de baseline et `PROGRESS.md` sont commités.

Tout bug découvert est consigné sans être corrigé dans ce commit. Toute
refactorisation est reportée à une tranche ultérieure avec sa propre preuve de
préservation.
