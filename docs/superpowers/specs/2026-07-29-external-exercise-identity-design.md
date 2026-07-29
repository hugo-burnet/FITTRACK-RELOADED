# Identité fiable des exercices importés

> Spec de conception validée avec l’utilisateur le 29 juillet 2026.
> Périmètre : import CSV Hevy, catalogue d’exercices et persistance des
> correspondances externes. Cette spec remplace l’hypothèse selon laquelle un
> alias livré par FitTrack constitue une identité certaine.

---

## 1. Problème constaté sur les données réelles

Le CSV Hevy réel contient 136 séries, 6 séances et 25 intitulés distincts. Quatre
séries de deux séances `LOWER A` portent le titre :

```text
Développé Debout Poulie Centrée
```

Le mouvement réellement exécuté est un Pallof press : une poussée debout à la
poulie où les abdominaux résistent à la rotation. FitTrack possède déjà la bonne
fiche canonique :

```json
{
  "slug": "pallof-press",
  "name": "Pallof press (poulie)",
  "primaryMuscle": "abs",
  "equipment": "cable",
  "measurementType": "weight_reps"
}
```

Mais `HEVY_EXERCISE_SLUG_BY_KEY` contient aujourd’hui la liaison inverse :

```text
developpe debout centree|cable → cable-shoulder-press
```

Cette liaison a été ajoutée après avoir interprété le titre sans vérifier le
mouvement avec l’utilisateur. Le test automatisé protège ensuite cette mauvaise
réponse. Le défaut n’est donc ni l’absence d’exercice dans le catalogue, ni la
taille de la bibliothèque : **une suggestion humaine a été encodée comme une
certitude machine**.

Ce cas révèle aussi une limite fondamentale du CSV : Hevy n’exporte aucun
identifiant stable d’exercice, seulement un titre. `weight_reps + cable` ne
permet pas de distinguer un développé d’épaules d’un Pallof press. Une
description plus riche améliore la compréhension, mais ne peut pas rendre une
association ambiguë certaine.

---

## 2. Décision

FitTrack conserve deux vérités séparées :

1. **La connaissance du mouvement** reste dans la fiche `Exercise` :
   nom, slug, muscles, matériel, mesure, latéralité et, lorsqu’elles existent,
   instructions.
2. **La connaissance d’une identité externe** vit dans un registre de liaisons
   confirmées : « ce titre de cette source désigne cet exercice FitTrack ».

Une suggestion livrée par le code ne peut jamais devenir une liaison confirmée
sans action explicite de l’utilisateur. Une liaison déjà explicitement confirmée
peut être réutilisée aux imports suivants.

Il n’y aura pas une table IndexedDB par exercice. Le catalogue reste une seule
table `exercises`, avec une ligne par exercice. Une seconde table
`externalExerciseBindings` contient une ligne par identité externe confirmée.
Cette forme est extensible sans ajouter une migration de schéma à chaque nouvel
exercice.

Changer de bibliothèque d’exercices est hors sujet : une bibliothèque plus
grande augmente le nombre de candidats, mais n’ajoute pas l’identifiant stable
absent du CSV.

---

## 3. Le module profond `ExternalExerciseIdentityRegistry`

La seam se place entre le parseur CSV et les repositories qui écrivent
l’import. Les écrans ne connaissent ni la construction des clés, ni la
compatibilité des mesures, ni la lecture des anciennes liaisons.

```ts
export interface ExternalExerciseObservation {
  source: 'hevy_csv';
  sourceTitle: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  sessionCount: number;
  setCount: number;
  examples: readonly ExternalExerciseExample[];
}

export interface ExternalExerciseExample {
  workoutName: string;
  startedAt: number;
  sets: readonly {
    weight?: number;
    reps?: number;
    durationSeconds?: number;
    distanceMeters?: number;
  }[];
}

export type ExternalExerciseReviewEntry =
  | {
      status: 'confirmed';
      identityKey: string;
      observation: ExternalExerciseObservation;
      exercise: Exercise;
    }
  | {
      status: 'needs_confirmation';
      identityKey: string;
      observation: ExternalExerciseObservation;
      suggestions: readonly ExerciseSuggestion[];
    }
  | {
      status: 'conflict';
      identityKey: string;
      observation: ExternalExerciseObservation;
      reason:
        | 'target_missing'
        | 'target_deleted'
        | 'measurement_changed';
      suggestions: readonly ExerciseSuggestion[];
    };

export type ExternalExerciseDecision =
  | {
      identityKey: string;
      kind: 'existing';
      exerciseId: string;
    }
  | {
      identityKey: string;
      kind: 'custom';
      exercise: NewExercise;
    };

export interface ExternalExerciseResolution {
  exercisesByIdentityKey: ReadonlyMap<string, Exercise>;
  exercisesToCreate: readonly Exercise[];
  bindingsToWrite: readonly ExternalExerciseBinding[];
}

export function createExternalExerciseIdentityRegistry(
  exercises: readonly Exercise[],
  bindings: readonly ExternalExerciseBinding[],
): ExternalExerciseIdentityRegistry;

export interface ExternalExerciseIdentityRegistry {
  review(
    observations: readonly ExternalExerciseObservation[],
  ): readonly ExternalExerciseReviewEntry[];

  resolve(
    entries: readonly ExternalExerciseReviewEntry[],
    decisions: readonly ExternalExerciseDecision[],
    confirmedAt: number,
  ): ExternalExerciseResolution;
}
```

