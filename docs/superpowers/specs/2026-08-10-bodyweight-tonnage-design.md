# Tonnage des exercices au poids du corps — Design

**Date :** 2026-08-10
**Statut :** validé oralement, en attente de revue du document
**Périmètre :** poids corporel daté, charge corporelle effective et recalcul de tous les tonnages

## Objectif

Une traction, une pompe ou un squat au poids du corps ne doit plus produire automatiquement
`0 kg` de tonnage. FitTrack doit connaître le poids corporel de l’utilisateur, appliquer un
coefficient propre au mouvement et conserver une seule définition du tonnage pour l’écran de fin,
l’historique, les analyses et les exports.

Le chiffre reste une **estimation de charge déplacée**, pas une mesure biomécanique exacte ni un
score de qualité. La copie de l’interface doit le dire sans alourdir la saisie en salle.

## Décisions structurantes

### 1. Le coefficient appartient à l’exercice

`Exercise` reçoit un champ optionnel `bodyweightLoadFactor?: number`. Une valeur comprise entre
`0` et `1` représente la part estimée du poids corporel déplacée par répétition. L’absence du champ
signifie que l’exercice ne contribue pas au tonnage corporel.

Le coefficient n’est jamais déduit du nom français. Les exercices du catalogue sont rattachés par
leur `slug`, et les exercices personnalisés peuvent porter leur propre valeur.

`WorkoutExercise` reçoit le snapshot optionnel `exerciseBodyweightLoadFactor?: number`. Le snapshot
gagne sur la bibliothèque actuelle, comme les quatre autres propriétés d’identité. Une séance
ancienne sans snapshot retombe sur la valeur actuelle de l’exercice pour pouvoir être réparée sans
migration destructive.

### 2. Coefficients livrés

| Coefficient | Exercices du catalogue | Justification pratique |
|---:|---|---|
| `1.00` | traction pronation, traction supination, dips buste penché, dips buste droit, pompes en équilibre, traction assistée, dips assistés | le corps entier se déplace et l’assistance éventuelle est déjà soustraite |
| `0.70` | pompes, pompes diamant, rowing australien, dips entre deux bancs | mouvement en appui : seule une partie du poids est portée par le haut du corps |
| `0.90` | squat au poids du corps, pistol squat, sissy squat, mollets au poids du corps, burpee | quasi-totalité du corps déplacée, avec les segments en appui exclus de l’approximation |
| absent | crunch, dead bug, relevés de jambes/genoux, pont fessier, Nordic curl, extensions au banc et autres mouvements segmentaires ou isométriques | aucune conversion simple et honnête en kilogrammes par répétition |

