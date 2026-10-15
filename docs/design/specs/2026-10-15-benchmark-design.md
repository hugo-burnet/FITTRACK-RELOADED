# Benchmark — Design

**Date :** 2026-10-15
**Statut :** livré (v2.12.0) — demandé par l'utilisateur (« une séance avec 1 série, le plus de répétitions possible, ça
nous calibre notre coach, 1 série par exo »), décisions de détail prises en autonomie, à relire
**Périmètre :** une séance spéciale lancée depuis une routine, son bilan, et l'écriture — acceptée —
des charges calibrées dans cette routine. **Hors périmètre :** un benchmark « libre » hors routine,
un historique de benchmarks comparés entre eux, tout canal nouveau vers le moteur du coach.

## Objectif

Le coach progresse à partir de ce qui est écrit dans la routine (les charges cibles) et de ce qui a été
fait. Si le point de départ est faux — une charge posée à l'œil il y a six mois, un exercice repris après
une pause —, il faut des semaines de hausses d'un cran pour rattraper l'écart, et le coach n'y peut rien :
il ne sait pas que le départ est faux.

Le benchmark est la façon de le dire : **une série par exercice, menée à l'échec**, et l'app déduit de ce
maximum la charge à laquelle la fourchette de la routine est tenable.

## Décisions structurantes

### 1. Une séance ordinaire, marquée `kind: 'benchmark'`

Pas de table, pas d'index, pas de version de schéma : un champ optionnel sur `Workout`, validé par la
sauvegarde comme `programPhase` (`oneOf(['benchmark'])`). La séance suit le chemin d'une séance normale —
écriture à chaque ✓, reprise après un kill, écran de fin — parce que c'est la règle n°4 (aucune perte) et
qu'un second chemin d'écriture serait un second endroit où la perdre.

Elle est construite par `buildWorkoutEntities` depuis la routine, puis **réduite** : pour chaque exercice,
une seule série — la première série de travail de la routine (l'échauffement n'en est pas une) —, de type
`failure`, **sans cible de répétitions** (on ne vise rien, on va au bout) et sans RPE visé. La charge cible
de la routine reste, grisée : c'est la charge d'essai que l'app propose, la personne peut la changer. Un
exercice sans série de travail en reçoit une, vide.

Le type `failure` existe déjà et dit exactement cela ; les records, le volume et l'historique le lisent
sans rien changer.

### 2. Ce que le benchmark contamine, et ce qu'il ne contamine pas

Une série menée à l'échec est une vraie performance : **elle compte** pour les records, le volume par muscle
(R6), la régularité, les courbes et l'historique, où la séance porte son nom.

Elle n'est **pas un modèle de série de travail**, donc elle est écartée de tout ce qui *prescrit* :

- **les valeurs fantômes** (`getLastPerformance`) : la séance suivante ne doit pas proposer « 14 × 80 kg »
  comme si c'était la série d'hier ;
- **l'historique du coach** (`loadCoachHistoryLines`, et son miroir de rejeu `coachLinesFromBackup`) et
  **l'évaluation de fin de séance** : une seule série à l'échec lue comme une séance entière ferait
  proposer des hausses ou des baisses sur du vide, et enregistrerait des objectifs que personne n'a
  formulés ;
- **la revue des cibles** (`routineTargetReview`) : une séance d'une série sur quatre prévues se lirait
  comme une séance non tenue.

Le coach est calibré **par les cibles de la routine**, une fois que la personne les a acceptées — pas par
un canal parallèle.

### 3. Du maximum à la charge de travail

`lib/benchmark.ts`, pur :

- **Estimation.** `estimateOneRepMax` (la formule choisie dans les réglages), valable de 1 à 12
  répétitions. Au-delà de 12 : **pas d'estimation**, et le bilan le dit — « trop léger pour estimer,
  refais-le plus lourd » — plutôt que d'inventer un chiffre au-delà du domaine des formules.
