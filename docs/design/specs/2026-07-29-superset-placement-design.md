# Centralisation du placement des supersets

**Statut :** design approuvé par l’instruction de continuer sans validation  
**Périmètre :** règle pure partagée entre l’éditeur de routine et la séance

## Contexte

`RoutineEditorScreen` et `WorkoutScreen` contiennent deux fonctions
`supersetPlaces` identiques. Chaque fonction :

1. projette les lignes vers leurs entités ordonnées ;
2. appelle `toBlocks` ;
3. ignore les blocs non groupés ;
4. associe chaque identifiant à `{ index, size }`.

Les deux cartes consommatrices déclarent aussi leur propre type
`SupersetPlace`, strictement identique. Cette duplication porte la même
connaissance : la position A/B/C d’un exercice et les extrémités du filet
visuel sont deux lectures du même superset persistant. Toute évolution devrait
modifier quatre endroits ensemble.

La baseline ciblée est verte : les 20 tests de `routineOrder` passent avant
modification.

## Approches examinées

### 1. Conserver les fonctions dans les écrans

Cette option ne prend aucun risque immédiat, mais laisse une même règle métier
dans deux consommateurs. Le prochain changement de représentation peut faire
diverger routine et séance.

### 2. Créer un helper dans chaque feature

Déplacer les fonctions hors des écrans réduirait leur taille sans supprimer la
duplication. Les modules seraient superficiels et la connaissance resterait
dispersée.

### 3. Approfondir `lib/routineOrder` — retenu

`routineOrder` possède déjà l’interface canonique des supersets :
`normalizeSupersets` pour l’écriture et `toBlocks` pour la lecture. Ajouter
`supersetPlaces` cache la dernière projection commune derrière la même seam.

La suppression de cette fonction redistribuerait la règle dans deux écrans et
deux types de carte : elle apporte donc de la locality et du leverage.

## Interface

```ts
export interface SupersetPlace {
  index: number;
  size: number;
}

export function supersetPlaces<T extends Groupable & { id: string }>(
  rows: readonly T[],
): Map<string, SupersetPlace>;
```

L’interface accepte uniquement ce dont la règle a besoin : `id` et
`supersetGroup`. Elle ne connaît ni `RoutineExerciseDetail`, ni
`WorkoutExerciseDetail`, ni React.

Les invariants sont :

- une ligne non groupée n’a aucune entrée ;
- chaque membre d’un bloc groupé reçoit son index à partir de zéro ;
- `size` vaut le nombre total de membres du bloc ;
- l’ordre et les identifiants sont conservés ;
- l’entrée n’est jamais mutée.

## Consommateurs

- `RoutineEditorScreen` appelle la fonction avec
  `exercises.map(({ row }) => row)`.
- `WorkoutScreen` fait la même projection.
- `RoutineExerciseCard` et `WorkoutExerciseCard` importent le type partagé.

Les cartes, leurs lettres A/B/C, leurs filets, leurs styles et leurs props
restent inchangés.

## Erreurs et cas limites

- Une liste vide retourne une `Map` vide.
- Des lignes non groupées consécutives restent absentes.
- Plusieurs blocs reçoivent des tailles indépendantes.
- Un groupe non contigu est traité selon `toBlocks` : chaque run constitue son
  propre bloc, conformément à la représentation déjà utilisée.

## Vérification

Le cycle TDD ajoute des tests purs couvrant :

1. l’absence d’entrée pour les lignes non groupées ;
2. les index et la taille d’un bloc de trois ;
3. deux blocs indépendants entourés de lignes seules ;
4. la non-mutation de l’entrée.

Deux mutations manuelles doivent être tuées par ces tests :

- ne plus ignorer `group === 0` ;
- remplacer la taille du bloc par `1`.

Après migration, `rg` doit trouver une seule définition de `SupersetPlace` et
une seule définition de `supersetPlaces`. Lint, typecheck, suite Vitest complète
et build doivent passer.

## Hors périmètre

- Changer la normalisation ou la numérotation persistée des supersets.
- Modifier le rendu, la couleur, les lettres ou l’interaction.
- Fusionner les deux cartes d’exercice.
- Extraire d’autres calculs de `WorkoutScreen`.

## Checkpoint manuel

Sur le téléphone, ouvrir une routine avec un superset de trois exercices, puis
démarrer la séance. Dans les deux écrans, vérifier les mêmes lettres A/B/C et le
même filet continu, avant et après un réordonnancement.
