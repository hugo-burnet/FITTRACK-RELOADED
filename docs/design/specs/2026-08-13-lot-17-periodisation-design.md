# Lot 17 — Périodisation et programmes multi-semaines

**Date :** 2026-08-13
**Statut :** conception validée
**Périmètre :** bloc de 4 à 12 semaines, split hebdomadaire versionné, prescription par semaine, décharge planifiée et démarrage de la bonne séance depuis l’accueil.

## 1. Objectif

FitTrack doit permettre de construire puis suivre un bloc d’entraînement de 4 à 12 semaines sans transformer les routines en copies jetables. Le programme référence des routines existantes, répète un split hebdomadaire, fait varier une prescription commune à chaque semaine et indique clairement où l’utilisateur se trouve dans le bloc.

Le résultat attendu est celui du checkpoint du roadmap : créer un bloc de huit semaines avec une décharge en semaine 5, puis obtenir la bonne séance, avec les bonnes cibles, le bon jour.

Le lot reste entièrement local-first. Aucune lecture, écriture ou décision ne dépend du réseau.

## 2. Décisions validées

- Un programme référence les routines existantes ; il ne copie pas chaque séance de chaque semaine.
- Le calendrier est fixe. La semaine 1 commence un lundi choisi par l’utilisateur.
- Un imprévu se gère par une action explicite « Décaler le bloc » qui déplace la date de départ.
- Le même split hebdomadaire se répète pendant le bloc.
- Chaque semaine porte une prescription commune : pourcentage du 1RM ou RPE cible.
- Une semaine peut être marquée comme décharge.
- Un changement de routine ou de split prend effet à partir d’une semaine donnée et ne réécrit jamais les semaines antérieures.
- Les changements sont portés par des versions effectives de routines et de planning.
- Les programmes sont illimités, mais un seul programme peut être actif à la fois.

## 3. Hors périmètre

- Génération automatique d’un programme depuis un questionnaire (RF-47).
- Adaptation automatique des semaines du programme par le Coach du Lot 18. Leur intégration et
  l'absence de recommandations contradictoires font en revanche partie du lot.
- Prescription différente pour chaque exercice au sein d’une même semaine.
- Microcycles dont le planning change librement chaque semaine.
- Synchronisation cloud, partage et collaboration.
- Limite artificielle sur le nombre de programmes, de versions ou de routines.

## 4. Modèle de données

### 4.1 Programme

```ts
export type ProgramStatus = 'draft' | 'active' | 'completed';

export interface Program extends Syncable {
  name: string;
  /** Lundi local qui ouvre la semaine 1, stocké en epoch ms. */
  startsAt: number;
  durationWeeks: number; // entier de 4 à 12
  status: ProgramStatus;
}
```

Plusieurs programmes peuvent être conservés. L’activation se fait dans une transaction qui vérifie qu’aucun autre programme n’est actif. Remplacer un programme actif exige une confirmation explicite qui termine l’ancien bloc ; l’app ne le fait jamais silencieusement.

### 4.2 Prescription hebdomadaire

```ts
export type ProgramPrescriptionKind = 'percent_1rm' | 'target_rpe';

export interface ProgramWeek extends Syncable {
  programId: string;
  weekIndex: number; // 0 à durationWeeks - 1
  prescriptionKind: ProgramPrescriptionKind;
  prescriptionValue: number;
  isDeload: 0 | 1;
  notes?: string;
}
```

Le couple `[programId+weekIndex]` est unique parmi les lignes vivantes. Toutes les semaines existent avant l’activation du programme ; une activation avec un trou est refusée.

### 4.3 Révisions du split

```ts
export interface ProgramScheduleRevision extends Syncable {
  programId: string;
  /** Première semaine qui utilise cette révision. */
  effectiveFromWeekIndex: number;
}

export interface ProgramScheduleEntry extends Syncable {
  revisionId: string;
  routineId: string;
  /** ISO : 1 = lundi, 7 = dimanche. */
  dayOfWeek: number;
  /** Départage plusieurs séances prévues le même jour. */
  order: number;
}
```

La révision applicable à une semaine est la ligne vivante dont `effectiveFromWeekIndex` est le plus grand nombre inférieur ou égal à la semaine demandée. Une révision contient le split complet : changer une seule routine crée tout de même une nouvelle révision complète. Pour trois à six séances, cette duplication minuscule rend la lecture déterministe et évite de reconstruire un patch cumulatif.

Une révision passée n’est jamais modifiée ni supprimée tant que son programme existe. Une nouvelle révision ne peut commencer dans une semaine antérieure. Elle commence par défaut la semaine suivante ; la semaine courante n’est autorisée que si aucune séance du programme n’y a été enregistrée.

