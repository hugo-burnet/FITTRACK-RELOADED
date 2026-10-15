# Benchmark — Design

**Date :** 2026-10-15
**Statut :** livré (v2.12.0), **repris à la demande de l'utilisateur** : « le coach doit lire ce benchmark et te proposer des
charges adaptées, ça met à jour les routines — et ça doit bien prendre en compte la fourchette : un mec qui fait des séries de
8, 12, 15, 18, 20 ». Demande d'origine : « une séance avec 1 série, le plus de répétitions possible, ça nous calibre notre
coach, 1 série par exo ». Décisions de détail prises en autonomie, à relire.
**Périmètre :** une séance spéciale lancée depuis une routine, son bilan, la lecture du benchmark par le coach, et l'écriture —
acceptée — des charges calibrées dans cette routine. **Hors périmètre :** un benchmark « libre » hors routine, un historique de
benchmarks comparés entre eux, un coach qui partirait d'un 1RM stocké.

## Objectif

Le coach progresse à partir de ce qui a été fait, et la routine propose ce qui est écrit dans ses cibles. Si le point de
départ est faux — une charge posée à l'œil il y a six mois, un exercice repris après une pause —, il faut des semaines de
hausses d'un cran pour rattraper l'écart, et le coach n'y peut rien : il ne sait pas que le départ est faux.

Le benchmark est la façon de le dire : **une série par exercice, menée à l'échec**, et le coach en déduit, **pour la fourchette de
cet exercice**, la charge à laquelle elle est tenable — la pose comme objectif, et propose de l'écrire dans la routine.

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

**Les répétitions d'une série à l'échec sont le résultat, jamais une proposition.** Une séance de benchmark passe `amrap` aux
lignes de série : le fantôme des répétitions (la dernière séance de l'exercice, que la cible effacée laissait reprendre) n'est ni
grisé ni enregistré par la coche, qui reste fermée tant qu'elles ne sont pas tapées. La charge garde son fantôme, et « Précédent »
reste un geste explicite. (Découvert après la v2.12.2 : sans cela, pour un exercice qui avait un historique, « Valider » enregistrait
les répétitions de la dernière fois comme le maximum.)

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

### 2 bis. Ce que le coach lit du benchmark

Le moteur du coach ne lit aucune charge cible de routine : il juge des séries *faites*. Le benchmark ne passe donc pas par lui comme
une séance ordinaire ; il passe par **le chemin des objectifs**, qui est celui de tout ce que le coach propose :

- **Un signal `benchmark_calibrated`**, posé à l'enregistrement de la séance (`finalizeCoachForWorkout` → `recordBenchmarkObjectives`),
  pour chaque exercice dont la charge est fiable : la charge de sa fourchette, avec les chiffres qui l'ont produite (essai, max estimé,
  fourchette, référence — jamais un « 77,5 kg » nu). La carte de l'exercice l'affiche à la séance suivante, un geste l'écrit sur les séries
  restantes, comme tout objectif.
- **Un objectif vivant à la fois** : `recordCoachSignals` remplace l'objectif en attente de l'exercice (`superseded`, jamais refusé).
- **Pas de signal pour une estimation approximative** (§3) : le coach ne pousse pas une extrapolation. Ni sans charge à proposer.
- **Les règles de séance ne s'appliquent toujours pas** : plafond atteint, fourchette tenue, hausse, suivi d'objectif. Une série à
  l'échec n'est pas une séance de travail, et sa charge n'est pas la réponse à un objectif.
- **Pas de 1RM stocké pour le coach**, et pas de séance de programme : un bloc possède ses charges, ses objectifs numériques sont
  retirés de la carte (`useActiveWorkout`) — le benchmark n'y change rien.

Un objectif posé par le benchmark est résolu à l'acceptation du bilan (§4).

### 3. Du maximum à la charge de travail, sur la fourchette de l'exercice

`lib/benchmark.ts`, pur :

- **La fourchette** est celle de la première série de travail de la routine : « 8 – 12 », « 15 – 20 », ou une cible unique — « 20 » est
  une fourchette d'un seul point (`repZone`). Sans cible exploitable : 8 – 12. Chaque exercice a la sienne : un squat à 8 – 12 et un
  mollet à 15 – 20 ne se lisent pas pareil.
- **Une seule formule, Epley**, de 1 à 30 répétitions (`oneRepMaxOf`, `loadForReps`, l'inverse exact), **quelle que soit la formule
  d'affichage des réglages**. Les trois formules de 1RM ne s'accordent qu'entre 1 et 12 répétitions : Brzycki s'effondre au-delà et
  Lombardi s'aplatit — or celui qui travaille à 15, 18 ou 20 est précisément au-delà. C'est déjà la règle du coach pour le cran
  (`repsToAbsorbStep`) : un choix de produit, pas une mesure. Au-delà de 30 répétitions : **pas d'estimation**, « trop léger ».
- **Charge de travail.** La charge à laquelle un maximum tient `bas de fourchette + 2` répétitions (`BENCHMARK_RESERVE_REPS = 2`) :
  10 pour un 8 – 12, 17 pour un 15 – 20, 22 pour un 20, plafonné à 30. On commence la fourchette avec deux répétitions en réserve, et
  la double progression a ensuite de la place pour monter. *(La v2.12.x plafonnait à 12 : un 15 – 20 recevait la charge d'une série de
  12 — bien trop lourde — et un essai à 15 répétitions était déclaré « trop léger ».)*
- **Estimation approximative.** Convertir 22 répétitions en 17 est une petite extrapolation ; convertir 25 en 7 n'est plus une mesure.
  À plus de six répétitions de la référence (`BENCHMARK_ROUGH_GAP`), la charge est proposée mais **dite approximative** : son
  interrupteur est éteint d'office (la personne le rallume), et le coach n'en tire pas d'objectif. Le seuil se juge sur la fourchette
  de chaque exercice : 22 répétitions sont proches d'un 15 – 20, loin d'un 5.
- **Arrondi vers le bas, jamais vers le haut.** Sur la grille du matériel quand le pas est celui de la table ; à partir de la charge
  essayée quand le pas est celui que la personne a saisi sur l'exercice (un cran de 1,125 kg ne tombe pas sur un multiple de 1,125 —
  cf. `resolveLoadStep`). Le benchmark ne propose jamais plus que ce que le maximum autorise.
