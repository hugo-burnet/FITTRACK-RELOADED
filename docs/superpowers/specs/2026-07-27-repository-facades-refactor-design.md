# Refactorisation des repositories séances et routines

**Date :** 2026-07-27  
**Statut :** validé  
**Périmètre :** `src/data/repositories/workouts.ts` et
`src/data/repositories/routines.ts`

## Objectif

Découper les deux repositories devenus trop volumineux en modules à responsabilité
unique, avant de reprendre l’édition rétroactive du Lot 07B.

La refactorisation est strictement structurelle :

- aucune fonctionnalité ajoutée ou retirée ;
- aucune correction opportuniste ;
- aucune modification des contrats publics ;
- aucune modification du schéma Dexie, des données ou de l’interface ;
- aucune modification des fichiers 07B déjà changés et non committés.

## Contexte

`workouts.ts` compte 682 lignes et `routines.ts` 504 lignes. Ils regroupent chacun
plusieurs responsabilités indépendantes : cycle de vie, lectures composées,
composition des exercices et opérations sur les séries.

Le Lot 07B doit encore ajouter l’éditeur rétroactif. Continuer à faire croître ces
fichiers augmenterait le risque de modifier une transaction ou un comportement de
séance en direct pendant un travail portant sur l’historique.

Les modules actuels sont importés par de nombreux composants et tests. Deux fichiers
du Lot 07B, `src/data/repositories/history.ts` et `src/i18n/fr.ts`, contiennent déjà
des changements non committés qui doivent être préservés.

## Architecture retenue

### Façades publiques stables

`workouts.ts` et `routines.ts` restent les seuls points d’entrée publics existants.
Ils deviennent des façades composées uniquement de réexports explicites. Tous les
imports actuels continuent donc de fonctionner sans modification.

Les réexports explicites sont préférés aux exports globaux afin que l’API publique
reste lisible et qu’un nouvel export interne ne devienne pas public par accident.

### Découpage des séances

| Module | Responsabilité |
|---|---|
| `workouts.ts` | Façade publique stable |
| `workoutLifecycle.ts` | Démarrage, mise à jour, clôture, abandon et suppression d’une séance |
| `workoutExercises.ts` | Ajout, modification, suppression et réordre des exercices d’une séance |
| `workoutSets.ts` | Ajout, duplication, échauffement, saisie, validation, suppression et restauration des séries |
| `workoutDetail.ts` | Types et lecture composée `WorkoutDetail` |

`startWorkoutFromRoutine` reste dans `workoutLifecycle.ts` : son résultat est la
création atomique d’une séance, même s’il lit une routine pour construire son
instantané initial.

### Découpage des routines

| Module | Responsabilité |
|---|---|
| `routines.ts` | Façade publique stable |
| `routineFolders.ts` | Lecture et mutations des dossiers |
| `routineLifecycle.ts` | Lectures composées, création, mise à jour, duplication, réordre et suppression des routines |
| `routineExercises.ts` | Ajout, modification, suppression, réordre et supersets des exercices |
| `routineSets.ts` | Ajout, mise à jour, application groupée et suppression des séries planifiées |

La duplication profonde reste dans `routineLifecycle.ts` parce qu’elle représente
une mutation atomique de l’agrégat routine complet.

## Préservation des comportements

Les fonctions sont déplacées, pas réécrites. La refactorisation conserve :

- les mêmes noms, paramètres, types de retour et erreurs ;
- les mêmes valeurs par défaut ;
- les mêmes tris et règles de normalisation des supersets ;
- les mêmes appels à `newEntity`, `touch`, `softDelete` et `alive` ;
- les mêmes tables et portées de transactions Dexie ;
- le même ordre des lectures et écritures à l’intérieur des transactions ;
- les mêmes soft-deletes, timestamps et renumérotations ;
- les mêmes champs dénormalisés sur les séries.

Les petits helpers privés restent dans le module qui les consomme. Un helper ne sera
partagé que s’il est nécessaire à deux modules après la coupe ; aucune abstraction
générique ne sera créée uniquement pour supprimer quelques lignes identiques.

## Compatibilité et dépendances

Les composants, les tests et `history.ts` continuent d’importer :

```ts
import { ... } from '@/data/repositories/workouts';
import { ... } from '@/data/repositories/routines';
```

Les nouveaux modules sont des détails internes du dossier `repositories`. Aucun
composant ne les importe directement dans cette refactorisation.

Il ne doit pas exister de dépendance circulaire entre modules spécialisés. Les
fonctions privées nécessaires à une transaction restent dans le même module que la
fonction publique qui ouvre cette transaction.

## Tests et vérification

Les suites existantes restent inchangées et continuent d’importer les façades. Elles
valident ainsi simultanément les comportements et la compatibilité de l’API publique.

La refactorisation est acceptée si :

1. le diff ne contient aucun changement dans `history.ts`, `fr.ts` ou les composants ;
2. les façades exportent exactement les mêmes symboles qu’avant ;
3. chaque module spécialisé reste focalisé et vise moins de 300 lignes ;
4. `npm run lint` passe ;
5. `npm run typecheck` passe ;
6. `npm run test:run` passe sans diminution du nombre de tests ;
7. `npm run build` passe avec, au plus, le warning Vite déjà connu sur le chunk
   principal supérieur à 500 kB.

## Hors périmètre

- reprendre la Task 3 du Lot 07B ;
- déplacer les tests dans plusieurs fichiers ;
- modifier les imports des consommateurs vers les nouveaux modules ;
- corriger un défaut fonctionnel découvert pendant la coupe ;
- optimiser les requêtes Dexie ;
- modifier les textes d’interface ;
- rembourser d’autres dettes techniques.

Tout défaut fonctionnel découvert sera documenté séparément et traité après cette
refactorisation.
