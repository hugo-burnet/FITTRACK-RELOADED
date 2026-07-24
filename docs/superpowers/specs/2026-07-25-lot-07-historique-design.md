# Lot 07 — Historique, calendrier et import Hevy

**Date :** 2026-07-25

**Statut :** design validé

**RF couverts :** RF-32, RF-33, RF-34, RF-35, RF-36

**Extension validée :** import hors-ligne du CSV `workout_data.csv` exporté par Hevy

## 1. Objectif

Le Lot 07 transforme l’onglet Historique, encore vide, en outil complet pour :

- parcourir toutes les séances terminées, sans limite temporelle ;
- retrouver une séance par date ou par exercice ;
- consulter, corriger ou supprimer une séance archivée ;
- suivre une régularité hebdomadaire définie par l’utilisateur ;
- importer l’historique Hevy depuis son export CSV officiel.

L’ensemble reste local-first. La consultation, l’édition et le calcul du streak ne dépendent
d’aucun réseau. L’import lit un fichier choisi sur l’appareil et n’envoie rien à un serveur.

## 2. Direction d’interface validée

### 2.1 Structure générale

L’écran `/history` reprend exclusivement les primitives et jetons déjà présents dans FitTrack :

- `Screen` pour l’en-tête, le défilement et la navigation basse ;
- `HeaderAction` pour l’import, représenté par une icône et jamais par un mot ;
- `Card` et `ListRow` pour les séances ;
- `SectionTitle` pour les mois et les dates ;
- `FilterChip` et `OptionSheet` pour le filtre par exercice ;
- surfaces `--surface-0`, `--surface-1`, `--surface-2`, sans gradient ni ombre ;
- accent `--accent-ink` réservé aux états engagés.

Le contenu se divise en deux vues nettes dans le même écran :

1. **Journal**, ouvert par défaut : liste chronologique des séances ;
2. **Calendrier** : mois complet, jours entraînés marqués, puis séances du jour choisi.

Le sélecteur de vue reste plat sur le fond de page. La vue active reçoit le filet mécanique
de 3 px déjà utilisé par la navigation basse. Il ne prend pas la forme d’un contrôle segmenté
générique.

### 2.2 Carte de régularité

Une `Card` placée avant le sélecteur de vue contient deux relevés :

- streak hebdomadaire courant ;
- progression de la semaine vers l’objectif choisi.

L’objectif n’est jamais codé en dur. La table `settings` stocke une valeur entière de 1 à 7.

À la première ouverture, tant que le réglage est absent :

- le streak affiche `—` ;
- la seconde case affiche **Définir** et **Objectif hebdo** ;
- un texte explique : « Choisis ton rythme pour suivre ta régularité. »

Un appui sur cette case ouvre une feuille « Séances par semaine ». Après sélection, par exemple
4, la carte affiche `3 / 4` et quatre encoches, dont trois engagées. Un nouvel appui rouvre la
même feuille. Le nombre d’encoches suit l’objectif de 1 à 7.

Une semaine va du lundi 00:00 au dimanche 23:59:59 dans le fuseau local. Une semaine close
compte dans le streak si son nombre de séances terminées atteint l’objectif. La semaine en cours :

- ajoute une semaine au streak dès que l’objectif est atteint ;
- ne casse jamais le streak avant sa clôture ;
- affiche en permanence la progression `réalisé / objectif`.

Changer l’objectif recalcule le streak sur tout l’historique avec la nouvelle valeur. Le Lot 07
ne versionne pas les objectifs successifs : il décrit le rythme actuel de l’utilisateur, pas une
planification périodisée.

### 2.3 Journal

Le journal groupe les séances par mois décroissant. Chaque séance est une `ListRow` contenant :

- nom de la séance ;
- date locale abrégée ;
- durée ;
- nombre d’exercices ;
- nombre de séries validées ;
- chevron vers le détail.

La liste charge 20 séances à la fois. Une ligne pleine largeur « Afficher plus » charge la page
suivante. Cette pagination limite seulement le travail de rendu ; elle ne limite jamais
l’historique conservé ou consultable.

Le filtre « Tous les exercices » ouvre un `OptionSheet`. Une sélection conserve uniquement les
séances qui contiennent cet exercice. L’état vide nomme le filtre actif et propose de revenir à
tous les exercices.

### 2.4 Calendrier

Le calendrier affiche un mois lundi–dimanche. Chaque jour reste une cible tactile d’au moins
48 px. Les jours qui contiennent une séance portent une encoche accent sous le nombre, motif
cohérent avec l’icône Calendrier et la marque d’onglet. Le jour sélectionné utilise un aplat accent
avec `--color-accent-fg`.

Sous le mois :

- aucun jour sélectionné : aucune carte supplémentaire ;
- jour vide sélectionné : message bref « Aucune séance ce jour » ;
- jour entraîné sélectionné : `SectionTitle` avec la date longue, puis une `Card` de séances.