`review` classe et explique. Il ne transforme jamais une similarité, un alias
livré ou un score en `confirmed`.

`resolve` refuse toute identité non décidée, valide les cibles, puis remet aux
repositories une table `identityKey → Exercise`, les exercices personnalisés
matérialisés et les liaisons à écrire.
L’implémentation reste pure : le registre est construit avec le catalogue et les
liaisons existantes chargés par `prepareHevyImport`.

Le registre n’a qu’une dépendance **in-process**. Le repository d’import garde
Dexie, dépendance **local-substituable** via `fake-indexeddb`, et écrit les
liaisons retournées avec les séances dans sa transaction existante. Aucun
adapter public supplémentaire n’est nécessaire tant que Hevy est la seule
source.

---

## 4. Modèle de données

```ts
export interface ExternalExerciseBinding extends Syncable {
  source: 'hevy_csv';
  identityKey: string;
  sourceTitle: string;
  exerciseId: string;
  measurementType: MeasurementType;
  equipmentHint?: Equipment;
  verification: 'user';
  confirmedAt: number;
}
```

Index Dexie :

```text
externalExerciseBindings:
  id,
  [source+identityKey],
  exerciseId,
  updatedAt,
  deletedAt
```

Invariants :

- une identité active possède au plus une cible ;
- plusieurs identités externes peuvent viser le même exercice FitTrack ;
- seules les décisions utilisateur portent `verification: 'user'` ;
- une cible doit exister, être vivante et avoir le même `measurementType` ;
- une cible devenue incompatible produit `conflict`, jamais un fallback ;
- les suggestions n’écrivent aucune donnée ;
- les anciens `hevyExerciseMappings` ne sont pas migrés comme confirmations :
  ils mélangent choix utilisateur et aliases automatiques, impossibles à
  distinguer après coup.

Le registre est général dans son modèle, mais ne généralise pas prématurément
son interface : `source` ne contient que `'hevy_csv'` dans ce jalon. Une seconde
source justifiera alors un adapter et une nouvelle valeur.

---

## 5. Identité exacte et normalisation

La clé externe conserve tous les mots sémantiques. La normalisation autorisée :

- Unicode canonique ;
- casse ;
- accents ;
- ponctuation et espaces répétés.

La normalisation interdite pour une identité :

- suppression de mots-outils ;
- suppression du matériel ;
- singularisation ;
- traduction ;
- synonymes ;
- réordonnancement de mots.

Ainsi, `poulie`, `machine`, `assis`, `debout` et `centrée` restent dans la clé.
Le classement des suggestions peut employer une logique plus tolérante, mais
cette logique reste privée et ne peut produire qu’une liste ordonnée.

Si Hevy exporte un jour un identifiant opaque stable, celui-ci remplacera le
titre normalisé dans `identityKey`. Aucune refonte du reste du module ne sera
nécessaire.

---

## 6. Rôle du catalogue JSON

`exercises.json` possède déjà une ligne structurée par exercice. C’est la source
de vérité des métadonnées canoniques, pas une table de traduction Hevy.

Dans ce jalon :

- les champs existants restent la connaissance fiable du mouvement ;
- `instructions`, lorsqu’elles existent, peuvent aider l’utilisateur dans la
  feuille de confirmation ;
- aucune taxonomie exhaustive neuve (`movementPattern`, biomécanique, etc.)
  n’est imposée aux 168 exercices uniquement pour améliorer un matcher ;
- les aliases livrés peuvent être rapprochés des fiches du catalogue pour
  améliorer la locality, mais ils restent des **suggestions** ;
- les collisions de suggestions sont détectées par les tests et ne bloquent
  pas la possibilité de choisir manuellement.

La fiche JSON permet donc de bien décrire muscles et matériel **après que
l’identité est connue**. Elle ne remplace pas la liaison externe confirmée.

---

## 7. Parcours d’import

### 7.1 Préparation

1. Parser le CSV entièrement hors ligne.
2. Regrouper les lignes par identité externe exacte.
3. Produire pour chacune le nombre de séances, le nombre de séries et quelques
   exemples courts : séance, date, charges et répétitions.
4. Lire les liaisons utilisateur existantes.
5. Produire une revue `confirmed`, `needs_confirmation` ou `conflict`.

### 7.2 Écran de correspondances

Chaque ligne affiche :

- le titre source exact ;
- la cible proposée ou confirmée ;
- muscle principal, matériel et type de mesure de la cible ;
- nombre de séances et de séries ;
- accès aux exemples de séances.

