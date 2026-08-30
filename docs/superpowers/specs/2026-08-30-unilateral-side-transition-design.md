# Libérer automatiquement la coche du second côté

## Contexte

Sur une série unilatérale, la première coche termine le premier côté et persiste l’échéance du second côté dix secondes plus tard. Pendant cette transition, la coche est désactivée et grisée pour absorber les doubles appuis.

Sans cadence active, la coche reste parfois désactivée après l’échéance. Ouvrir un menu la débloque, car cette interaction provoque un nouveau rendu de l’écran.

## Cause racine

`WorkoutSetRow` entretient déjà une horloge locale rafraîchie toutes les 250 ms pour afficher le décompte. Cependant, son état désactivé lit `sideStage`, valeur calculée par le composant parent à son dernier rendu. L’horloge locale change le nombre affiché, mais ne recalcule pas ce stade. Sans cadence ou autre interaction pour redessiner le parent, la valeur reste donc `transition` après la dixième seconde.

Le test d’intégration existant ne couvre pas cette attente naturelle : il déplace l’échéance directement en base, ce qui provoque précisément le nouveau rendu qui manque en usage réel.

## Comportement attendu

- La première coche persiste l’échéance et termine uniquement le premier côté.
- La coche reste désactivée et visuellement grisée pendant dix secondes.
- À l’échéance, elle devient automatiquement active et son libellé annonce la validation du second côté.
- Ce passage fonctionne avec ou sans cadence, sans ouvrir de menu et sans écrire une seconde fois en base.
- La transition continue de survivre à l’écran éteint, à un appel ou à un redémarrage de l’application grâce à son échéance absolue persistée.

## Conception

La ligne de série doit dériver son stade effectif depuis la série persistée, le caractère unilatéral de l’exercice et son horloge locale. Le calcul reste assuré par `sideStageFor`, déjà responsable des règles premier côté / transition / second côté.

`WorkoutExerciseCard` passe à `WorkoutSetRow` le booléen unilatéral déjà présent dans l’identité instantanée de l’exercice. La ligne ne reçoit plus un stade pré-calculé pour sa coche. Les rails de cadence et de maintien peuvent continuer à utiliser `sideStageOf`, car ils possèdent leurs propres horloges et ne commandent pas l’état interactif de la coche.

L’intervalle existant reste limité à la transition et s’arrête à l’échéance. Aucun minuteur global, aucun nouveau magasin Zustand et aucune écriture Dexie à la dixième seconde ne sont ajoutés.

## Tests

Un test de composant de `WorkoutSetRow` utilise une horloge contrôlée :

1. il rend une série unilatérale dont le second côté commence dans dix secondes ;
2. il vérifie que la coche est désactivée pendant la transition ;
3. il avance l’horloge sans redessiner le parent ;
4. il vérifie que la coche devient active avec le libellé du second côté.

Le test doit échouer avec le code actuel, puis réussir après le correctif. La suite unilatérale existante reste verte pour garantir la persistance, l’absence de double validation et l’unique série enregistrée.

## Hors périmètre

- Aucun changement de la durée de dix secondes.
- Aucun changement du comportement des exercices bilatéraux ou des échauffements.
- Aucun changement des cadences, des annonces ou des minuteurs de repos.
- Aucun changement visuel au-delà de l’état désactivé déjà prévu.
- Aucun changement des badges ou des paliers.