- **Charge de travail.** La charge à laquelle un maximum tient `bas de fourchette + 2` répétitions
  (`BENCHMARK_RESERVE_REPS = 2`) : on commence la fourchette avec deux répétitions en réserve, et la
  double progression a ensuite de la place pour monter. Le bas de fourchette est celui de la première
  série de travail de la routine (8 si elle n'en porte pas) ; le total est plafonné à 12, limite des
  formules. L'inverse de chacune des trois formules est calculé exactement ; l'aller-retour
  `estimate → inverse` est un test.
- **Arrondi vers le bas, jamais vers le haut.** Sur la grille du matériel quand le pas est celui de la
  table ; à partir de la charge essayée quand le pas est celui que la personne a saisi sur l'exercice
  (un cran de 1,125 kg ne tombe pas sur un multiple de 1,125 — cf. `resolveLoadStep`). Le benchmark ne
  propose jamais plus que ce que le maximum autorise.
- **Seul `weight_reps` reçoit une charge.** Pour un exercice lesté ou assisté, la charge n'est qu'une
  partie de ce qui est soulevé ; le pas d'une cible de temps n'a pas de sens. Ces exercices ont leur
  résultat dans le bilan (répétitions, durée), sans proposition.

### 4. Le bilan et l'écriture

Écran `/benchmark/:workoutId`, atteint à l'enregistrement de la séance (qui, pour un benchmark, ne passe
pas par l'évaluation du coach) et depuis le détail de la séance dans l'historique. Il se recalcule en
direct : pour chaque exercice, ce qui a été fait, le 1RM estimé, la charge conseillée contre la cible
actuelle de la routine.

Accepter écrit par `applyRoutineTargetProposals` — le chemin d'écriture de la revue des cibles, qui décale
**toutes** les séries de travail de la ligne du même écart (une pyramide garde sa forme) et relit les
identifiants en base. Une ligne se décoche : le bilan propose, la personne dispose. Une fois appliqué, la
cible égale la proposition et la ligne se lit « déjà à jour » — l'écran n'a pas d'état à retenir.

**Un décalage ne se rejoue pas.** Chaque proposition porte la série qu'elle a lue (la première de travail) et
la charge qu'elle y a vue (`anchorSetId`, `fromWeight`) : elle n'est écrite que si cette série porte encore
cette charge. Un double appui, ou une routine modifiée entre le bilan et l'appui, ne déplace pas deux fois ;
une série de référence supprimée annule la proposition. Le compte annoncé (« 1 exercice mis à jour ») est celui
des exercices réécrits, pas des séries.

L'exercice de la séance est rapproché de la ligne de routine par `(exerciseId, order)`. Si la routine a
été modifiée entre-temps et que rien ne correspond, la ligne n'a pas de proposition : mieux vaut ne rien
écrire que l'écrire au mauvais endroit.

Si la personne a fait plusieurs séries du même exercice (elle peut en ajouter), le bilan retient celle
dont le 1RM estimé est le plus haut.

### 5. Le lancement

Dans le menu d'une routine : **« Benchmark de cette routine »**, désactivé tant qu'une séance est en cours,
comme « Démarrer ». Une feuille d'explication (trois phrases : une série par exercice, choisis une charge
où tu t'attends à 5 – 12 répétitions, va jusqu'à l'échec) précède le lancement. Aucun rappel, aucune
périodicité : c'est un geste que la personne décide.

## Ce qui n'est pas fait, et pourquoi

- Pas de comparaison entre deux benchmarks : une seule série à l'échec est un point bruité, et une courbe
  de points bruités fabrique des tendances. Les 1RM estimés restent lisibles dans les courbes existantes.
- Pas de benchmark pour les exercices en temps ou à distance : « le plus longtemps possible » n'a pas de
  charge à en tirer, et l'enregistrer comme un test de force serait mentir sur ce qu'il mesure.
- Pas de réglage de la réserve de répétitions : une constante nommée, changeable en un endroit, tant
  que personne n'a montré qu'elle était fausse.