Les flèches de mois sont des cibles de 48 px. Le filtre par exercice s’applique aussi aux marques
du calendrier et aux séances du jour.

## 3. Détail, édition et suppression

### 3.1 Détail archivé

La route `/history/:workoutId` lit `getWorkoutDetail`. Elle affiche :

- nom, date, heure de début et durée ;
- notes de séance ;
- exercices dans leur ordre ;
- séries validées avec type, charge, répétitions, distance, durée et RPE pertinents ;
- totaux recalculés par les fonctions pures existantes.

Le coin haut droit ouvre une `ActionSheet` avec **Modifier** et **Supprimer**. Il n’y a ni minuteur,
ni rail de repos, ni commandes propres à une séance active.

### 3.2 Édition rétroactive

La route `/history/:workoutId/edit` réutilise les composants de saisie du Lot 05 quand leur contrat
est identique, mais ne réutilise pas l’écran de séance active comme un bloc monolithique.

L’édition couvre :

- nom, notes, date, heure de début et durée ;
- ajout, suppression et réordonnancement d’exercices ;
- ajout, suppression et réordonnancement de séries ;
- type de série, charge, répétitions, distance, durée et RPE.

Les changements vivent dans un brouillon local jusqu’à **Enregistrer**. Le repository applique
alors la modification dans une transaction Dexie unique. Fermer l’écran sans enregistrer demande
confirmation si le brouillon a changé.

Les records restent dérivés de `workoutSets`, comme au Lot 06. Aucune ligne n’est ajoutée à
`personalRecords`. Après une édition, un déclassement en échauffement ou une suppression, les
requêtes `useLiveQuery` relisent les séries et les records se corrigent sans cascade persistée.

### 3.3 Suppression

La suppression demande une confirmation qui nomme la séance et la date. Elle appelle la suppression
logique transactionnelle existante pour la séance, ses exercices et ses séries. Le retour au journal
ne se fait qu’après la réussite de la transaction.

## 4. Import CSV Hevy

### 4.1 Format accepté

Le Lot 07 accepte le fichier `workout_data.csv` exporté par Hevy. Le fichier réel fourni pour le
design contient 90 lignes, 4 séances et les colonnes :

`title`, `start_time`, `end_time`, `description`, `exercise_title`, `superset_id`,
`exercise_notes`, `set_index`, `set_type`, `weight_kg`, `reps`, `distance_km`,
`duration_seconds`, `rpe`.

Le parseur pur valide l’en-tête avant toute écriture. Il accepte les nombres décimaux au point ou
à la virgule et les dates françaises telles que `24 juil. 2026, 15:05`. Les dates sans fuseau sont
interprétées dans le fuseau local de l’appareil, puis stockées en epoch millisecondes. Le lecteur
respecte les champs CSV RFC 4180 : guillemets, virgules et retours à la ligne dans les notes ne
cassent pas une séance.

Les types de séries Hevy connus sont traduits explicitement vers les types FitTrack. Une valeur
inconnue produit une erreur de ligne ; elle n’est jamais ramenée silencieusement à `normal`.

### 4.2 Flux

L’action d’en-tête suit ce parcours :

1. choisir le CSV sur l’appareil ;
2. parser et regrouper les lignes par `title + start_time + end_time` ;
3. présenter le nombre de séances, exercices et séries détectés ;
4. associer chaque nom d’exercice Hevy à un exercice FitTrack ;
5. vérifier le récapitulatif ;
6. importer dans une transaction unique.

Un import invalide n’écrit rien. La page d’erreur indique les numéros de ligne et la cause.

### 4.3 Association des exercices

Les 24 noms distincts du fichier réel ne correspondent exactement à aucun nom du catalogue
FitTrack, bien que la plupart décrivent les mêmes mouvements. Une association guidée est donc
obligatoire.

Pour chaque nom Hevy :

- FitTrack propose le meilleur candidat après normalisation des accents, du pluriel, de la casse
  et des mentions de matériel ;
- l’utilisateur peut chercher et choisir un autre exercice ;
- l’utilisateur peut créer un exercice personnalisé.

Une création automatique infère le `measurementType` à partir des colonnes remplies :

- poids + répétitions → `weight_reps` ;
- répétitions seules → `reps_only` ;
- durée seule → `time_only` ;
- distance + durée → `distance_time` ;
- poids + durée → `weight_time`.

Le matériel est inféré seulement lorsqu’une mention non ambiguë existe dans le nom. Sinon il vaut
`other`. Le groupe principal vaut `other` et reste modifiable depuis la fiche exercice. Aucun
muscle n’est inventé.

Les associations sont mémorisées dans `settings` sous une clé dédiée afin qu’un export Hevy
ultérieur n’impose pas de refaire les mêmes choix.

### 4.4 Écriture et réimport