- **Seul `weight_reps` reçoit une charge.** Pour un exercice lesté ou assisté, la charge n'est qu'une partie de ce qui est soulevé ; le
  pas d'une cible de temps n'a pas de sens. Ces exercices ont leur résultat dans le bilan (répétitions, durée), sans proposition.

### 4. Le bilan et l'écriture

Écran `/benchmark/:workoutId`, atteint à l'enregistrement de la séance (qui, pour un benchmark, ne passe
pas par l'évaluation de séance du coach, mais lui fait lire le benchmark — §2 bis) et depuis le détail de la séance dans
l'historique. Il se recalcule en direct : pour chaque exercice, la fourchette de la routine, ce qui a été fait, le 1RM estimé, la
charge conseillée contre la cible actuelle de la routine — et, pour une estimation approximative, pourquoi elle l'est.

Accepter écrit par `applyRoutineTargetProposals` — le chemin d'écriture de la revue des cibles, qui décale
**toutes** les séries de travail de la ligne du même écart (une pyramide garde sa forme) et relit les
identifiants en base. Une ligne se décoche : le bilan propose, la personne dispose. Les interrupteurs sont allumés d'office, sauf ceux
d'une estimation approximative ; l'écran retient ce que la personne a **retourné** par rapport à ce défaut. Une fois appliqué, la
cible égale la proposition et la ligne se lit « déjà à jour » — l'écran n'a pas d'état d'« appliqué » à retenir.

**Un décalage ne se rejoue pas.** Chaque proposition porte la série qu'elle a lue (la première de travail) et
la charge qu'elle y a vue (`anchorSetId`, `fromWeight`) : elle n'est écrite que si cette série porte encore
cette charge. Un double appui, ou une routine modifiée entre le bilan et l'appui, ne déplace pas deux fois ;
une série de référence supprimée annule la proposition. Le compte annoncé (« 1 exercice mis à jour ») est celui
des exercices réécrits, pas des séries.

**Une charge, une seule source.** Dans la même transaction que l'écriture, les objectifs de charge encore en attente des exercices
réellement réécrits sont résolus : celui que **ce** benchmark avait posé devient `followed` (l'accepter, c'est le suivre, avec la
charge écrite), tout autre devient `superseded` (qui n'est pas un refus). Les observations sans charge restent : le benchmark ne les
contredit pas. Sans cela, la carte de la séance et la cible de la routine donneraient deux chiffres pour le même exercice.

L'exercice de la séance est rapproché de la ligne de routine par `(exerciseId, order)`. Si la routine a
été modifiée entre-temps et que rien ne correspond, la ligne n'a pas de proposition : mieux vaut ne rien
écrire que l'écrire au mauvais endroit.

Si la personne a fait plusieurs séries du même exercice (elle peut en ajouter), le bilan retient celle
dont le 1RM estimé est le plus haut.

### 5. Le lancement

**Deux portes, une seule feuille.** Dans le menu ⋮ d'une routine (la liste) et sur une ligne de son **éditeur**, sous
« Mettre à jour les cibles » : **« Benchmark de cette routine »**, désactivé tant qu'une séance est en cours, comme
« Démarrer », et absent d'une routine sans exercice. La première porte seule n'a pas suffi : un menu qu'on n'ouvre que pour
dupliquer ou supprimer n'est pas un endroit où l'on cherche une fonctionnalité — signalé par l'utilisateur après la v2.12.0.
Les deux ouvrent `BenchmarkLaunchSheet`, qui ne peut donc pas dire deux choses différentes. Une feuille d'explication (trois phrases : une série par exercice, choisis une charge
avec laquelle tu comptes faire la fourchette de l'exercice dans la routine — 8 – 12, 15 – 20, 20… —, va jusqu'à l'échec ; plus l'essai
en est loin, moins la charge est fiable) précède le lancement. Aucun rappel, aucune
périodicité : c'est un geste que la personne décide.

## Ce qui n'est pas fait, et pourquoi

- Pas de comparaison entre deux benchmarks : une seule série à l'échec est un point bruité, et une courbe
  de points bruités fabrique des tendances. Les 1RM estimés restent lisibles dans les courbes existantes.
- Pas de benchmark pour les exercices en temps ou à distance : « le plus longtemps possible » n'a pas de
  charge à en tirer, et l'enregistrer comme un test de force serait mentir sur ce qu'il mesure.
- Pas de réglage de la réserve de répétitions : une constante nommée, changeable en un endroit, tant
  que personne n'a montré qu'elle était fausse. Il en va de même du seuil d'écart de six répétitions et de la limite de 30.
- Pas de fourchette affichée **pendant** la séance de benchmark : elle se lit sur le bilan et dans la feuille de lancement. La poser
  sur la ligne de série (la cible de répétitions) rouvrirait le défaut des répétitions proposées (§1) ; l'afficher à part demande
  de la plomberie qu'aucun défaut n'a encore justifiée.
- Pas de lien du coach vers un 1RM stocké, ni vers les séances de programme : voir §2 bis.
