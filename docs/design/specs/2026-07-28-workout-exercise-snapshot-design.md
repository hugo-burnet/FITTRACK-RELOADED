# Instantané des métadonnées d'exercice et fuseau d'une séance

**Date :** 2026-07-28
**Statut :** proposé
**Périmètre :** `src/data/types.ts`, `src/data/db.ts`, les quatre points de
création de `WorkoutExercise`, la création de `Workout`.

## Objectif

Empêcher qu'une modification de la bibliothèque réécrive le passé, **avant** de
construire les exports et les graphiques dessus.

C'est le jalon 08A du plan de finition. Il ne livre rien de visible : il fige la
donnée pendant qu'il en reste peu.

## Le problème, corrigé

Le plan de finition liste cinq conséquences, dont une est fausse.

Une série porte `exerciseId`, mais le nom, le muscle et le type de mesure sont
relus dans `exercises` à l'affichage. Donc aujourd'hui :

- renommer un exercice renomme rétrospectivement toutes les anciennes séances ;
- changer son `measurementType` réinterprète ses anciennes valeurs ;
- changer son muscle principal déplace rétroactivement tout son volume ;
- un export d'aujourd'hui peut différer d'un export de la même séance demain.

En revanche, **supprimer un exercice ne perd rien** : `deleteExercise` appelle
`softDelete`, la ligne reste en base avec `deletedAt != 0`. Seul `alive()` la
retire des listes. Le plan de finition se trompe sur ce point, et c'est ce qui
permet de supprimer tout un concept ci-dessous.

## Architecture retenue

### Champs plats, pas un objet imbriqué

Le plan de finition propose au choix des champs plats ou un objet
`exerciseSnapshot`. Les champs plats gagnent, pour la raison qui gouverne déjà
`WorkoutSet.exerciseId` et `WorkoutExercise.restSeconds` (architecture §5) : la
dénormalisation de ce lot est de la même nature que celle des lots précédents,
et elle doit se lire de la même façon.

`restSeconds` est d'ailleurs déjà exactement un instantané — résolu une fois,
quand l'exercice entre dans la séance, précisément pour que l'édition de la
routine ne le réécrive pas. Ce lot généralise une décision déjà prise.

### Quatre champs, pas six

```ts
interface WorkoutExercise {
  // …
  exerciseName?: string;
  exerciseMeasurementType?: MeasurementType;
  exercisePrimaryMuscle?: MuscleGroup;
  exerciseEquipment?: Equipment;
}
```

Le plan de finition en propose six. `secondaryMuscles` et `isUnilateral` sont
retirés :

- la V1 des graphiques compte explicitement **le muscle principal seulement**,
  sans pondération des secondaires ;
- `isUnilateral` décide de la saisie, pas de la lecture — un côté performé est
  déjà porté par `WorkoutSet.side` ;
- aucun export ni graphique planifié ne lit ni l'un ni l'autre ;
- l'exercice n'étant jamais réellement supprimé, les deux restent lisibles dans
  `exercises` le jour où quelque chose en aura besoin.

Un champ dénormalisé que rien ne lit est une ligne à maintenir dans quatre
constructeurs et une migration, pour rien.

### Pas de `snapshotQuality` : l'absence est le signal

Le plan de finition propose `snapshotQuality: 'exact' | 'inferred' | 'missing'`.
Les trois valeurs ne sont pas atteignables :

- `inferred` supposerait deviner un type de mesure à partir des valeurs, ce que
  le plan interdit lui-même deux lignes plus bas ;
- `missing` supposerait un exercice disparu, ce que le soft delete rend
  impossible.

Les quatre champs sont donc **optionnels**, et leur absence dit tout ce qu'il y
a à dire : la ligne est antérieure à ce lot et son exercice avait déjà été
purgé. Les consommateurs retombent sur la bibliothèque, puis sur un libellé
générique. Un énuméré de moins, un état impossible de moins.

### La règle d'écriture

> L'instantané est écrit **quand l'`exerciseId` de la ligne est écrit.**

- ligne créée → instantané résolu depuis la bibliothèque ;
- `exerciseId` d'une ligne d'archive modifié → nouvel instantané, parce que
  l'utilisateur affirme que cette série était un autre exercice ;
- dans tous les autres cas → **jamais retouché**, y compris quand la
  bibliothèque change. C'est tout l'objet du lot.

### Les quatre points de création

| Fichier | Situation |
|---|---|
| `workoutLifecycle.ts` | `startWorkoutFromRoutine` — la bibliothèque est déjà chargée pour `defaultRestSeconds` |
| `workoutExercises.ts` | `addWorkoutExercise` — l'exercice est déjà lu pour `defaultRestSeconds` |
| `hevyWorkoutEntities.ts` | import Hevy — l'`Exercise` résolu est déjà en main |
| `history.ts` | `saveArchivedWorkout` — seule ligne à charger quelque chose de neuf |

Les trois premiers ont déjà l'exercice sous la main : ce lot n'ajoute aucune
lecture. Seul l'éditeur d'archive doit charger les exercices de son brouillon.

### Le fuseau d'une séance

```ts
interface Workout {
  // …
  startedTimezoneOffsetMinutes?: number;
}
```

Écrit à la création : `-new Date(startedAt).getTimezoneOffset()`, donc `+120`
pour Paris en été. Le jour civil et la semaine d'une séance se calculent
ensuite avec l'offset de la séance, pas avec celui du téléphone au moment de la
consultation.

**Honnêteté sur sa valeur :** tant que l'utilisateur ne voyage pas, ce champ
reproduit exactement ce que `getTimezoneOffset()` recalculerait. Sa valeur est
nulle aujourd'hui et entière le jour d'un décalage — et c'est précisément le
genre de donnée qu'on ne peut pas reconstituer après coup. Un champ non indexé
et une ligne dans quatre constructeurs : le prix de l'assurance est connu.

Ce lot **écrit** le champ. Il ne change encore aucun regroupement : les
graphiques le liront quand ils existeront.

## Migration

`this.version(2)` avec un `.upgrade()`, sans changement de `stores` — aucun des
cinq champs n'est indexé.

- pour chaque `workoutExercise`, recopier les métadonnées de son exercice s'il
  existe encore en base, soft-deleted compris ;
- pour chaque `workout`, écrire `-new Date(startedAt).getTimezoneOffset()`.

Le second est exact rétroactivement : la base de fuseaux du téléphone connaît
l'offset de Paris en mars 2026. Le premier est exact pour toute ligne dont
l'exercice n'a pas déjà été renommé — ce qui n'est pas vérifiable, et n'a pas
besoin de l'être : c'est la meilleure information disponible, et la seule.

## Ce que ce lot ne fait pas

- pas de couche de validation numérique — indépendante des exports et des
  graphiques, et elle appartient au document de refactorisation ;
- pas d'audit de cohérence ni de réparation d'ordres dupliqués — même raison ;
- aucun consommateur n'est encore rebranché sur l'instantané. Les écrans
  existants continuent de lire la bibliothèque. Les brancher est le travail des
  jalons d'export et de graphiques, qui savent ce dont ils ont besoin.

## Vérification

- `snapshotOf` testé en isolation : exercice présent, exercice absent ;
- `localOffsetMinutes` testé : signe et valeur ;
- les quatre constructeurs testés : la ligne créée porte le nom, le type, le
  muscle et le matériel de l'exercice au moment de la création ;
- test de non-régression : renommer un exercice après coup ne change pas
  l'instantané d'une séance passée ;
- `lint`, `typecheck`, `test:run`, `build`.
