# Centralisation des plans de repos par bloc

**Statut :** design approuvé par l’instruction de continuer sans validation  
**Périmètre :** calcul pur partagé entre l’ordre des supersets et le minuteur de séance

## Contexte

`WorkoutScreen` construit actuellement une `Map` locale qui indique, pour
chaque exercice :

- s’il termine son bloc ;
- combien de secondes de repos appliquer au bloc.

Cette fonction assemble deux règles déjà définies ailleurs :

1. `toBlocks` détermine les blocs simples et les supersets ;
2. `resolveRestSeconds` normalise chaque durée de repos.

La durée d’un superset est le maximum des durées de ses membres. Seul le
dernier membre du bloc déclenche ensuite le repos. Cette connaissance détermine
le comportement du minuteur, mais elle vit encore dans un écran React.

La baseline ciblée est verte : les 21 tests de `rest` et les 24 tests de
`routineOrder` passent avant modification.

## Approches examinées

### 1. Conserver le calcul dans `WorkoutScreen`

Le comportement resterait stable à court terme, mais la règle métier
continuerait de dépendre d’un écran volumineux et serait difficile à tester
directement.

### 2. Créer un helper propre à la feature workout

Cette extraction allégerait l’écran, mais créerait un module superficiel qui ne
ferait qu’orchestrer les deux fonctions métier existantes.

### 3. Approfondir `lib/rest` — retenu

`rest` possède déjà la résolution des durées et la décision de déclencher le
minuteur. Lui confier la planification par bloc réunit le cycle complet du
repos dans un module pur :

- résoudre les durées ;
- choisir la durée commune du bloc ;
- identifier la fin du bloc ;
- décider si une série validée déclenche le repos.

La suppression de cette fonction redistribuerait ces règles dans
`WorkoutScreen`, ce qui confirme que le module gagne en profondeur.

## Interface

```ts
export interface RestPlan {
  isLastOfBlock: boolean;
  seconds: number;
}

export function restPlans<
  T extends Groupable & { id: string; restSeconds?: number },
>(rows: readonly T[]): Map<string, RestPlan>;
```

L’interface accepte uniquement les propriétés nécessaires. Elle ne connaît ni
`WorkoutExerciseDetail`, ni React, ni Dexie.

Les invariants sont :

- toute ligne reçoit un plan ;
- une ligne non groupée forme un bloc d’un élément ;
- tous les membres d’un superset partagent la plus grande durée résolue ;
- seul le dernier membre du bloc a `isLastOfBlock: true` ;
- les valeurs absentes, nulles ou invalides suivent `resolveRestSeconds` ;
- l’entrée n’est jamais mutée.

## Consommateur

`WorkoutScreen` projette les détails chargés vers leurs lignes persistées :

```ts
const plans = restPlans(exercises.map(({ row }) => row));
```

L’écran conserve la lecture du plan et l’appel à `isRestTriggering`. Le store du
minuteur, les effets sonores, les séries, les données persistées et le rendu ne
changent pas.

## Erreurs et cas limites

- Une liste vide retourne une `Map` vide.
- Plusieurs blocs conservent des durées indépendantes.
- Un groupe non contigu suit la sémantique existante de `toBlocks` : chaque run
  est un bloc distinct.
- Une durée invalide est normalisée avant le calcul du maximum ; le résultat
  reste donc toujours positif.

## Vérification

Le cycle TDD ajoute des tests purs couvrant :

1. des lignes non groupées avec leurs durées propres ;
2. un superset dont tous les membres reçoivent le maximum ;
3. la normalisation d’une ancienne ligne sans durée ;
4. la non-mutation de l’entrée.

Deux mutations manuelles doivent être tuées :

- utiliser la durée du premier membre au lieu du maximum ;
- marquer chaque membre comme fin de bloc.

Après migration, `rg` doit trouver une seule définition de `RestPlan` et de
`restPlans`, toutes deux dans `lib/rest`. Lint, typecheck, suite Vitest complète
et build doivent passer.

## Hors périmètre

- Changer la durée par défaut ou la priorité des overrides.
- Modifier les règles warm-up, dropset ou failure.
- Changer le store, l’affichage ou les sons du minuteur.
- Modifier la représentation persistée des supersets.

## Checkpoint manuel

Sur le téléphone, lancer une séance comprenant un exercice simple puis un
superset dont les repos diffèrent. Vérifier que l’exercice simple déclenche sa
propre durée, qu’aucun repos ne démarre entre les membres du superset et que le
dernier membre déclenche la durée la plus longue du bloc.
