# Projection historique — correctif P0 puis refactorisation

**Date :** 2026-07-29
**Statut :** approuvé
**Prérequis :** phase 0 terminée au commit `48d5ae5`

## Objectif

Rendre la lecture historique bornée utilisable sur un gros historique, puis
transformer cette lecture en module profond sans modifier les comportements
visibles, le schéma Dexie ni les données enregistrées.

Le travail est livré en deux tranches strictement séparées :

1. un correctif P0 de performance, avec sa preuve comparative ;
2. une refactorisation structurelle, avec sa propre preuve de préservation.

La seconde tranche ne commence que si la première est commitée et si toutes les
portes qualité sont vertes.

## État de référence

La baseline `docs/baselines/2026-07-28-refactor-baseline.md` mesure un historique
déterministe de 2 000 séances, 16 000 lignes et 64 000 séries.

Sur cette base :

- `listHistoryPage({}, 0, 20)` prend 657,25 ms de médiane ;
- `listCompletedWorkoutTimestamps()` prend 22,00 ms de médiane ;
- `listExportSources({ kind: 'period', ... })` sur une année prend
  44 954,76 ms de médiane et 54 151,90 ms de moyenne.

La lecture annuelle est le P0. Elle sélectionne correctement les séances avec
l’index `startedAt`, puis charge les lignes et séries de tous les identifiants
retenus au moyen de deux grandes requêtes `anyOf`. La phase de sélection n’est
donc pas le problème observé ; le chargement du graphe lié l’est.

## Contraintes

- Aucun changement de comportement, de texte d’interface ou de route.
- Aucun changement du schéma Dexie et aucune migration.
- Aucun quota ou seuil fonctionnel sur la quantité d’historique.
- Toutes les lectures restent locales et hors ligne.
- Aucun composant n’accède directement à `db`.
- Les règles de soft-delete, de séance terminée et de série validée restent
  identiques.
- Les exercices supprimés de la bibliothèque restent disponibles comme fallback
  historique.
- `from` reste inclusif et `to` exclusif.
- L’ordre reste : séances anciennes vers récentes, exercices et séries par
  `order`.
- Le correctif et la refactorisation sont commités séparément.

## Approches étudiées

### A — Lectures indexées bornées sur le schéma actuel

Conserver l’interface publique et le schéma, mais remplacer les grands `anyOf`
par des lectures bornées via l’index `workoutId`. Les résultats sont regroupés
derrière un helper interne qui masque la stratégie de lecture.

**Avantages :** changement minimal, aucune migration, aucune duplication de
donnée, correction réutilisable par toutes les portées.

**Inconvénient :** plusieurs lectures IndexedDB sont nécessaires, mais chacune
est petite, indexée et strictement limitée aux séances sélectionnées.

**Décision : retenue.**

### B — Dénormaliser la date de séance sur les lignes et séries

Ajouter `workoutStartedAt` aux lignes et séries permettrait une lecture directe
par intervalle.

**Rejet :** cette solution ajoute une migration, duplique une connaissance
métier et oblige chaque édition rétroactive de date à réécrire tout le graphe.
Le coût de cohérence est disproportionné pour corriger une stratégie de lecture.

### C — Une requête spécialisée par graphique

Chaque écran d’analyse pourrait lire uniquement les données dont il a besoin.

**Rejet pour cette tranche :** cela corrigerait certains symptômes tout en
dupliquant sélection, soft-delete, validation et résolution d’identité. Cette
option réduit le leverage et mélange le correctif P0 avec une nouvelle
architecture.

## Tranche 1 — Correctif P0

### Seam conservée

L’interface reste :

```ts
listExportSources(scope: ExportScope): Promise<ExportSource[]>
```

Les appelants, les types retournés et les règles métier ne changent pas.

### Stratégie de lecture

Après la sélection indexée des séances, les lignes et séries sont chargées par
`workoutId` avec des requêtes `equals` bornées. Un helper interne :

- reçoit une liste ordonnée et dédupliquée d’identifiants de séance ;
- retourne une liste aplatie de lignes ;
- ne lit aucune séance étrangère à la portée ;
- absorbe le détail de concurrence ou de séquencement des lectures ;
- rend immédiatement une liste vide si aucun identifiant n’est fourni.

Le correctif ne modifie ni la projection finale ni les règles de filtrage.

### Preuve du correctif

Le benchmark opt-in existant reste hors de `npm run test:run`. Il est enrichi
pour rendre explicites :

- le nombre de séances sélectionnées sur l’année ;
- la durée de chargement de la projection complète ;
- la comparaison avec la baseline versionnée.

Le correctif est accepté si, sur le même profil et le même hôte :

- la médiane annuelle est inférieure à 5 000 ms, soit au moins neuf fois plus
  rapide que la médiane de référence ;
- les tests de `listExportSources` restent inchangés dans leurs assertions
  métier et passent ;
- aucun nouveau scan intégral de `workoutExercises` ou `workoutSets` n’est
  introduit.

Le seuil reste une porte manuelle de benchmark, pas un seuil CI dépendant de la
vitesse d’une machine.

## Tranche 2 — Module profond de projection historique

### Problème structurel

`ExportSource` expose presque directement `Workout`, `WorkoutExercise`,
`Exercise` et `WorkoutSet`. Les exports et les analyses doivent donc connaître
le graphe persistant, parcourir ses relations et refaire leurs propres
projections.

