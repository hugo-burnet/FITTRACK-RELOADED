# Benchmark — Design

**Date :** 2026-10-15
**Statut :** livré (v2.12.0), **repris à la demande de l'utilisateur** : « le coach doit lire ce benchmark et te proposer des
charges adaptées, ça met à jour les routines — et ça doit bien prendre en compte la fourchette : un mec qui fait des séries de
8, 12, 15, 18, 20 ». Demande d'origine : « une séance avec 1 série, le plus de répétitions possible, ça nous calibre notre
coach, 1 série par exo ». **Reprise** (non publiée) : « je veux estimer les meilleures charges, je pense que je peux faire 80 kg × 15, on
teste, je varie à 17, 20 ou 12… 1 série de chaque exo. Le coach récupère ces infos et extrapole la meilleure charge sur x séries — par
exemple 3 séries sur les poly-articulaires, 2 sur les isolations, c'est un exemple au pif ». Décisions de détail prises en autonomie, à
relire.
**Périmètre :** une séance spéciale lancée depuis une routine, son bilan, la lecture du benchmark par le coach, et l'écriture —
acceptée — des charges calibrées dans cette routine. **Hors périmètre :** un benchmark « libre » hors routine, un historique de
benchmarks comparés entre eux, un coach qui partirait d'un 1RM stocké.

## Objectif

Le coach progresse à partir de ce qui a été fait, et la routine propose ce qui est écrit dans ses cibles. Si le point de
départ est faux — une charge posée à l'œil il y a six mois, un exercice repris après une pause —, il faut des semaines de
hausses d'un cran pour rattraper l'écart, et le coach n'y peut rien : il ne sait pas que le départ est faux.

Le benchmark est la façon de le dire : **une série par exercice, menée à l'échec, avec la charge que la personne pense tenir**, et le
coach en déduit, **pour la fourchette de cet exercice et pour toutes ses séries**, la charge à laquelle elle est tenable — la pose
comme objectif, et propose de l'écrire dans la routine.

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
  fourchette, nombre de séries, répétitions exigées de la première — jamais un « 77,5 kg » nu). La carte de l'exercice l'affiche à la séance suivante, un geste l'écrit sur les séries
  restantes, comme tout objectif.
- **Un objectif vivant à la fois** : `recordCoachSignals` remplace l'objectif en attente de l'exercice (`superseded`, jamais refusé).
- **Pas de signal pour une estimation approximative** (§3) : le coach ne pousse pas une extrapolation. Ni sans charge à proposer.
- **Les règles de séance ne s'appliquent toujours pas** : plafond atteint, fourchette tenue, hausse, suivi d'objectif. Une série à
  l'échec n'est pas une séance de travail, et sa charge n'est pas la réponse à un objectif.
- **Pas de 1RM stocké pour le coach**, et pas de séance de programme : un bloc possède ses charges, ses objectifs numériques sont
  retirés de la carte (`useActiveWorkout`) — le benchmark n'y change rien.

Un objectif posé par le benchmark est résolu à l'acceptation du bilan (§4).

### 3. Du maximum à la charge de travail, sur la fourchette et les séries de l'exercice