### 4.4 Versions de routines

Les champs existants prennent enfin leur sens :

```ts
export type RoutineVersionState = 'draft' | 'published';

export interface Routine extends Syncable {
  // champs existants
  version: number;
  originRoutineId?: string; // id de la v1
  versionState: RoutineVersionState;
}
```

Les routines existantes sont migrées vers `versionState: 'published'`.

Une routine publiée référencée par un programme est scellée. L’éditeur la présente en lecture seule et propose « Créer une version ». Cette action effectue une copie profonde avec un nouvel UUID, `version + 1`, la même origine et `versionState: 'draft'`. Le brouillon conserve l’écriture immédiate actuelle : chaque changement est persisté sans bouton « enregistrer ».

Le bouton « Utiliser à partir de la semaine N » publie le brouillon et crée la nouvelle révision du split dans une seule transaction. Un brouillon abandonné reste identifiable et reprenable ; il n’affecte aucun programme tant qu’il n’est pas publié. La liste principale affiche la dernière version publiée de chaque lignée et signale séparément ses éventuels brouillons, sans encombrer la liste avec toutes les versions historiques.

Changer complètement de split suit le même principe : l’utilisateur prépare une révision complète, puis la publie à partir d’une semaine choisie.

### 4.5 Contexte de programme dans une séance

`Workout` reçoit des champs optionnels non indexés pour préserver la compatibilité des séances existantes :

```ts
export interface Workout extends Syncable {
  // champs existants
  programId?: string;
  programWeekIndex?: number;
  programScheduleEntryId?: string;
  /** Marqueur sémantique ; ne prétend pas qu'une réduction de 80 % a été appliquée. */
  programIsDeload?: 0 | 1;
}

export interface WorkoutSet extends Syncable {
  // champs existants
  /** Prescription figée, distincte du RPE réellement saisi dans `rpe`. */
  targetRpe?: number;
}
```

La séance continue de copier l’identité de ses exercices dans `WorkoutExercise` et la prescription dans les champs `target*` de `WorkoutSet`. Les changements ultérieurs d’un programme ou d’une routine ne peuvent donc modifier ni l’affichage ni les calculs d’une séance passée.

## 5. Calcul du calendrier

`startsAt` désigne le lundi local de la semaine 1. Le calcul de la semaine courante travaille sur des jours civils locaux, pas sur une division brute des millisecondes par 604 800 000 ; il doit rester juste pendant les changements d’heure.

Pour une date donnée :

- avant `startsAt`, le programme est à venir ;
- entre les bornes, `weekIndex` va de `0` à `durationWeeks - 1` ;
- après la dernière semaine, le bloc est arrivé à son terme et ne propose plus de séance.

« Décaler le bloc » change uniquement `Program.startsAt`. Les séances déjà créées conservent leur `programWeekIndex` et leur date réelle. L’action affiche donc un avertissement si le bloc a commencé, mais elle ne réécrit jamais l’historique.

## 6. Projection de la prescription

La projection est une fonction pure. Elle reçoit la semaine, le détail de la routine, les records 1RM et les incréments de charge ; elle renvoie les cibles à copier dans la nouvelle séance ainsi qu’une liste d’avertissements typés.

### 6.1 Pourcentage du 1RM

- Seules les séries de travail sont modifiées ; les échauffements restent ceux de la routine.
- Pour un exercice compatible possédant un record `best_1rm`, `targetWeight` devient `1RM × pourcentage / 100`.
- La charge est arrondie à l’incrément de l’exercice avec les règles du Lot 18.
- Les exercices sans poids, les exercices assistés et les exercices sans record 1RM conservent la cible de la routine.
- Chaque repli produit un avertissement explicite affiché avant le démarrage ; il ne bloque pas la séance.

Le calcul utilise les records disponibles au moment où la séance démarre. La valeur réellement retenue est ensuite figée dans `WorkoutSet.targetWeight`.

### 6.2 RPE cible

- Les séries de travail reçoivent `targetRpe = prescriptionValue`.
- Les charges et les fourchettes de répétitions restent celles de la routine.
- Les échauffements ne reçoivent pas de RPE programmé.

### 6.3 Décharge

`isDeload` est une information explicite, pas un multiplicateur caché. L’utilisateur choisit directement une prescription réduite, par exemple 60 % du 1RM ou RPE 6. La séance reçoit `programIsDeload: 1` afin qu’une baisse planifiée ne déclenche ni plateau ni alerte de régression.

