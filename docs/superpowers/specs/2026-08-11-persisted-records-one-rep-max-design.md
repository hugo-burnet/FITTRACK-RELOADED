# Records persistés et 1RM estimé

> Spec de conception validée avec l’utilisateur le 2026-08-11.
> Périmètre : RF-10, RF-23, RF-41 et RF-46 ; consolidation anticipée du Lot 13.
> Direction visuelle : **A — le rail de progression**, choisie parmi trois maquettes.

---

## 1. Résultat attendu

FitTrack doit disposer d’une chronologie locale et persistée des records, reconstruisible à
partir de l’historique réel. Une page dédiée permet de lire cette progression dans le temps.
Le 1RM estimé rejoint les records et les graphiques pour les exercices mesurés en charge et
répétitions.

Cette tranche livre ensemble :

- une estimation pure du 1RM avec Epley, Brzycki et Lombardi ;
- une formule configurable, Epley par défaut ;
- la projection persistée de chaque marque initiale et de chaque amélioration ;
- la mise à jour incrémentale lors d’une nouvelle performance ;
- la reconstruction ciblée après modification de l’historique ;
- une reconstruction complète manuelle et idempotente ;
- une page « Records » avec filtres et chronologie ;
- l’intégration du 1RM à la fiche exercice, à la courbe et à la séance en direct.

Les fonctions sociales, classements entre personnes, objectifs de force, badges, prédictions
de date et recommandations d’entraînement restent hors périmètre.

---

## 2. Le contrat : une projection persistée, pas une seconde vérité

`workouts`, `workoutExercises`, `workoutSets` et les mesures corporelles restent les données
sources. `personalRecords` est une **projection persistée** de ces données : rapide à lire,
mais intégralement réparable.

Une modification rétroactive peut donc faire disparaître ou déplacer un ancien record. Ce
n’est pas la réécriture d’un journal immuable ; c’est la correction d’une chronologie qui doit
rester d’accord avec l’historique.

### 2.1 Première marque, amélioration et égalité

- La première performance qualifiante d’un type devient la **marque initiale** et est persistée.
- Elle ne déclenche pas la félicitation « record battu », puisqu’elle ne bat encore rien.
- Une performance suivante crée un événement seulement si elle améliore strictement la marque.
- Une égalité ne crée aucun événement : le record reste attaché à la première occurrence.
- Les séries d’échauffement sont exclues via `isWorkingSet`, jamais par une règle dupliquée.
- Seules les séries vivantes et validées participent. Une séance `active` compte immédiatement,
  une séance `completed` reste dans la chronologie et une séance `discarded` n’y participe jamais.

### 2.2 Ordre déterministe

Le moteur traite les performances par :

1. date de la séance ou de la série ;
2. ordre de l’exercice dans la séance ;
3. ordre de la série ;
4. identifiant source comme dernier départage stable.

Deux reconstructions de la même base produisent ainsi les mêmes événements, y compris pour un
import dont plusieurs séries partagent le même timestamp.

---

## 3. Estimation du 1RM

### 3.1 Module pur

Créer `src/lib/oneRepMax.ts`, sans React ni Dexie :

```ts
export type OneRepMaxFormula = 'epley' | 'brzycki' | 'lombardi';

export function estimateOneRepMax(
  weightKg: number,
  reps: number,
  formula: OneRepMaxFormula,
): number | undefined;
```

Formules :

```text
Epley     = poids × (1 + répétitions / 30)
Brzycki   = poids × 36 / (37 − répétitions)
Lombardi  = poids × répétitions^0,10
```

### 3.2 Domaine de validité

- `weightKg` doit être strictement positif et fini.
- `reps` doit être un entier de 1 à 12.
- À une répétition, le résultat est exactement la charge saisie pour les trois formules.
- Au-delà de 12 répétitions, l’estimation est absente plutôt qu’affichée avec une précision
  trompeuse.
- Le moteur compare les valeurs non arrondies. L’interface arrondit seulement la lecture au
  dixième de kilogramme.
- Le 1RM est proposé uniquement pour `weight_reps`. Il est exclu du poids du corps, du lest,
  de l’assistance, de la durée et de la distance, conformément à la décision utilisateur.

### 3.3 Réglage

La table `settings` reçoit la clé `oneRepMaxFormula`. Une valeur absente ou invalide se normalise
vers `'epley'`.

