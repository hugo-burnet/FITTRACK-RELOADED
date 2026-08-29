# Séance en cours — test d’intégration de persistance

**Date :** 2026-07-29  
**Portée :** phase 6 de la stratégie de refactorisation, premier parcours critique  
**Nature :** preuve de préservation, aucun changement fonctionnel

## But

Protéger automatiquement la règle non négociable « pas de perte de données » avant de déplacer
des responsabilités hors de `WorkoutScreen`.

Le test doit prouver qu’une valeur saisie dans une série traverse réellement React, les
repositories et Dexie, puis réapparaît après le démontage complet et le remontage de l’écran. Il
doit aussi prouver que la validation de la série est persistée immédiatement.

## Approches considérées

### 1. Reprise d’une séance en cours — retenue

Monter le vrai `WorkoutScreen` avec un routeur mémoire, saisir une charge et des répétitions,
attendre leur écriture IndexedDB, démonter l’écran, le remonter, puis valider la série.

Cette approche couvre l’invariant le plus risqué avec la plus petite interface de test utile :
les contrôles accessibles de l’écran et les données relues depuis le repository.

### 2. Composition complète d’une routine

Traverser `RoutinesScreen`, `RoutineEditorScreen` et `ExercisePickerScreen` jusqu’au résumé de la
routine. Ce scénario protège bien le futur découpage de `RoutinesScreen`, mais implique davantage
de feuilles et de navigation et ne couvre pas directement la persistance en salle.

Il deviendra le deuxième parcours d’intégration.

### 3. Détail d’historique

Tester une séance archivée puis son export. Cette zone possède déjà des tests React qui traversent
Dexie, le routeur et le partage. Le gain marginal est inférieur.

## Scénario retenu

1. Réinitialiser la base avec `resetDb`.
2. Créer un exercice `Développé couché`, une routine et sa série initiale avec les repositories
   réels.
3. Démarrer une séance depuis cette routine.
4. Monter `WorkoutScreen` sur la route `/workout`.
5. Saisir `80` dans « Série 1 — kg » et `10` dans « Série 1 — reps ».
6. Attendre que la série Dexie contienne `weight: 80`, `reps: 10`, `isCompleted: 0` et
   `performedAt: 0`.
7. Démonter entièrement l’arbre React, puis remonter le même écran.
8. Vérifier que les deux champs relisent `80` et `10`.
9. Valider la série depuis le contrôle « Valider la série 1 ».
10. Attendre que Dexie contienne `isCompleted: 1` et un `performedAt` strictement positif.

## Frontière de comportement

Le test conserve :

- la saisie écrit à chaque changement, sans action « enregistrer » ;
- une séance active est retrouvée depuis IndexedDB après remontage ;
- charge et répétitions restent des valeurs réalisées, distinctes des objectifs ;
- la validation conserve les valeurs et ajoute l’état terminé avec son instant.

Le test ne fige pas :

- le chronomètre de séance ou de repos ;
- le son ;
- les records ;
- le repli visuel des cartes ;
- le drag-and-drop ;
- les classes CSS, animations ou détails de mise en page ;
- la fin et l’archivage de la séance, qui formeront une tranche distincte.

## Architecture du test

Le test vit dans `src/features/workout/WorkoutScreen.integration.test.tsx`.

Il utilise :

- `MemoryRouter`, sans monter le routeur hash singleton ;
- `fake-indexeddb/auto`, déjà chargé globalement ;
- `resetDb`, avant chaque scénario ;
- les repositories publics pour préparer et relire les données ;
- Testing Library et `userEvent` pour les gestes ;
- `waitFor` sur les lectures Dexie, jamais de délai arbitraire.

Dexie, `useLiveQuery` et les repositories ne sont pas mockés. Le store Zustand du repos est arrêté
avant et après le test afin qu’un état éphémère singleton ne fuite pas vers un autre fichier.

## Preuve de sensibilité

Le comportement existe déjà ; un test de caractérisation pourrait donc passer dès sa première
exécution. Pour prouver qu’il protège réellement la reprise, la tranche inclut un mutant manuel
temporaire : empêcher `WorkoutScreen` de transmettre une modification de série au repository.

Le nouveau test doit alors échouer sur l’attente Dexie. Le code original est restauré
immédiatement, puis le test doit repasser. Le mutant n’est jamais commité.

## Critères d’acceptation

- le test ciblé passe sans erreur ni avertissement React ;
- le mutant manuel est tué par ce test ;
- aucun fichier de production n’est modifié dans le diff final ;
- aucune dépendance et aucun texte UI ne changent ;
- lint, typecheck, toute la suite Vitest et le build de production passent ;
- `PROGRESS.md` consigne la preuve et le prochain parcours d’intégration.