Chaque séance importée devient un `Workout` terminé. Ses horaires Hevy alimentent `startedAt`,
`endedAt` et `durationSeconds`. Les exercices et séries conservent leur ordre, leurs notes et leurs
supersets. L’ordre des exercices suit leur première apparition dans le fichier ; `set_index` ordonne
les séries à l’intérieur de chaque exercice. Les identifiants de superset Hevy sont remappés vers
des entiers FitTrack consécutifs dans chaque séance. `description` devient la note de séance et
`exercise_notes` la note du bloc d’exercice.

Les kilogrammes restent des kilogrammes. `distance_km` est converti en mètres à l’unique frontière
d’import. Chaque série reçoit un `performedAt` déterministe et strictement croissant entre le début
et la fin de la séance.

`Workout` reçoit deux champs facultatifs non indexés :

- `importSource?: 'hevy_csv'` ;
- `importKey?: string`.

`importKey` dérive du titre et des horaires Hevy. Il permet de réimporter un export complet :
les séances déjà présentes sont annoncées puis ignorées. Comme les champs ne sont pas indexés,
aucune migration Dexie n’est nécessaire ; la détection parcourt seulement les séances importées
déjà présentes.

Le résultat final indique séparément les séances importées et ignorées.

## 5. Frontières de code

Les responsabilités prévues sont :

- `src/lib/history.ts` : semaines locales, streak, regroupements calendaires ;
- `src/lib/hevyCsv.ts` : validation, parsing, normalisation et regroupement du CSV ;
- `src/data/repositories/history.ts` : pages de journal, mois, filtre, mutations archivées ;
- `src/data/repositories/hevyImport.ts` : lecture des doublons et transaction d’import ;
- `src/features/history/*` : écrans, cartes, calendrier, détail, édition et assistant d’import ;
- `src/data/repositories/settings.ts` : objectif hebdomadaire et associations Hevy.

`lib/` reste pur, sans Dexie ni React. Aucun composant n’importe `db`.

Le repository `workouts.ts`, déjà au-delà de 600 lignes, ne reçoit pas la logique du Lot 07.
Les opérations archivées vivent dans `history.ts`; les opérations de séries partagées pourront
être extraites dans `workoutSets.ts` si l’implémentation révèle une vraie duplication.

## 6. Erreurs et états limites

- Une requête `useLiveQuery` non résolue n’affiche pas prématurément un état vide.
- Une séance supprimée pendant que sa fiche est ouverte revient au journal avec un message clair.
- Une date importée invalide, une colonne absente ou un type inconnu bloque l’import avant écriture.
- Une association d’exercice non résolue bloque le bouton final d’import.
- Une transaction d’édition ou d’import échouée laisse l’état précédent intact.
- Les séries d’échauffement restent exclues du volume, des records et des totaux de travail.
- Les séances importées hors du mois courant apparaissent immédiatement dans le journal, le
  calendrier, le filtre d’exercice et le streak.

## 7. Stratégie de tests

La logique métier est développée en TDD.

Tests unitaires purs :

- bornes lundi–dimanche, changement de mois et d’année ;
- streak sans objectif, semaine en cours, semaine close, changement d’objectif ;
- regroupement journal/calendrier et filtre exercice ;
- parsing de dates Hevy françaises ;
- champs CSV entre guillemets, virgules et retours à la ligne dans les notes ;
- décimales point/virgule et cellules vides ;
- cinq formes de mesure inférées et mesure assistée conservée lors d’une association à un exercice
  FitTrack de type `assisted_weight_reps` ;
- types de séries et rejet d’un type inconnu ;
- regroupement des lignes en séances, exercices et séries ;
- conversion kilomètres → mètres et remappage des supersets ;
- suggestion d’association et création personnalisée ;
- génération stable de `importKey`.

Tests de repositories avec `fake-indexeddb` :

- pagination sans perte ni doublon ;
- filtre par exercice ;
- édition atomique d’une séance archivée ;
- suppression logique en cascade ;
- import atomique et rollback ;
- réimport idempotent ;
- records et dernière performance corrigés après édition ou suppression.

Parcours navigateur :

- définir puis modifier l’objectif hebdomadaire ;
- basculer Journal/Calendrier et sélectionner une date ;
- filtrer sur un exercice ;
- importer le CSV Hevy réel comme fixture anonymisée ;
- corriger une série importée et vérifier les totaux ;
- supprimer une séance ;
- recharger hors-ligne et retrouver toutes les données.

## 8. Hors périmètre

- Import par lien public Hevy ou API Hevy ;
- synchronisation continue avec Hevy ;
- import de `measurement_data.csv`, réservé au lot Mesures corporelles ;
- graphiques de progression, heatmap musculaire et statistiques avancées ;
- objectifs hebdomadaires historisés ou variables selon les phases du programme ;
- réseau, compte ou backend.

Ces exclusions ne limitent pas les données conservées. Elles maintiennent le Lot 07 centré sur
la consultation et la correction du passé, avec un chemin d’entrée fiable pour l’historique Hevy.