L’écran Réglages présente trois options dans une `OptionSheet`, avec une explication en langage
courant et un exemple `100 kg × 5`. Changer la formule reconstruit atomiquement la seule
chronologie `best_1rm` et actualise les graphiques calculés à la lecture. Si la reconstruction
échoue, l’ancien réglage reste actif.

---

## 4. Types de records

Le moteur ne propose jamais la même liste à tous les types de mesure. La signification du poids
vient de l’instantané `WorkoutExercise.exerciseMeasurementType`, pas de la bibliothèque actuelle.

| Type de mesure | Records admissibles |
|---|---|
| `weight_reps` | charge maximale, meilleure série `poids × reps`, meilleur tonnage de séance, meilleur 1RM |
| `reps_only` | répétitions maximales, lest maximal, meilleur tonnage de séance lorsqu’il est calculable |
| `assisted_weight_reps` | assistance minimale, répétitions maximales, meilleur tonnage de séance lorsqu’il est calculable |
| `weight_time` | charge maximale, durée maximale |
| `time_only` | durée maximale |
| `distance_time` | distance maximale, durée maximale |

`PersonalRecordType` évolue pour porter les concepts manquants sans réutiliser un nom faux :

```ts
export type PersonalRecordType =
  | 'max_weight'
  | 'max_added_weight'
  | 'min_assistance'
  | 'max_reps'
  | 'best_1rm'
  | 'max_volume_set'
  | 'max_volume_session'
  | 'max_duration'
  | 'max_distance';
```

Une charge d’assistance plus élevée ne peut donc plus devenir un record de charge. Pour
`min_assistance`, une valeur plus basse est meilleure ; tous les autres records montent.

Le tonnage réutilise `sessionTotals`, y compris son calcul de charge effective au poids du corps.
Il n’existe pas un troisième calcul propre aux records.

---

## 5. Moteur pur de records

`src/lib/records.ts` reste la définition canonique de ce qui compte. Il est approfondi sans
accès aux données.

Le moteur reçoit des performances déjà projetées avec leur identité historique :

```ts
export interface RecordSource {
  workoutId: string;
  workoutSetId?: string;
  exerciseId: string;
  measurementType: MeasurementType;
  achievedAt: number;
  exerciseOrder: number;
  setOrder: number;
  set?: WorkoutSet;
  sessionTonnage?: number;
}

export interface RecordEventDraft {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: number;
  workoutId: string;
  workoutSetId?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  formula?: OneRepMaxFormula;
}

export function projectRecordTimeline(
  sources: readonly RecordSource[],
  formula: OneRepMaxFormula,
): RecordEventDraft[];
```

`projectRecordTimeline` est le contrat canonique. Ses responsabilités sont :

- évaluer les valeurs admissibles d’une performance selon son type de mesure ;
- parcourir les sources dans un ordre déterministe ;
- émettre la marque initiale puis les améliorations strictes ;
- produire toutes les catégories battues par une même série, sans réduire la persistance à un
  unique titre d’interface ;
- conserver `recordsBeatenBy` et `workoutRecordKinds` comme façades compatibles ou les remplacer
  par des projections minces sur ce moteur, sans dupliquer les règles.

La notification en direct peut résumer plusieurs catégories gagnées par une série, mais
`personalRecords` les conserve toutes.

---

## 6. Modèle persistant et réconciliation

La table et ses index existent déjà :

```text
personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt'
```

Aucun nouvel index n’est nécessaire pour les lectures prévues. L’entité s’enrichit :

```ts
export interface PersonalRecord extends Syncable {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: number;
  workoutId: string;
  workoutSetId?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  formula?: OneRepMaxFormula;
}
```

`workoutId` est obligatoire parce qu’un record de tonnage appartient à une séance entière.
`workoutSetId` est optionnel pour cette même raison. Les valeurs contextuelles évitent à la page
de reconstruire un libellé en joignant toutes les tables.

### 6.1 Identité stable

Une reconstruction rapproche les événements calculés des lignes existantes par une clé métier
composée de l’exercice, du type, de la séance et de la série source éventuelle.

- Un événement toujours valable conserve son UUID.
- Un événement dont la valeur ou la formule change est mis à jour avec `touch`.
- Un événement qui n’existe plus est soft-deleted.
- Un nouvel événement reçoit `crypto.randomUUID()`.
- Aucune reconstruction ne supprime physiquement des lignes.

Cette réconciliation rend le recalcul idempotent et évite de créer une nouvelle chronologie à
chaque ouverture ou changement de formule.

### 6.2 Repository unique

