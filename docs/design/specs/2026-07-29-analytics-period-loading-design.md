# Centralisation du chargement des périodes d’analyse

**Statut :** design approuvé par le feu vert explicite de l’utilisateur  
**Périmètre :** orchestration commune des analyses globales, sans changement métier

## Contexte

`WeeklySessionsScreen`, `MuscleBalanceScreen` et `WeeklyVolumeScreen` répètent la
même orchestration :

1. calculer les bornes avec `periodBounds` ;
2. choisir entre les portées `period` et `all-history` ;
3. lire `listHistoricalWorkouts` ;
4. lire tous les timestamps terminés ;
5. décider si l’historique existait avant la fenêtre ;
6. représenter l’état de relecture.

Cette duplication porte une même connaissance et doit évoluer ensemble. Elle
présente aussi un risque de cohérence : `useLiveQuery` conserve son ancienne
valeur quand ses dépendances changent. Un écran peut donc associer
temporairement les nouvelles bornes aux anciennes séances s’il traite les
bornes et les résultats comme des valeurs indépendantes.

La baseline ciblée avant modification est verte : 67 tests couvrent la
projection historique, les périodes, les trois calculs analytiques et l’écran
de volume.

## Approches examinées

### 1. Extraire uniquement la construction de la portée

Une fonction pure transformerait `PeriodBounds` en `HistoricalScope`.

Cette option retire quelques lignes, mais laisse les deux lectures, le calcul
`hasEarlierHistory` et la cohérence du chargement dans chaque écran. Le module
serait superficiel : sa suppression ne redistribuerait presque aucune
complexité.

### 2. Ajouter une lecture agrégée dans les repositories

Un repository pourrait retourner les séances de la période et l’existence
d’un historique antérieur.

La connaissance concernée appartient cependant à l’orchestration des analyses :
elle combine une période d’affichage, deux repositories déjà profonds et un
état de relecture React. La placer dans `data/repositories` ferait remonter une
préoccupation d’écran dans la couche de données et nécessiterait encore un hook.

### 3. Créer un hook profond dans `features/analytics` — retenu

`useHistoricalPeriod(period, openedAt)` devient la seam commune aux trois
écrans. Il cache le calcul des bornes, le choix de portée, les deux lectures et
le calcul d’antériorité. Il retourne un snapshot cohérent et un booléen
`stale`.

La suppression de ce hook redistribuerait toute l’orchestration dans trois
appelants : le module gagne donc réellement sa place.

## Interface

```ts
interface HistoricalPeriodData {
  bounds: PeriodBounds;
  workouts: HistoricalWorkout[];
  hasEarlierHistory: boolean;
}

interface HistoricalPeriodResult {
  data: HistoricalPeriodData | undefined;
  stale: boolean;
}

function useHistoricalPeriod(
  period: PeriodKey,
  openedAt: number,
): HistoricalPeriodResult;
```

`openedAt` reste fixé une fois par écran : les bornes ne glissent pas à minuit.
Le hook ne possède pas la période sélectionnée et ne décide d’aucun texte ou
état visuel.

## Cohérence du snapshot

Le résultat interne porte la clé exacte de la fenêtre demandée. Au changement
de période, Dexie peut encore rendre le snapshot précédent ; le hook le garde
comme `data`, mais marque `stale: true` jusqu’à ce que la clé du résultat
corresponde à la clé demandée.

Les consommateurs utilisent toujours `data.bounds` avec `data.workouts`. Ils ne
peuvent donc pas combiner de nouvelles bornes avec d’anciennes séances.

À la première lecture, `data` vaut `undefined` et `stale` vaut `true`. Aucun faux
état vide n’est affiché. Lors d’une relecture, le rendu précédent reste
disponible à opacité réduite, conformément aux designs des analyses.

## Consommateurs

- `WeeklySessionsScreen` conserve sa lecture séparée des objectifs
  hebdomadaires, qui n’est pas commune aux autres écrans.
- `MuscleBalanceScreen` consomme le snapshot pour les séances, les bornes et
  l’antériorité.
- `WeeklyVolumeScreen` supprime son état local `ResolvedVolumeQuery`, désormais
  absorbé par le hook.
- `ExerciseAnalyticsScreen` reste inchangé : sa portée est liée à un exercice
  et il n’a pas besoin de la seconde lecture.

Les moteurs purs `weeklySessionCounts`, `muscleBalance` et
`weeklyVolumeBuckets` ne changent pas.

## Erreurs et cas limites

- Une période sans séance retourne un snapshot avec `workouts: []`.
- `all` utilise `all-history` et produit `hasEarlierHistory: false`.
- Une période bornée distingue correctement « historique antérieur » et
  « aucun historique avant la fenêtre ».
- Les erreurs Dexie continuent de remonter à la frontière d’erreur React via
  `useLiveQuery`.
- Une mise à jour de la base réveille la lecture, comme avant.

## Vérification

Un test du hook avec `fake-indexeddb` doit prouver :

1. la sélection bornée et le calcul de `hasEarlierHistory` ;
2. la portée `all-history` ;
3. la conservation atomique du snapshot précédent avec `stale: true` pendant
   un changement de période.

Les tests analytiques et d’écran existants doivent rester inchangés dans leurs
assertions métier. La vérification finale comprend lint, typecheck, suite
Vitest complète et build de production.

La mutation est `N/A` : aucune règle pure n’est refactorisée. Le test du hook
contre IndexedDB réel, les tests des repositories et les tests purs existants
constituent la preuve alternative proportionnée.

## Hors périmètre

- Cache partagé entre routes ou persistant.
- Nouvelle requête Dexie ou nouvel index.
- Changement des périodes ou des calculs analytiques.
- Migration de `ExerciseAnalyticsScreen`.
- Nouveau texte, nouvel écran ou changement visuel.

## Checkpoint manuel

Sur le téléphone, ouvrir les trois analyses globales, passer successivement de
12 à 4 semaines puis à `Tout`, et vérifier que l’ancien rendu reste brièvement
visible pendant la lecture sans afficher un faux état vide. Les chiffres,
semaines et répartitions doivent rester identiques.
