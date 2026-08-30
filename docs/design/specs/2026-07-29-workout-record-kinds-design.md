# Centralisation des records visibles pendant la séance

**Statut :** design approuvé par l’instruction de continuer sans validation  
**Périmètre :** projection pure des séries de la séance vers leur record principal

## Contexte

`lib/records` possède déjà toutes les règles de comparaison :

- exclusion des échauffements ;
- meilleur poids, meilleures répétitions et meilleur volume ;
- ancienneté en cas d’égalité ;
- ordre de priorité des records battus.

`WorkoutScreen` conserve pourtant la dernière étape métier. À chaque rendu, il
parcourt les exercices et leurs séries, ignore les séries non validées, retrouve
l’univers de comparaison, appelle `recordsBeatenBy`, puis ne garde que le
premier record pour chaque identifiant de série.

Cette étape décide quelles félicitations sont visibles dans la séance. Elle est
donc une règle de records, pas une responsabilité React.

La baseline ciblée est verte : les 25 tests de `records` passent avant
modification.

## Approches examinées

### 1. Conserver la boucle dans `WorkoutScreen`

Cela évite une nouvelle interface, mais laisse l’écran décider quelles séries
comptent et comment réduire plusieurs records à un seul message.

### 2. Extraire un helper dans la feature workout

L’écran serait plus court, mais la règle resterait séparée du moteur qui définit
et classe les records. Ce module de feature ne posséderait aucune abstraction
propre.

### 3. Approfondir `lib/records` — retenu

Le module reçoit les groupes de séries de la séance et les univers historiques,
puis rend directement la `Map` consommée par les cartes. Il réunit ainsi la
comparaison et la politique d’affichage du record principal, tout en restant
pur et indépendant de React, Dexie et des types de repository.

## Interface

```ts
export interface WorkoutRecordGroup {
  exerciseId: string;
  sets: readonly WorkoutSet[];
}

export function workoutRecordKinds(
  groups: readonly WorkoutRecordGroup[],
  setsByExercise: ReadonlyMap<string, WorkoutSet[]> | undefined,
): Map<string, RecordKind>;
```

Les invariants sont :

- une donnée historique encore indisponible produit une `Map` vide ;
- un exercice sans univers de comparaison est ignoré ;
- seules les séries validées de la séance peuvent recevoir un record ;
- la série est comparée à tout son univers, elle-même comprise ;
- si plusieurs records tombent, seul le premier de `recordsBeatenBy` est gardé ;
- les entrées ne sont jamais mutées.

Le type `WorkoutRecordGroup` exprime uniquement les deux informations
nécessaires. Il ne dépend ni de `WorkoutExerciseDetail`, ni de l’entité
`WorkoutExercise`.

## Consommateur

`WorkoutScreen` projette ses détails :

```ts
const records = workoutRecordKinds(
  exercises.map(({ row, sets }) => ({ exerciseId: row.exerciseId, sets })),
  recordSets,
);
```

Les cartes continuent à recevoir exactement la même `Map<string, RecordKind>`.
La requête live, les données persistées, les textes et le rendu restent
inchangés.

## Erreurs et cas limites

- Une liste vide ou une requête live en attente rend une `Map` vide.
- Plusieurs blocs du même exercice consultent le même univers, comme avant.
- Une série incomplète présente dans les détails n’est pas célébrée même si ses
  valeurs battraient un record.
- Un record double garde `heaviest` avant `bestVolume`, selon l’ordre canonique
  de `recordsBeatenBy`.

## Vérification

Le cycle TDD ajoute des tests purs couvrant :

1. l’absence d’univers pendant le chargement ;
2. l’exclusion d’une série non validée ;
3. la conservation du record principal lorsqu’une série en bat deux ;
4. l’isolation de plusieurs exercices.

Deux mutations manuelles doivent être tuées :

- retirer le filtre `isCompleted === 1` ;
- prendre le dernier record battu au lieu du premier.

Après migration, `WorkoutScreen` ne doit plus importer ni appeler
`recordsBeatenBy`. Lint, typecheck, suite Vitest complète et build doivent
passer.

## Hors périmètre

- Changer la définition ou l’ordre des records.
- Ajouter l’affichage simultané de plusieurs records.
- Modifier `listRecordSets` ou ses index Dexie.
- Ajouter de nouveaux types de records.

## Checkpoint manuel

Sur le téléphone, ouvrir une séance avec un historique existant. Saisir une
série qui bat à la fois la charge et le volume : une seule félicitation
« Charge max » doit apparaître. Décocher la série doit la faire disparaître,
puis la recocher doit la restaurer.