Créer `src/data/repositories/personalRecords.ts`. C’est la seule porte vers la table :

```ts
listRecordTimeline(filters)
listCurrentRecordsForExercise(exerciseId)
listRecordsForWorkout(workoutId)
rebuildRecordsForExercises(exerciseIds)
rebuildAllRecords()
ensureRecordProjection()
```

`filters` accepte `exerciseId` et `type`, tous deux optionnels. Les lectures rendent des modèles
déjà enrichis du nom historique de l’exercice et du statut de la séance source ; les composants
n’importent jamais `db` et ne refont pas les jointures.

```ts
export interface RecordTimelineFilters {
  exerciseId?: string;
  type?: PersonalRecordType;
}

export interface RecordTimelineEntry {
  record: PersonalRecord;
  exerciseName: string;
  workoutStatus: 'active' | 'completed';
}
```

---

## 7. Flux d’écriture

### 7.1 Nouvelle série validée

`completeSet` écrit la série et ses nouveaux records dans la même transaction. Le chemin est
incrémental : il lit seulement les marques courantes nécessaires et le contexte de la séance.
La série est soit validée avec sa projection, soit pas validée ; aucun état intermédiaire ne
reste en base.

La première marque est persistée mais ne déclenche aucune félicitation. Une amélioration
alimente immédiatement `listRecordsForWorkout`, que la séance en direct observe avec
`useLiveQuery`.

### 7.2 Décochage, suppression et édition

Les opérations capables de rendre un ancien record faux déclenchent une reconstruction ciblée
des exercices concernés :

- décocher ou recocher une série ;
- modifier ses valeurs ou son type ;
- supprimer ou restaurer une série, un exercice de séance ou une séance ;
- modifier une séance historique ;
- importer des séances ;
- réparer ou resnapshotter l’historique lorsque l’identité affecte la mesure.

Ajouter, modifier ou supprimer une mesure de poids corporel peut changer le tonnage effectif des
séances comprises entre cette mesure et la suivante. Le repository identifie cet intervalle,
collecte les exercices `reps_only` et `assisted_weight_reps` concernés, puis reconstruit leurs
records de tonnage. Une correction de poids ne relance pas les chronologies indépendantes du
poids corporel.

Les gros imports regroupent les identifiants touchés et reconstruisent une fois par exercice,
pas une fois par cellule importée.

### 7.3 Initialisation et version de projection

La clé `personalRecordsProjectionVersion` indique la version du moteur ayant produit les lignes.
`ensureRecordProjection()` s’exécute au démarrage avant d’exposer les lectures de records :

- version absente ou ancienne : reconstruction complète locale ;
- succès : écriture de la nouvelle version ;
- échec : version inchangée, donc nouvelle tentative au prochain démarrage ou via Réglages.

Ce mécanisme gère l’historique déjà présent et les évolutions futures des règles sans enfouir
la logique métier dans une migration Dexie irréversible.

---

## 8. Page Records — le rail de progression

### 8.1 Entrée et route

La route lazy `/analytics/records` apparaît en première ligne de la section d’aperçu de
`AnalyticsScreen`. Aucun sixième onglet n’est ajouté. Les raccourcis de l’accueil restent trois
colonnes dans cette tranche afin de ne pas casser leur disposition mobile.

### 8.2 Composition

```text
┌─────────────────────────────────────┐
│ ←  Records                          │
├─────────────────────────────────────┤
│ [Tous les exercices ▾] [Tous ▾]     │
│                                     │
│ DERNIÈRE MARQUE                     │
│ 134,6 kg                            │
│ Développé couché · 1RM · aujourd’hui│
│ 112,5 kg × 5 · +6 kg                │
│                                     │
│  ●  134,6 kg        1RM             │
│  │  Aujourd’hui · Epley             │
│  ○  128,6 kg        1RM             │
│  │  24 juillet · 107,5 × 6          │
│  ○  105 kg          Charge          │
│  │  2 juillet · 4 reps              │
│  ○  100 kg          Charge          │
└─────────────────────────────────────┘
```

Filtres :

- exercice : « Tous les exercices » par défaut, puis les exercices possédant au moins un record ;
- type : seulement les catégories présentes dans le résultat courant ;
- toute combinaison vide propose de réinitialiser les filtres.

Le flux est du plus récent au plus ancien. Toucher un cran d’une séance terminée ouvre
`/history/:workoutId` ; un cran appartenant à la séance active ouvre `/workout`. La ligne entière
est une cible d’au moins 48 px ; le petit point du rail n’est jamais la cible unique. Terminer la
séance fait basculer la destination vers l’historique, et l’abandonner retire ses événements par
reconstruction ciblée.