Le `0.70` des pompes est un arrondi stable des mesures publiées autour de 69–75 % selon la position
dans la répétition ([Suprak et al., 2011](https://pubmed.ncbi.nlm.nih.gov/20179649/)). Les valeurs
sont volontairement lisibles et versionnables ; elles ne prétendent pas modéliser la morphologie ou
l’amplitude de chaque utilisateur.

Le semis réconcilie ces coefficients sur les exercices livrés, comme il réconcilie déjà leur
classification musculaire. Il ne touche jamais aux exercices personnalisés.

### 3. Formule unique

`sessionTotals` reste l’unique définition du tonnage. Chaque `VolumeEntry` transporte le rôle du
poids et, s’il existe, le coefficient corporel de l’exercice. La fonction reçoit le poids corporel
applicable à la séance.

Pour une série de travail comportant des répétitions :

```text
charge classique = charge saisie
poids du corps    = poids corporel × coefficient
lesté             = poids corporel × coefficient + lest saisi
assisté            = max(poids corporel × coefficient − assistance saisie, 0)
tonnage série      = charge effective × répétitions
```

Règles complémentaires :

- sans poids corporel connu ou sans coefficient, la part corporelle vaut zéro ;
- un lest externe saisi reste compté même si la part corporelle ne peut pas encore être résolue ;
- une traction sans lest compte donc dès que le poids corporel est connu ;
- un lest ou une assistance vide vaut zéro ;
- une assistance supérieure à la charge corporelle effective ne produit jamais de tonnage négatif ;
- les échauffements restent exclus via `isWorkingSet` ;
- les exercices en temps ou distance ne créent pas de tonnage ;
- les charges classiques gardent exactement leur calcul actuel ;
- l’arrondi final reste au centième de kilogramme.

## Poids corporel daté

La table Dexie `bodyMeasurements`, déjà présente, devient la source de vérité. Un poids est une
`BodyMeasurement` vivante avec :

```ts
type: 'body_weight';
unit: 'kg';
value: number;
measuredAt: number;
```

Un dépôt dédié, sans accès direct à `db` depuis les composants, possède les opérations suivantes :

- lire la dernière valeur enregistrée ;
- enregistrer le poids du jour ;
- remplacer la valeur du même jour local plutôt que créer des doublons à chaque correction ;
- résoudre en une lecture les poids applicables à une liste de dates de séances.

La validation accepte tout nombre fini strictement positif. Elle n’impose pas de maximum arbitraire.

Pour une séance, le poids applicable est la dernière mesure vivante dont `measuredAt` est inférieur
ou égal à `workout.startedAt`. Lorsqu’une séance précède la toute première mesure, FitTrack utilise
la première valeur connue : cette approximation permet de recalculer immédiatement l’historique
existant après la première saisie. Une future interface de mensurations pourra ajouter des valeurs
rétrodatées et affiner automatiquement les périodes concernées.

## Saisie sur l’accueil

Une carte autonome `HomeBodyWeightCard` apparaît juste sous le résumé de la semaine et avant la
routine suggérée. Elle ne dépend pas de la requête du tableau de bord : une erreur de lecture des
routines ou de l’historique ne doit pas empêcher d’enregistrer son poids.

La carte contient :

- le titre « Poids du jour » ;
- la dernière valeur comme brouillon initial et sa date de mesure ;
- un `NumberInput` en kilogrammes, avec virgule décimale et cible tactile existante ;
- une action « Enregistrer » d’au moins 48 px ;
- un état de confirmation discret et un message d’échec réessayable ;
- une phrase courte indiquant que ce poids sert à estimer le tonnage des exercices au poids du corps.

Le bouton est désactivé si la valeur est vide, non positive, identique à la valeur déjà enregistrée
aujourd’hui, ou pendant l’écriture. Tous les textes vivent dans `src/i18n/fr.ts`.

Les exercices personnalisés de type `reps_only` ou `assisted_weight_reps` exposent dans leur
formulaire un champ « Poids corporel mobilisé » en pourcentage. Vide signifie « ne pas compter ».
Une assistance personnalisée démarre à 100 % ; un exercice `reps_only` personnalisé laisse le choix
explicite pour ne pas transformer automatiquement un crunch en charge complète.

## Propagation historique

La projection historique transporte :

- `HistoricalWorkout.bodyWeightKg?`, résolu à la date de la séance ;
- `HistoricalExercise.bodyweightLoadFactor?`, résolu depuis le snapshot puis la bibliothèque.

Les consommateurs existants appellent tous la même fonction `sessionTotals` avec ces deux données :

- écran de fin de séance ;
- détail d’une séance passée ;
- tonnage hebdomadaire ;
- métriques de progression par exercice ;
- export Markdown complet ou unitaire.

Aucune vue ne recalcule sa propre formule. Modifier le poids d’un jour ou ajouter une mesure
rétrodatée rafraîchit les lectures Dexie et les agrégats concernés.

## Compatibilité et données existantes

- Aucun nouvel index Dexie n’est nécessaire : les tables et index de mensurations existent déjà.
- Les nouveaux champs d’exercice et de snapshot sont optionnels ; aucune réécriture globale n’est
  requise au chargement.
- Le catalogue réconcilie seulement les coefficients qu’il possède.
- Les séances historiques sans snapshot utilisent le coefficient de la bibliothèque.
- Sans mesure de poids, le comportement reste sûr et identique : aucune charge corporelle inventée.
- L’import CSV reste compatible ; il peut recevoir les coefficients actuels de la cible choisie.

## Copie existante à corriger

Les textes affirmant que le tonnage exclut toujours le lest, l’assistance ou le poids du corps
deviennent faux. Ils sont remplacés par une explication cohérente : charges externes et charge
corporelle effective estimée, échauffements exclus. Le zéro sans poids connu invite à renseigner le
« Poids du jour » sur l’accueil au lieu de présenter la séance comme vide.

## Tests attendus

### Logique pure

- traction de 8 répétitions à 80 kg : `640 kg` ;
- traction lestée à `+10 kg` : `(80 + 10) × 8 = 720 kg` ;
- traction assistée à `−20 kg` : `(80 − 20) × 8 = 480 kg` ;
- pompes à 80 kg et coefficient `0.70` : `448 kg` pour 8 répétitions ;
- squats à 80 kg et coefficient `0.90` : `720 kg` pour 10 répétitions ;
- assistance supérieure au poids effectif : zéro, jamais négatif ;
- absence de poids ou de coefficient : zéro corporel ;
- lest externe sans poids corporel connu : seul le lest contribue ;
- charges classiques, temps, distance et échauffements inchangés.

### Dépôt de mensurations

- première saisie ;
- correction le même jour sans doublon ;
- nouvelle valeur un autre jour ;
- résolution avant, entre et après plusieurs mesures ;
- première valeur utilisée pour une séance plus ancienne ;
- mesures supprimées ignorées ;
- valeur vide, infinie, `NaN` ou non positive rejetée.

### Intégration

- la carte d’accueil charge, enregistre, confirme et récupère d’une erreur ;
- le catalogue existant reçoit ses coefficients sans modifier les exercices personnalisés ;
- le snapshot protège une séance après modification d’un exercice personnalisé ;
- écran de fin, historique, analyses et export annoncent le même tonnage ;
- l’historique passe de zéro à une estimation dès la première saisie de poids.

## Hors périmètre

- synchronisation Health Connect ou Apple Health ;
- écran complet de courbe des mensurations du Lot 11 ;
- estimation par taille, morphologie, amplitude, inclinaison ou capteurs ;
- tonnage des mouvements isométriques et des exercices segmentaires exclus ;
- modification manuelle des coefficients des exercices livrés dans cette première version ;
- changement de la logique des records personnels ou du 1RM.

## Checkpoint téléphone

Enregistrer son poids depuis l’accueil, terminer une séance contenant des pompes, des squats, des
tractions simples, lestées et assistées, puis vérifier que l’écran de fin, le détail historique et
la courbe hebdomadaire affichent le même total. Corriger le poids le même jour et confirmer que le
total change sans créer de doublon. Relancer l’application hors ligne et vérifier que la valeur et
les tonnages restent présents.