Une suggestion neuve n’a pas de coche verte et compte comme non résolue.
L’utilisateur doit :

- choisir un exercice existant ; ou
- créer un exercice personnalisé portant le titre source.

Une liaison déjà confirmée par l’utilisateur est cochée et réutilisée. Elle
reste ouvrable pour correction avant l’import.

Le cas réel doit alors se lire :

```text
Développé Debout Poulie Centrée
2 séances · 4 séries · LOWER A
Suggestion : Pallof press (poulie)
Abdominaux · Poulie
```

### 7.3 Validation et écriture

Le bouton Continuer reste désactivé tant qu’une identité est non résolue ou en
conflit. La revue finale expose le nombre de liaisons nouvelles et réutilisées.

Dans une même transaction :

1. revalider les exercices cibles ;
2. créer les éventuels exercices personnalisés ;
3. écrire les liaisons confirmées ;
4. écrire séances, lignes, séries et routines ;
5. mémoriser les clés d’import.

Une erreur annule tout.

---

## 8. Correction du cas actuel et réimport propre

La suggestion livrée doit devenir :

```text
Développé Debout Poulie Centrée → pallof-press
```

`cable-shoulder-press` peut rester dans le catalogue : c’est un mouvement réel,
mais aucun intitulé du CSV fourni ne doit lui être automatiquement attribué.

L’utilisateur n’a aucune donnée FitTrack absente du CSV. Le checkpoint retenu
est donc :

1. exporter ou conserver le CSV original comme sauvegarde ;
2. réinitialiser les données locales FitTrack ;
3. importer le CSV ;
4. confirmer les 25 identités une fois ;
5. vérifier les deux séances `LOWER A` et les analyses musculaires ;
6. réimporter le même CSV et vérifier que les 6 séances sont ignorées comme
   doublons.

Il n’est pas nécessaire de développer une migration destructive de l’historique
actuel uniquement pour ce cas. La migration de schéma ajoute toutefois la table
de liaisons sans supprimer les anciennes données, afin que la mise à jour reste
sûre pour toute base existante.

---

## 9. Tests

### Module pur / registre

- la clé exacte conserve `poulie`, `machine`, `assis`, `debout`, `centrée` ;
- accents, casse, ponctuation et espaces ne créent pas de doublons ;
- une suggestion exacte reste `needs_confirmation` sans liaison utilisateur ;
- une liaison utilisateur vivante et compatible devient `confirmed` ;
- cible supprimée ou mesure modifiée → `conflict` ;
- aucun score de similarité ne peut produire `confirmed`.

### Catalogue et cas réel

- `Développé Debout Poulie Centrée` propose `pallof-press`, jamais
  `cable-shoulder-press` ;
- `pallof-press` reste `abs + cable + weight_reps` ;
- `Presse Épaules Assis (Machine)` reste distinct et propose
  `machine-shoulder-press` ;
- les 25 intitulés de la fixture CSV produisent 25 entrées de revue ;
- les 24 suggestions connues et l’entrée manuelle « Oiseau (Machine) » ne sont
  jamais préconfirmées.

### Repository / transaction

- une confirmation et les séances sont écrites ensemble ;
- une erreur après l’écriture des liaisons ne laisse aucune liaison ;
- plusieurs titres peuvent viser le même exercice ;
- une identité ne peut pas viser deux exercices actifs ;
- un deuxième import du même CSV crée zéro séance, zéro série, zéro routine et
  zéro exercice ;
- les snapshots des lignes utilisent la cible explicitement confirmée.

### Interface

- le bouton Continuer reste désactivé tant qu’une ligne demande confirmation ;
- une suggestion n’affiche pas de coche de confirmation ;
- les exemples rendent visibles séance, date, charge et répétitions ;
- une liaison précédemment confirmée est identifiable et modifiable ;
- un conflit ne peut pas être contourné silencieusement.

---

## 10. Hors périmètre

- remplacer le catalogue par une bibliothèque tierce ;
- importer le catalogue complet de Hevy ;
- utiliser une IA ou une recherche réseau pour identifier un exercice ;
- inventer une taxonomie biomécanique exhaustive pour les 168 exercices ;
- fusionner automatiquement des exercices après import ;
- réparer automatiquement des séances existantes sans CSV ni confirmation ;
- prendre en charge une seconde source d’import avant qu’elle existe.

---

## 11. Critères d’acceptation

- aucune identité inconnue n’est automatiquement attribuée ;
- seules les confirmations utilisateur sont réutilisées sans nouvelle action ;
- le cas Pallof est classé dans les abdominaux et n’apparaît jamais comme
  développé d’épaules ;
- le CSV réel produit 6 séances, 25 exercices source et 136 séries ;
- un second import ne crée aucun doublon ;
- l’import reste entièrement hors ligne et transactionnel ;
- typecheck, tests, lint et build passent ;
- le checkpoint téléphone confirme les deux séances `LOWER A`, les analyses
  musculaires et l’absence de doublons au second import.