### 8.3 Signature visuelle

Le rail reprend le vocabulaire des crans d’une machine guidée : une ligne verticale mécanique,
des marques établies et un unique cran actif.

Palette existante, renommée ici pour expliciter son rôle :

| Nom | Jeton existant | Valeur sombre | Usage |
|---|---|---|---|
| Forge | `--surface-0` | `#12110f` | fond de page |
| Fonte | `--surface-1` | `#1b1916` | relevé du dernier record |
| Acier levé | `--surface-2` | `#25221e` | filtres et états pressés |
| Craie | `--text-1` | `#f5f3f0` | valeurs et titres |
| Alliage | `--text-2` | `#b9b1a8` | contexte et anciens crans |
| Record | `--accent-ink` | `#ff8a3d` | dernier record uniquement |

Le mode clair réutilise les valeurs déjà définies dans `index.css`. Aucune seconde palette et
aucun dégradé ne sont ajoutés.

Typographie :

- corps et commandes : pile système FitTrack existante ;
- valeurs de records : pile `ui-monospace` avec chiffres tabulaires, réservée à cette page et aux
  lectures de 1RM ;
- micro-libellés : `label-xs` existant.

La prise de risque visuelle est concentrée dans le rail et la lecture monospace. Tout le reste
reste calme : `Screen`, `Card`, `FilterChip`, `OptionSheet` et les espacements existants.

### 8.4 Mouvement et accessibilité

Une seule animation accompagne l’insertion live d’un nouveau cran : déplacement court du rail
et stabilisation du point, sous `--dur-2` et `--ease-mech`. Aucun scintillement, confetti ou
mouvement en boucle. `prefers-reduced-motion` rend l’insertion instantanée.

La structure est une liste HTML ordonnée par date, pas un dessin SVG seul. Le rail est décoratif ;
les libellés portent toute l’information. Le contraste, le focus visible, le clavier et les
cibles de 48 px restent obligatoires à 320 px comme à 375 px.

### 8.5 États

| Situation | Réponse |
|---|---|
| Aucun historique qualifiant | Expliquer qu’une première série de travail terminée établira la première marque. |
| Une seule marque | Afficher la marque initiale et préciser qu’une prochaine amélioration ajoutera un cran. |
| Filtres sans résultat | Garder les filtres visibles et proposer « Réinitialiser les filtres ». |
| Projection en cours | Conserver la structure de l’écran avec `aria-busy`, sans fausse valeur ni squelette animé. |
| Reconstruction échouée | Expliquer que les records n’ont pas pu être recalculés et proposer « Recalculer les records ». |

---

## 9. Intégrations aux écrans existants

### 9.1 Fiche exercice

La section Records lit `listCurrentRecordsForExercise` au lieu de recalculer `bestSets` sur tout
l’historique. Elle affiche uniquement les catégories admissibles et ajoute le 1RM avec la
formule active. La ligne « Voir la progression » reste distincte.

### 9.2 Progression d’un exercice

Ajouter `estimatedOneRepMax` à `MetricKey` et aux métriques de `weight_reps`, juste après la
charge maximale. Un point vaut le meilleur 1RM admissible de la séance, calculé depuis ses
séries brutes avec la formule active.

La courbe contient toutes les séances, pas seulement les événements de record : elle montre une
progression et ses reculs. Le point record continue d’être déterminé par `bestPointIndex`.

### 9.3 Séance en direct

`WorkoutScreen` observe les records persistés du workout actif. `RecordNote` ne reconstruit plus
une définition parallèle. Si une série bat plusieurs catégories, une note compacte les nomme
sans masquer les événements persistés, par exemple « Nouveau record · 1RM et charge ».

Décocher la série retire la note après reconstruction ciblée ; la recocher la restaure si elle
reste réellement meilleure.

### 9.4 Réglages

La section Entraînement reçoit le choix de formule. La section Données reçoit « Recalculer les
records », avec confirmation, compte rendu du nombre d’exercices et d’événements réconciliés,
et message explicite lorsqu’il n’y avait rien à corriger.

Tous les textes vivent dans `src/i18n/fr.ts` et les libellés de types dans `src/i18n/labels.ts`.

---

## 10. Atomicité et erreurs