Le module actuel gagne déjà sa place : sans lui, la sélection, les suppressions
logiques, les séries validées et le regroupement se disperseraient dans plusieurs
appelants. La refactorisation augmente sa **depth** au lieu d’ajouter une couche
de passage.

### Nouvelle seam

Le repository expose une seule lecture :

```ts
listHistoricalWorkouts(
  scope: HistoricalScope,
): Promise<HistoricalWorkout[]>
```

`HistoricalScope` conserve les quatre portées existantes :

- une séance ;
- un exercice, éventuellement borné ;
- une période ;
- tout l’historique.

`HistoricalWorkout` est un DTO canonique et indépendant de Dexie. Il contient
uniquement ce que les exports et analyses doivent connaître :

- identité, nom, notes, date, offset et durée de la séance ;
- exercices vivants de la séance, déjà ordonnés ;
- identité historique résolue de chaque exercice ;
- notes de la ligne ;
- séries vivantes et validées, déjà ordonnées ;
- valeurs réalisées nécessaires aux exports et calculs.

Il n’expose pas `createdAt`, `updatedAt`, `deletedAt`, les clés de relation ni
les objets Dexie complets. Les identifiants utiles aux exports avec option
`includeIds` sont conservés.

### Responsabilités absorbées

L’implémentation du module concentre :

- la sélection des séances par portée ;
- les bornes temporelles ;
- les statuts et suppressions logiques ;
- le chargement indexé du graphe ;
- le filtrage des séries non validées ;
- l’ordre des séances, exercices et séries ;
- le fallback d’identité historique via `resolveExerciseIdentity` ;
- la projection vers le DTO canonique.

Les exports et analyses ne connaissent plus la structure des tables.

### Adaptation des consommateurs

- `projectCoachExport` consomme le DTO canonique et conserve exactement son
  format de sortie actuel.
- Les modules analytics consomment le même DTO, ou une projection pure dérivée
  de celui-ci, sans accès aux entités persistantes.
- Les écrans conservent leur orchestration de chargement actuelle.
- La concentration des deux lectures communes aux trois écrans analytics reste
  un candidat ultérieur ; elle n’est pas incluse dans cette refactorisation.

L’ancienne interface `listExportSources` est supprimée après migration de tous
ses consommateurs. Aucun adapter de compatibilité permanent n’est conservé :
deux interfaces équivalentes rendraient le module plus superficiel.

## Flux de données

```text
HistoricalScope
  → sélection indexée des séances
  → chargement indexé des lignes et séries
  → règles persistantes et identité historique
  → HistoricalWorkout[]
      → export Markdown
      → séances hebdomadaires
      → volume hebdomadaire
      → équilibre musculaire
      → progression d’un exercice
```

## Erreurs et cas limites

- Une portée vide retourne `[]`.
- Une séance inconnue, active, abandonnée ou supprimée retourne `[]`.
- Une séance sans exercice reste présente, sauf dans une portée d’exercice.
- Une ligne supprimée et ses séries n’apparaissent jamais.
- Une série supprimée ou non validée n’apparaît jamais.
- Un exercice absent de la bibliothèque reste représenté avec les informations
  de son snapshot ; si snapshot et bibliothèque sont absents, son identité reste
  inconnue et l’aval applique son libellé actuel.
- Une bibliothèque modifiée après la séance ne repeint pas le snapshot.

## Vérification

### Correctif P0

1. Reproduire la mesure lente avant modification.
2. Ajouter la preuve de performance opt-in et observer son échec au seuil.
3. Appliquer uniquement la nouvelle stratégie de lecture.
4. Vérifier la preuve, les tests ciblés et le benchmark complet.
5. Lancer lint, typecheck, tests et build.
6. Commiter avec un message `fix:`.

### Refactorisation

1. Conserver le commit P0 comme baseline de sécurité.
2. Vérifier que les tests de projection couvrent toutes les portées et tous les
   cas limites listés ci-dessus.
3. Ajouter uniquement les preuves comportementales manquantes.
4. Remplacer l’interface et migrer les consommateurs sans changer les résultats.
5. Comparer les sorties d’export et d’analytics avant/après.
6. Relancer le benchmark pour vérifier l’absence de régression.
7. Lancer lint, typecheck, tests et build.
8. Commiter séparément avec un message `refactor:`.

La mutation est `N/A` pour la stratégie IndexedDB elle-même : son exigence est
de performance, pas une règle pure adaptée aux mutants. Les règles pures
touchées par la projection restent couvertes par leurs tests comportementaux ;
le benchmark comparatif et les tests repository constituent la preuve
alternative proportionnée.

## Hors périmètre

- Migration ou nouvel index Dexie.
- Cache persistant, pagination des exports ou limite d’historique.
- Web Worker.
- Changement des graphiques ou de leur chargement.
- Nouvelle fonctionnalité d’export.
- Concentration de l’orchestration commune aux trois écrans analytics.
- Correction opportuniste de `listHistoryPage`.

## Checkpoint manuel

Sur le téléphone, ouvrir successivement les analyses sur 4, 12, 26 et
52 semaines, puis `Tout`. Vérifier que les chiffres et les semaines restent
identiques, qu’un exercice supprimé conserve son nom historique et qu’un export
Markdown d’une séance existante ne change pas.
