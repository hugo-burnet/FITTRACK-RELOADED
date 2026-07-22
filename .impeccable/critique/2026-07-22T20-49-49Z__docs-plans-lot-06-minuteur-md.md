---
target: minuteur de repos (Lot 6)
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-07-22T20-49-49Z
slug: docs-plans-lot-06-minuteur-md
---
**Method:** ⚠️ DEGRADED: single-context (sous-agents non autorisés sans demande explicite de l'utilisateur)

Cible : le minuteur de repos du Lot 6, tel que spécifié dans `docs/plans/lot-06-minuteur.md`. Aucun code livré — la critique porte sur la spécification et sur trois maquettes mesurées.

## Design Health Score

| # | Heuristique | Score | Point clé |
|---|---|---|---|
| 1 | Visibilité de l'état | 2 | Le filet défile hors champ ; « fini » et « jamais lancé » indiscernables |
| 2 | Système ↔ monde réel | 2 | Un `1:30` fixe à côté d'une jauge qui bouge se lit comme du temps restant |
| 3 | Contrôle et liberté | 2 | Pas d'annulation ; pas de retour sur un ±15 s |
| 4 | Cohérence et standards | 3 | Réemploi exemplaire des jetons ; ±15 s de forme neuve |
| 5 | Prévention des erreurs | 3 | Un ±15 s raté se rattrape par l'autre ; passage à zéro silencieux réfléchi |
| 6 | Reconnaître plutôt que se rappeler | 2 | Commandes à ~100 px de la jauge qu'elles pilotent |
| 7 | Souplesse et efficacité | 3 | Démarrage automatique, ±15 s à un appui |
| 8 | Esthétique et minimalisme | 4 | Rien n'est ajouté, un seul accent, zéro décor |
| 9 | Récupération d'erreur | 2 | Un repos terminé par erreur ne se relance pas |
| 10 | Aide et documentation | 2 | Le filet n'est expliqué nulle part (largement volontaire) |
| **Total** | | **25/40** | **Acceptable — bonne idée, défaut de cohérence spatiale** |

## Verdict anti-patterns

Aucun anti-pattern. Détecteur : 1 signalement `single-font`, **faux positif** — le registre *product* dit lui-même « One family is often right », et l'app n'embarque aucune police par décision de charte.

## Problèmes prioritaires

- **[P1] Les commandes sont loin de leur jauge.** `+15 s` en haut d'écran, filet 100 px plus bas, aucun lien visuel, et hors zone du pouce. → un seul objet.
- **[P1] Le `1:30` fixe sera lu comme du temps restant.** Une pastille chrono + un nombre à côté d'une jauge qui avance veut dire « il reste » partout ailleurs.
- **[P1] La ligne de relevés passait de 28 à 48 px pendant le repos** — 20 px de décalage, 60 fois par séance. Défaut identique à celui qui avait tué le premier jet.
- **[P2] « Repos fini » et « aucun repos » indiscernables.** Le filet s'efface, l'absence n'est pas une information.
- **[P2] Le filet est ancré à une ligne supprimable.** Quatre cas non spécifiés : supprimer, décocher, cocher ailleurs, retirer l'exercice.

## Correctifs arbitrés (en faveur de l'ergonomie et de l'élégance)

Une **ligne de repos** insérée sous la série cochée — la place et le mécanisme d'`UndoRow` :

- **Un pas-à-pas** `−15 s · 1:30 · +15 s`. Le nombre devient l'opérande des deux touches, ce qui dissout l'ambiguïté « restant / total » sans réintroduire de décompte.
- **La progression sur le bord bas de la ligne**, 6 px et non 3 (`--accent-ink`, 5,23:1 en clair).
- **À zéro, la ligne entière bascule en aplat d'accent** — la bascule de la coche. À 100 % il n'y a plus de bord, donc aucun glyphe coupé.
- **Filet de carte au-dessus** : sans lui, la série cochée et le repos (tous deux `--surface-2`) fondent en un bloc gris de 112 px.
- **Touches en `--surface-1`** : exactement ce que les cellules d'une série cochée font déjà, une ligne au-dessus.
- **`role="progressbar"` + `aria-valuetext`** : le temps restant devient interrogeable sans annonce à la seconde.
- **La ligne de relevés n'est plus touchée** — mesurée à 25,6 px dans tous les états.

## Mesuré après correctifs

Contraste **0 échec, minimum 5,23:1** aux deux thèmes · ligne 341 × 56 · filet 137 × 6 · aucune cible sous 48 × 44 · aucun débordement · ligne de relevés identique dans les cinq états.

## Personas

- **Casey (mobile, une main)** : les ±15 s descendent dans la zone du pouce, à l'endroit exact qui vient d'être touché. Reste : un kill de l'app perd le minuteur (store non persisté) — acceptable, à écrire comme décision.
- **Sam (lecteur d'écran)** : réglé par `role="progressbar"` + `aria-valuetext`. 6 px plutôt que 3 pour la basse vision.
- **Riley** : les quatre cas d'ancrage sont désormais spécifiés, avec le repli d'`UndoRow` (le bandeau tombe en pied de grille quand son hôte disparaît).