Les mutations et la projection qu’elles invalident partagent une transaction Dexie. Une erreur
annule l’ensemble ; l’interface garde la valeur saisie et permet de réessayer. Il n’existe pas
d’état où une série est validée tandis que son record correspondant manque silencieusement.

La reconstruction complète :

- calcule d’abord la projection attendue ;
- réconcilie les lignes dans une transaction ;
- met à jour `personalRecordsProjectionVersion` seulement à la fin ;
- rend un rapport structuré pour les Réglages et les tests.

Les erreurs ne sont jamais absorbées par un `void promise` sans retour visible sur les chemins
de réglage et de réparation.

---

## 11. Stratégie de tests

### 11.1 `oneRepMax.ts` en TDD

- résultat exact des trois formules sur des cas connus ;
- une répétition égale la charge ;
- bornes 1 et 12 incluses, 0 et 13 exclues ;
- charge nulle, négative, `NaN` ou infinie exclue ;
- comparaison sur la valeur non arrondie ;
- formatage français arrondi au dixième testé dans la couche de libellés.

### 11.2 Moteur pur de records en TDD

- marque initiale, amélioration stricte et égalité ;
- ordre stable lorsque les timestamps sont identiques ;
- échauffements exclus, séries normales, dégressives et à l’échec incluses ;
- toutes les catégories du tableau de la section 4 ;
- assistance : plus bas gagne ;
- 1RM absent au-delà de 12 répétitions et hors `weight_reps` ;
- une série battant plusieurs catégories produit plusieurs événements ;
- tonnage de séance partagé avec `sessionTotals` ;
- formule différente pouvant produire une chronologie 1RM différente.

### 11.3 Repository avec `fake-indexeddb`

- écriture incrémentale et lecture courante ;
- réconciliation conservant les UUID des événements survivants ;
- soft-delete des événements invalidés ;
- modification, décochage, suppression, restauration et suppression de séance ;
- séance active incluse, séance abandonnée exclue et destination du cran mise à jour à la fin ;
- import en lot sans reconstruction répétée par ligne ;
- correction de poids corporel ne reconstruisant que les tonnages dépendants sur l’intervalle
  affecté ;
- changement de formule atomique ;
- reconstruction complète idempotente ;
- égalité exacte entre projection incrémentale et reconstruction complète ;
- `ensureRecordProjection` rétrocalculant une base existante et ne validant sa version qu’au
  succès.

### 11.4 Interface et parcours

- test d’intégration du chargement, des filtres et du lien vers la séance source ;
- fiche exercice lisant les records persistés ;
- graphique 1RM offert seulement à `weight_reps` ;
- notification live issue des lignes persistées et retirée au décochage ;
- choix de formule et réparation avec états de réussite et d’échec ;
- contrôle manuel à 320 px et 375 px, thèmes sombre et clair, clavier, lecteur d’écran et
  réduction des animations.

Une fixture de grande base vérifie que le rétrocalcul et l’ouverture de la page restent
proportionnés. Le seuil sera mesuré avant d’envisager un nouvel index.

---

## 12. Checkpoint téléphone

1. Installer la nouvelle version par-dessus la base existante, hors ligne.
2. Ouvrir Analyses → Records et retrouver les anciennes performances rétrocalculées.
3. Filtrer sur un exercice et vérifier le rail contre l’historique réel.
4. Valider une série qui bat la charge et le 1RM : la notification doit apparaître pendant la
   séance et les deux événements doivent être persistés.
5. Forcer l’arrêt, relancer hors ligne et retrouver la chronologie.
6. Décocher puis recocher la série ; la note et les crans doivent suivre.
7. Modifier une ancienne séance qui détenait un record et vérifier la reconstruction.
8. Changer Epley pour Brzycki puis Lombardi ; fiche, courbe et chronologie 1RM doivent rester
   d’accord.
9. Lancer « Recalculer les records » et vérifier qu’un second passage ne change rien.
10. Contrôler le rail à une main en sombre et en clair, notamment les cibles, le contraste et le
    retour vers la séance source.

---

## 13. Découpage d’implémentation attendu

Le plan d’implémentation séparera au minimum :

1. moteur 1RM pur ;
2. moteur de projection des records ;
3. repository, initialisation et intégration aux mutations ;
4. réglage de formule et réparation ;
5. page Records et rail ;
6. intégrations fiche, graphique et séance en direct ;
7. vérification mobile, grosse base et documentation de fin de session.

Chaque tranche suit le TDD, garde une baseline verte et peut être commitée atomiquement.