`lib/benchmarkModel.ts` (le modèle) et `lib/benchmark.ts` (la lecture d'une séance de benchmark), purs :

- **La fourchette** est celle de la première série de travail de la routine : « 8 – 12 », « 15 – 20 », ou une cible unique — « 20 » est
  une fourchette d'un seul point (`repZone`). Sans cible exploitable : 8 – 12. Chaque exercice a la sienne : un squat à 8 – 12 et un
  mollet à 15 – 20 ne se lisent pas pareil.
- **Une seule formule, Epley**, de 1 à 30 répétitions (`oneRepMaxOf`, `loadForReps`, l'inverse exact — il accepte une capacité non
  entière, c'est une grandeur et non un compte), **quelle que soit la formule d'affichage des réglages**. Les trois formules de 1RM
  ne s'accordent qu'entre 1 et 12 répétitions : Brzycki s'effondre au-delà et Lombardi s'aplatit — or celui qui travaille à 15, 18 ou 20
  est précisément au-delà. C'est déjà la règle du coach pour le cran (`repsToAbsorbStep`) : un choix de produit, pas une mesure.
  Au-delà de 30 répétitions : **pas d'estimation**, « trop léger ».
- **Une charge se tient sur plusieurs séries, pas sur une.** Le benchmark mesure la *première*, à fond ; à charge égale, chaque série de
  plus perd une part φ de ce que la précédente permettait (`setFatigue`). La charge conseillée est celle dont la **dernière** série garde,
  au bas de la fourchette, **deux répétitions en réserve** (`BENCHMARK_RESERVE_REPS = 2`) : la première doit pouvoir faire
  `(bas + 2) / (1 − φ)^(x − 1)` répétitions (`capacityForSets`), `x` étant le nombre de séries. Pour une seule série c'est « bas + 2 » :
  10 pour un 8 – 12, 17 pour un 15 – 20, 22 pour un 20. Pour trois séries d'un 8 – 12 à 10 % de fatigue : 12,3. La capacité exigée est
  plafonnée à 30 (le domaine de la formule) ; la charge est ensuite le max divisé par `1 + capacité / 30`.
  *(La v2.12.2 plafonnait à 12 répétitions : un 15 – 20 recevait la charge d'une série de 12 — bien trop lourde. La reprise l'a d'abord
  fait suivre la fourchette, puis les séries : pour un 8 – 12 sur trois séries, le calcul d'une série seule proposait 77,5 kg là où
  72,5 kg tiennent les trois.)*
- **Combien de séries** (`plannedSets`) : celles de travail de la routine, six au plus — au-delà personne ne les mène toutes près de
  l'échec. Les échauffements ne comptent pas. **Une pyramide compte pour une série** : dès que les séries de travail portent deux charges
  différentes, la routine ne dit pas « la même charge, plusieurs fois » ; la première est dimensionnée pour elle-même et les autres
  suivent du même écart, comme l'écriture le fait. Une routine qui n'en dit rien (échauffement seul, exercice sorti de la routine) reçoit le
  défaut de sa classe : **3 séries pour un polyarticulaire, 2 pour une isolation** (`BENCHMARK_DEFAULT_SETS`) — un ordre de grandeur, pas
  une règle.
- **La fatigue d'une série à l'autre** (`setFatigue`) : 10 % de la capacité par série pour un polyarticulaire reposé deux minutes ; 8 %
  pour une isolation (un muscle seul, peu de fatigue générale) ; et d'autant plus que le repos est court — facteur `120 / repos`,
  borné à 0,6 (au-delà de trois minutes) et 2 (en dessous d'une minute). Le repos est celui de l'exercice dans la séance de benchmark
  (celui de la routine, puis celui de l'exercice, puis 120 s). **Ces chiffres sont au pif**, comme les « 3 et 2 séries » de la demande :
  des constantes nommées, à juger à l'usage.
- **Polyarticulaire ou isolation** (`exerciseClass`) : la famille de mouvement que le catalogue porte déjà (`movementPattern`) — poussée,
  tirage, squat, charnière, fente sont polyarticulaires ; les six familles d'isolation le sont par leur nom. « Autre » et l'absence de
  famille (un exercice personnel) se lisent par les muscles : le corps entier ou deux muscles secondaires et plus font un
  polyarticulaire ; sans rien du tout, polyarticulaire — la lecture qui fatigue le plus, donc la plus prudente.
- **Estimation approximative.** Convertir 22 répétitions en 17 est une petite extrapolation ; convertir 25 en 7 n'est plus une mesure.
  À plus de six répétitions de la capacité exigée de la première série (`BENCHMARK_ROUGH_GAP`), la charge est proposée mais **dite
  approximative** : son interrupteur est éteint d'office (la personne le rallume), et le coach n'en tire pas d'objectif. Le seuil se juge
  sur la fourchette et les séries de chaque exercice : 22 répétitions sont proches d'un 15 – 20 sur deux séries, loin d'un 5.
- **Arrondi vers le bas, jamais vers le haut.** Sur la grille du matériel quand le pas est celui de la table ; à partir de la charge
  essayée quand le pas est celui que la personne a saisi sur l'exercice (un cran de 1,125 kg ne tombe pas sur un multiple de 1,125 —
  cf. `resolveLoadStep`). Le benchmark ne propose jamais plus que ce que le maximum autorise.
- **Seul `weight_reps` reçoit une charge.** Pour un exercice lesté ou assisté, la charge n'est qu'une partie de ce qui est soulevé ; le
  pas d'une cible de temps n'a pas de sens. Ces exercices ont leur résultat dans le bilan (répétitions, durée), sans proposition.

Exemple : 80 kg × 17 sur un 15 – 20, trois séries. Max estimé : 125,3 kg. Polyarticulaire reposé deux minutes : la première série doit
pouvoir faire 17 / 0,9² = 21 répétitions → 125,3 / (1 + 21 / 30) = 73,7 → **72,5 kg**. Une isolation (8 %) : 20,1 répétitions → 75,1 →
**75 kg**. Même exercice avec une minute de repos (20 %) : 26,6 répétitions → 66,5 → **65 kg** ; avec trois minutes (6,7 %) : **75 kg**.

### 4. Le bilan et l'écriture

Écran `/benchmark/:workoutId`, atteint à l'enregistrement de la séance (qui, pour un benchmark, ne passe
pas par l'évaluation de séance du coach, mais lui fait lire le benchmark — §2 bis) et depuis le détail de la séance dans
l'historique. Il se recalcule en direct : pour chaque exercice, la fourchette de la routine, ce qui a été fait, le 1RM estimé, la
charge conseillée (« Pour 3 séries : environ 12 répétitions à fond à la première, 2 en réserve à la dernière ») contre la cible actuelle
de la routine — et, pour une estimation approximative, pourquoi elle l'est.

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
Les deux ouvrent `BenchmarkLaunchSheet`, qui ne peut donc pas dire deux choses différentes. Une feuille d'explication (trois phrases : une série par exercice, choisis la charge
avec laquelle tu penses faire la fourchette de l'exercice dans la routine — 8 – 12, 15 – 20, 20… —, va jusqu'à l'échec ; plus l'essai
en est loin, moins la charge est fiable ; le coach en déduit la charge de toutes les séries de la routine) précède le lancement. Aucun rappel, aucune
périodicité : c'est un geste que la personne décide.

## Ce qui n'est pas fait, et pourquoi

- Pas de comparaison entre deux benchmarks : une seule série à l'échec est un point bruité, et une courbe
  de points bruités fabrique des tendances. Les 1RM estimés restent lisibles dans les courbes existantes.
- Pas de benchmark pour les exercices en temps ou à distance : « le plus longtemps possible » n'a pas de
  charge à en tirer, et l'enregistrer comme un test de force serait mentir sur ce qu'il mesure.
- Pas de réglage de la réserve de répétitions : une constante nommée, changeable en un endroit, tant
  que personne n'a montré qu'elle était fausse. Il en va de même du seuil d'écart de six répétitions et de la limite de 30, de la
  fatigue par série, de ses bornes de repos, du plafond de six séries et des séries par défaut.
- **Le coach ne propose pas le nombre de séries.** Il dimensionne la charge sur celles que la routine porte (ou, à défaut, 3 / 2 par
  classe) ; il n'écrit jamais « fais 3 séries ». *Tranché avec la personne* : la demande disait « extrapole la meilleure charge sur x
  séries, par exemple 3 sur les poly-articulaires, 2 sur les isolations » ; interrogée, elle ne savait pas combien (« JSP, tu proposes
  quoi ? ») et a validé la proposition — 3 / 2 en défaut seulement, jamais écrit. Le nombre de séries d'un muscle est déjà l'affaire de R6
  (volume par muscle, bornes qui viennent de ce que la personne tient) ; une série à l'échec ne dit pas combien de séries elle récupère.
- Pas de mesure de la fatigue réelle : la perte de 10 % par série est un modèle, pas la courbe de la personne. Une variante du
  benchmark à deux séries par exercice la mesurerait, au prix du principe « une série par exercice ».
- Pas de fourchette affichée **pendant** la séance de benchmark : elle se lit sur le bilan et dans la feuille de lancement. La poser
  sur la ligne de série (la cible de répétitions) rouvrirait le défaut des répétitions proposées (§1) ; l'afficher à part demande
  de la plomberie qu'aucun défaut n'a encore justifiée.
- Pas de lien du coach vers un 1RM stocké, ni vers les séances de programme : voir §2 bis.