Ce marqueur reste distinct de `Workout.deloadPercent`. Ce dernier signifie aujourd’hui que l’action manuelle « Deload à 80 % » a réellement réduit les charges et pilote une UI qui l’affirme. Le réutiliser pour une semaine à RPE réduit ferait mentir cette UI. Le Coach considère comme décharge une séance portant `programIsDeload: 1` **ou** un `deloadPercent` manuel valide.

L’éditeur peut suggérer une valeur réduite à partir de la semaine précédente, mais aucune charge n’est diminuée une deuxième fois au démarrage.

### 6.4 Articulation avec le Coach du Lot 18

Le programme et le Coach ne doivent jamais être deux prescripteurs concurrents. La règle d’autorité
est simple : **dans une séance programmée, le programme prescrit ; le Coach observe**.

Le Lot 17 réutilise les primitives fiables du Lot 18 pour résoudre l’incrément propre à l’exercice
et arrondir une charge atteignable. Il ne duplique pas cette table ni les cas particuliers des
équipements.

Les recommandations numériques déjà en attente deviennent obsolètes dès qu’un programme prend la
main sur les exercices concernés. Le journal gagne donc un statut distinct :

```ts
export type CoachRecommendationStatus =
  | 'pending'
  | 'followed'
  | 'dismissed'
  | 'superseded';
```

À l’activation du programme, les recommandations `pending` portant `nextLoadKg` pour un exercice du
split passent à `superseded`, avec `resolvedAt`. La publication d’une future révision fait la même
chose pour les nouveaux exercices qu’elle introduit. Ce statut n’est pas un refus utilisateur : il
reste visible dans le journal et n’empêche jamais le Coach de proposer de nouveau le même chiffre
après le programme.

Dans une séance portant `programId` :

- aucune carte Coach numérique ne peut remplacer la charge prescrite, même si une ancienne ligne
  `pending` a échappé à la transition ;
- la fin de séance ne montre et ne journalise que les observations compatibles avec un bloc :
  `intra_session_drop` et `long_rest` ;
- `range_completed`, `range_missed` et `plateau` restent silencieux, car ils tenteraient de modifier
  ou de juger une progression que le programme possède déjà ;
- toutes les performances continuent malgré tout d’alimenter l’historique du Coach et les records.

Le Coach n’écrit jamais dans `ProgramWeek`, ne décale aucune date et ne publie aucune révision. Quand
le bloc est terminé, la première séance hors programme retrouve le fonctionnement normal du Coach,
qui travaille alors sur l’historique complet, y compris les séances du bloc.

## 7. Parcours utilisateur

### 7.1 Accès

Il n’y a pas de sixième onglet. Une entrée « Programmes » en tête de l’écran Routines mène aux routes :

- `/programs` : programmes et bloc actif ;
- `/programs/new` : création ;
- `/programs/:id` : suivi du bloc ;
- `/programs/:id/edit` : informations, prescriptions et future révision du split.

### 7.2 Création

L’éditeur mobile contient trois étapes :

1. nom, lundi de départ et durée de 4 à 12 semaines ;
2. split répété, avec un jour et une routine publiée par entrée ;
3. prescription de chaque semaine et sélection des décharges.

Le programme reste `draft` tant que les trois étapes ne sont pas complètes. L’activation valide l’ensemble dans le repository : durée, semaine complète, planning non vide et références vivantes.

### 7.3 Vue du bloc

La vue répond dans cet ordre à quatre questions :

1. où suis-je dans le bloc ;
2. quelle séance dois-je faire ;
3. qu’ai-je déjà terminé cette semaine ;
4. comment le bloc évolue-t-il dans les semaines suivantes.

Elle affiche la semaine courante, la prescription et le statut de chaque séance : terminée, prévue aujourd’hui, manquée ou à venir. Toutes les séances restent démarrables depuis cette vue tant qu’aucune autre séance n’est active.

Les actions secondaires sont « Modifier à partir de… », « Décaler le bloc » et « Terminer le bloc ». Elles ne concurrencent pas le démarrage de la séance.

### 7.4 Accueil

Lorsqu’un programme actif se trouve dans ses dates, sa carte remplace la suggestion générique de routine. Le choix est déterministe :

1. première séance non terminée prévue aujourd’hui ;
2. sinon première séance manquée de la semaine ;
3. sinon prochaine séance planifiée de la semaine ;
4. sinon annonce de la prochaine semaine.

La règle et la date sont écrites sous l’action. Une séance déjà réalisée est reconnue grâce aux champs de contexte du `Workout`, pas par comparaison fragile du nom de la routine.

## 8. Démarrage d’une séance programmée

Le repository reçoit le programme et l’entrée planifiée. Dans une transaction cohérente, il :

