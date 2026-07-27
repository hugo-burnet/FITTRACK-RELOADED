# Import Hevy — associations d’exercices et création de routines

**Date :** 2026-07-27  
**Statut :** conception validée

## Objectif

Réduire fortement les corrections manuelles lors de l’association des exercices d’un export
Hevy, puis reconstruire automatiquement les routines présentes dans cet export.

L’ensemble reste local-first, sans réseau, sans compte et sans quota. Les écritures de l’import
restent atomiques : un échec ne doit laisser ni séance, ni exercice, ni dossier, ni routine
partiellement créé.

## Périmètre

- améliorer les suggestions à partir des intitulés Hevy français, anglais ou mixtes ;
- confirmer automatiquement uniquement les correspondances exactes et sûres ;
- conserver la confirmation manuelle pour les rapprochements ambigus ;
- créer un dossier daté contenant une routine par nom de séance Hevy ;
- ne jamais modifier une routine FitTrack préexistante ;
- ne pas reconstruire les supersets.

La modification des routines après import reste assurée par l’éditeur existant.

## Association des exercices

### Alias canoniques

Une table locale associe les intitulés Hevy connus aux `slug` stables du catalogue FitTrack.
Les clés sont normalisées comme les titres d’import : casse, accents, ponctuation et pluriels
ne doivent pas empêcher une correspondance.

Exemples :

- `Dead Hang` → `dead-hang` ;
- `Tirage vers Visage` → `face-pull` ;
- `Extension Jambes` → `leg-extension` ;
- `Chest Press (Machine)` → `machine-chest-press` ;
- `Planche Latérale` → `side-plank`.

Un alias exact vers un exercice vivant et compatible est considéré comme sûr et préconfirmé.
La cible est retrouvée par `slug`, jamais par identifiant généré. Si le catalogue ne contient
plus cette cible, l’import retombe sur le classement approximatif.

### Classement approximatif

Le classement de secours conserve la compatibilité de mesure, puis combine :

- synonymes français/anglais ;
- similarité des mots du mouvement ;
- ordre et proximité des expressions ;
- compatibilité du matériel ;
- pénalité forte lorsque le titre nomme explicitement un matériel différent.

Une égalité ou un score faible ne doit plus produire une fausse certitude. Dans ce cas, le
meilleur candidat reste visible comme proposition, mais la ligne demeure à confirmer.

Les associations déjà mémorisées gardent la priorité lorsqu’elles pointent vers un exercice
vivant et compatible.

### Cas sans cible fiable

Les mouvements absents du catalogue, par exemple une variante personnelle ou un appareil très
spécifique, restent proposés à la création comme exercices personnalisés. Aucun rapprochement
approximatif n’est préconfirmé.

## Reconstruction des routines

### Regroupement

Les séances sont regroupées par titre normalisé : espaces superflus supprimés et comparaison
insensible à la casse. `UPPER A`, `Upper A` et ` upper   a ` forment donc une seule famille.
Le nom affiché de la routine reprend le titre de la séance de référence.

### Choix de la séance de référence

Pour chaque famille :

1. trier les séances de la plus récente à la plus ancienne ;
2. conserver au maximum les cinq plus récentes ;
3. choisir celle qui possède le plus grand nombre d’exercices distincts ;
4. en cas d’égalité, choisir la plus récente.

Cette règle évite qu’une ancienne variante abandonnée domine tout l’historique, tout en résistant
à une dernière séance exceptionnellement raccourcie. Une seule séance disponible devient
naturellement la référence.

La routine reprend exactement l’ordre des exercices de cette séance. Tous les
`supersetGroup` sont fixés à `0`.

### Séries planifiées

Chaque exercice reçoit le même nombre de séries que dans la séance de référence. Le type de série
(`normal`, `warmup`, `dropset`, `failure`) est conservé.

Les cibles réutilisables sont copiées selon la mesure :

- répétitions réalisées → `targetReps` ;
- durée réalisée → `targetDurationSeconds` ;
- distance réalisée → `targetDistanceMeters`.

Les poids et le RPE réalisés ne deviennent pas des objectifs de routine. Ils décrivent une
performance passée et risqueraient de figer une charge devenue obsolète. Le repos utilise le
comportement par défaut de l’exercice, car le CSV Hevy ne fournit pas un repos de routine fiable.

## Dossier d’import

Lorsqu’au moins une séance du fichier est réellement importable, l’action finale crée un nouveau
dossier nommé :

`Import Hevy — JJ/MM/AAAA`

Si ce nom existe déjà, le premier suffixe disponible est ajouté : `(2)`, `(3)`, etc. Toutes les
routines reconstruites pendant cette opération appartiennent à ce dossier.

Si toutes les séances sont déjà présentes, aucun dossier ni aucune routine n’est créé. Une
importation partielle crée en revanche son propre dossier, conformément au principe d’un dossier
par opération d’import effective.

## Transaction et flux de données

Après validation de toutes les associations :

1. recalculer les séances réellement importables dans la transaction ;
2. résoudre ou créer les exercices ;
3. construire les séances et séries historiques ;
4. sélectionner les séances de référence parmi les séances réellement importables ;
5. créer le dossier, les routines, leurs exercices et leurs séries planifiées ;
6. mémoriser les associations Hevy ;
7. écrire tous les objets dans une transaction Dexie unique.

La transaction couvre `exercises`, `workouts`, `workoutExercises`, `workoutSets`, `routineFolders`,
`routines`, `routineExercises`, `routineSets` et `settings`.

Le résultat final annonce séparément les séances importées, les séances ignorées, les exercices
personnalisés créés et les routines créées.

## Interface

L’étape d’association conserve son fonctionnement actuel :

- association sauvegardée : cochée ;
- alias canonique exact : coché et identifié comme détection sûre ;
- suggestion approximative : cercle vide jusqu’à confirmation ;
- absence de cible fiable : création personnalisée disponible.

La revue finale affiche le nom du dossier et la liste des routines qui seront créées. Aucun écran
supplémentaire n’est nécessaire.

## Tests et critères d’acceptation

Les tests purs couvrent :

- les 24 intitulés du fichier Hevy de validation, sans conserver d’autres données personnelles ;
- les alias exacts, les synonymes, le matériel et les faibles confiances ;
- une cible supprimée ou une mesure incompatible ;
- le regroupement insensible à la casse et aux espaces ;
- la fenêtre des cinq séances récentes ;
- le maximum d’exercices puis le départage par récence ;
- l’ordre, les types et les cibles des séries ;
- l’absence de supersets et de poids cibles ;
- les collisions de noms de dossiers ;
- aucune création de routine lors d’une réimportation totalement dupliquée ;
- le rollback intégral sur erreur.

Le checkpoint manuel vérifie sur téléphone :

1. les associations proposées pour plusieurs titres auparavant incorrects ;
2. les quelques variantes réellement absentes laissées à confirmer ou à créer ;
3. la création du dossier daté et des routines `LOWER A`, `LOWER B`, `UPPER A`, `UPPER B` ;
4. l’ordre et le nombre de séries d’une routine ;
5. l’absence de doublon de dossier lors de la réimportation complète du même fichier ;
6. le fonctionnement hors ligne après rechargement.