1. vérifie qu’aucune séance n’est active ;
2. recalcule la semaine courante ;
3. résout la dernière révision effective ;
4. charge la version exacte de la routine ;
5. projette la prescription et collecte les avertissements ;
6. crée `Workout`, `WorkoutExercise` et `WorkoutSet` avec le contexte du programme ;
7. copie les cibles projetées sans préremplir les valeurs réellement effectuées.

Cette fonction réutilise le cœur de `startWorkoutFromRoutine` au lieu de dupliquer la construction et les snapshots.

## 9. Garde-fous et erreurs

- Une seule séance et un seul programme peuvent être actifs.
- Une durée hors de 4–12, une semaine manquante ou un split vide empêchent l’activation.
- Plusieurs séances le même jour sont autorisées et ordonnées ; aucune limite arbitraire n’est ajoutée.
- Une routine référencée par un programme vivant ne peut pas être supprimée. L’interface propose de la remplacer dans une future révision ou de supprimer le programme concerné.
- Une référence manquante issue d’une base déjà endommagée bloque seulement la séance concernée et mène à la réparation du split.
- Les repositories renvoient des erreurs typées ; seul `src/i18n/fr.ts` contient les phrases françaises.
- Les opérations qui publient une version, activent un programme ou démarrent une séance sont transactionnelles.
- Tous les écrans distinguent `undefined` (« chargement »), `null` (« absent ») et une erreur de lecture.

## 10. Découpage des modules

La logique pure vit dans `src/lib/programs/` :

- calendrier civil et semaine courante ;
- validation du programme ;
- résolution des révisions ;
- choix de la séance suggérée ;
- projection `% 1RM` ou RPE.

La persistance vit uniquement dans `src/data/repositories/programs*` et dans les façades existantes des routines et séances. Aucun composant n’importe `db`.

L’interface vit dans `src/features/programs/`, avec de petits composants séparant création, aperçu des semaines, planning et actions de version. L’accueil consomme une projection de repository et ne recalcule pas la règle de suggestion.

## 11. Stratégie de tests

La logique métier est écrite en TDD.

### 11.1 Tests purs

- semaine avant, pendant et après un bloc ;
- lundi de départ et passages heure d’été/heure d’hiver ;
- décalage sans modification des indices déjà stockés dans les séances ;
- résolution de la première puis de plusieurs révisions effectives ;
- refus d’une révision rétroactive ;
- suggestion « aujourd’hui », « manquée », « suivante », puis semaine suivante ;
- pourcentage du 1RM et arrondi par incrément ;
- exercices sans 1RM, sans poids ou assistés ;
- RPE uniquement sur les séries de travail ;
- échauffements inchangés ;
- décharge marquée sans double réduction.
- distinction entre décharge programmée et réduction manuelle à 80 % ;
- filtrage des signaux Coach selon l’autorité du programme ;
- une ancienne recommandation numérique ne peut pas écraser une cible programmée ;

### 11.2 Tests repositories avec `fake-indexeddb`

- migration des routines existantes vers `published` ;
- CRUD et soft delete des quatre nouvelles entités ;
- invariant d’un seul programme actif ;
- transition des recommandations numériques en attente vers `superseded` à l’activation et lors
  d’une révision ;
- publication atomique d’une version de routine et d’une révision du split ;
- numérotation et origine d’une lignée de routines ;
- blocage de la suppression d’une routine référencée ;
- démarrage d’une séance avec contexte et cibles figées ;
- copie de `targetRpe` sans préremplir le RPE réellement effectué ;
- reprise après réouverture de la base.

### 11.3 Tests d’interface et parcours

Les composants de calcul ne sont pas retestés à travers le DOM. Les tests d’intégration couvrent la création, l’activation, la version effective d’une routine et le démarrage depuis l’accueil. Le parcours mobile complet est couvert par Playwright lorsqu’il apporte une garantie que les tests de repository ne donnent pas, notamment la navigation et les cibles tactiles.

Les portes de fin de lot sont :

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## 12. Checkpoint manuel

Sur le téléphone :

1. créer un bloc de huit semaines et marquer la semaine 5 comme décharge ;
2. vérifier que l’accueil propose la routine du jour et que les cibles correspondent à la semaine ;
3. réaliser puis terminer une séance programmée ;
4. vérifier qu’aucune recommandation de charge du Coach ne concurrence la prescription du bloc ;
5. créer une nouvelle version d’une routine et remplacer le split à partir d’une semaine future ;
6. constater que la séance passée et l’ancien planning restent inchangés ;
7. décaler le bloc et vérifier la nouvelle semaine courante ;
8. fermer puis rouvrir l’app en mode avion et retrouver exactement le même état.
