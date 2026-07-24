# RF-29 — Calculateur d’échauffement

**Date :** 2026-07-24
**Lot :** 6, tranche 3, tâche 4 sur 5
**Périmètre :** RF-29 uniquement. RF-31 (poids de barre et réglages globaux de charge) reste hors
périmètre.

## 1. Objectif

Ajouter, pendant une séance en direct, une rampe de séries d’approche calculée à partir de la
charge de travail d’un exercice.

Les séries générées sont immédiatement persistées dans IndexedDB, apparaissent avant les séries de
travail et naissent avec `setType: 'warmup'`. Elles restent donc exclues du volume, des records et
du déclenchement du repos par les règles déjà livrées avec RF-20.

Le calculateur ne remplace pas un échauffement général et ne prétend pas personnaliser une
prescription médicale. Il automatise seulement une rampe de charge explicite choisie par
l’utilisateur.

## 2. Décision de produit

Le calculateur utilise une rampe en pourcentages, modifiable à chaque insertion. Cette approche est
retenue face à deux alternatives :

- une formule fixe, plus rapide mais artificiellement rigide ;
- une formule adaptative selon la charge, plus automatique mais opaque.

La rampe configurable garde le résultat prévisible et ne limite pas le nombre de séries.

### Méthode proposée à l’ouverture

| Étape | Pourcentage de la charge de travail | Répétitions |
|---|---:|---:|
| 1 | 40 % | 10 |
| 2 | 60 % | 5 |
| 3 | 80 % | 3 |

L’utilisateur peut modifier les pourcentages et répétitions, supprimer une étape ou en ajouter
autant qu’il le souhaite. Cette configuration est locale à la feuille ouverte et n’est pas
persistée comme réglage global. La persistance d’une méthode préférée appartient à un futur écran de
réglages, pas à RF-29.

## 3. Contrat de `src/lib/warmup.ts`

Le module est pur : aucun import React, Dexie, type d’exercice ou texte d’interface.

### Entrée

```ts
interface WarmupInput {
  targetWeightKg: number;
  incrementKg: number;
  minimumWeightKg?: number;
  steps: WarmupStep[];
}

interface WarmupStep {
  percentage: number;
  reps: number;
}
```

- `targetWeightKg` : charge de la première série de travail.
- `incrementKg` : pas de charge disponible. RF-29 passe `2.5`.
- `minimumWeightKg` : charge minimale physiquement utilisable, par exemple une barre vide.
- `steps` : liste ordonnée et sans limite artificielle.

### Sortie

```ts
interface WarmupSetSuggestion {
  weightKg: number;
  reps: number;
}
```

La sortie conserve l’ordre des étapes valides.

### Validation

- `targetWeightKg` et `incrementKg` doivent être finis et strictement positifs.
- `minimumWeightKg`, s’il est fourni, doit être fini et positif ou nul.
- Chaque `percentage` doit être fini et strictement compris entre 0 et 100.
- Chaque `reps` doit être un entier strictement positif.
- Une entrée invalide déclenche une `RangeError`. L’interface empêche l’insertion tant que ses
  valeurs sont incomplètes ou invalides ; elle n’appelle pas le moteur pendant une saisie
  intermédiaire invalide.

### Arrondi

Les calculs utilisent des centièmes de kilogramme entiers.

Pour chaque étape :

1. `raw = targetWeightKg × percentage / 100` ;
2. `rounded = floor(raw / incrementKg) × incrementKg` ;
3. `clamped = max(rounded, minimumWeightKg ?? 0)` ;
4. la suggestion n’est rendue que si `0 < clamped < targetWeightKg`.

L’arrondi descend toujours : une série ne dépasse jamais le pourcentage demandé. Une charge minimale
peut toutefois relever le résultat jusqu’à la charge physiquement utilisable.

Deux étapes qui aboutissent à la même charge restent deux étapes distinctes. Le moteur ne fusionne
ni ne supprime silencieusement une série explicitement demandée.

## 4. Disponibilité

L’action est disponible uniquement lorsque la mesure de l’exercice possède un poids dont le rôle
est une charge réelle (`weightRole: 'load'`).

Elle est donc disponible pour les mouvements à charge tels que barre, haltères, machines, câbles ou
Smith. Elle n’est pas proposée pour :

- les exercices au poids du corps ;
- la charge ajoutée au poids du corps ;
- les exercices assistés, où une charge plus élevée rend le mouvement plus facile ;
- les exercices mesurés uniquement en répétitions, temps ou distance.

Cette exclusion est sémantique, pas un quota : appliquer le même pourcentage à ces mesures donnerait
une recommandation trompeuse.

## 5. Emplacement et interface

### Point d’entrée

L’action « Calculer l’échauffement » vit dans le menu `⋯` de la carte exercice.

Le header possède déjà :

- l’identité et le statut de l’exercice ;
- l’accès au calculateur de plaques quand il s’applique ;
- le menu `⋯`.

Ajouter une troisième icône d’outil surchargerait la carte et rendrait la nouvelle action ambiguë.
Le menu est également le point d’entrée utilisé par le produit de référence.

### Feuille

La feuille d’échauffement contient :

1. la charge de travail ;
2. la liste éditable des étapes ;
3. pour chaque étape : pourcentage, répétitions et résultat calculé en kg ;
4. une action neutre de suppression par étape ;
5. « Ajouter une étape » ;
6. l’action pleine largeur « Insérer les séries ».

La charge de travail est préremplie depuis la première série non-échauffement possédant, dans cet
ordre, `weight` puis `targetWeight`. Elle reste modifiable avant insertion. Sans charge connue, le
champ reste vide.

Tous les contrôles interactifs mesurent au moins 48 px de haut. La feuille peut défiler dans sa
hauteur maximale existante. Elle n’ajoute aucune colonne ni aucun badge à la grille principale.

### Couleur

La feuille reste entièrement neutre :

- surfaces et bordures existantes ;
- texte `--text-1` et `--text-2` ;
- focus visible neutre ;
- aucun `--accent-ink` ni `--color-accent`.

L’accent reste réservé aux records et aux séries validées.

### États

- Tant que la charge ou une étape est invalide, l’insertion est désactivée et une explication
  concise indique la valeur à corriger.
- Si aucune suggestion n’est strictement inférieure à la charge de travail, la feuille indique
  qu’aucune charge d’approche n’est disponible avec ce pas.
- Pendant l’écriture IndexedDB, l’action est désactivée pour empêcher un double appui.
- Si la transaction échoue, la feuille reste ouverte et affiche une erreur localisée ; aucune série
  partielle ne doit apparaître.
- Après succès, la feuille se ferme et l’abonnement Dexie met la carte à jour.

Tous les textes vivent dans `src/i18n/fr.ts`.

## 6. Persistance atomique

Un nouveau repository insère une liste de suggestions dans un seul
`db.transaction('rw', db.workoutExercises, db.workoutSets, ...)`.

Dans la transaction :

1. lire la ligne `WorkoutExercise` parente et refuser une ligne absente ;
2. lire et trier les séries vivantes ;
3. créer toutes les nouvelles séries avec :
   - `setType: 'warmup'` ;
   - `targetWeight` et `targetReps` ;
   - aucun `weight` ni `reps` réalisé ;
   - `side: 'both'` ;
   - `isCompleted: 0` ;
   - `performedAt: 0` ;
   - les identités dénormalisées venant du parent ;
4. placer les nouvelles séries aux premiers rangs, dans l’ordre des suggestions ;
5. décaler et renuméroter toutes les séries vivantes existantes ;
6. écrire les nouvelles lignes et les lignes renumérotées avant le commit.

La lecture de l’ordre et toutes les écritures appartiennent à la même transaction. Deux insertions
concurrentes sont ainsi sérialisées par IndexedDB et ne peuvent produire deux séries vivantes au
même `order`.

Les lignes supprimées logiquement ne participent ni au calcul des rangs ni à la renumérotation.
Aucune limite n’est posée sur la taille de la liste insérée.

## 7. Tests

### TDD — moteur pur

`src/lib/warmup.test.ts` est écrit et exécuté en rouge avant `src/lib/warmup.ts`.

Les cas couvrent :

- la rampe par défaut ;
- l’arrondi inférieur au pas de 2,5 kg ;
- les poids décimaux sans erreur flottante ;
- la charge minimale ;
- l’exclusion d’un résultat nul ou atteignant la charge de travail ;
- deux étapes arrondies au même poids, conservées séparément ;
- zéro, une et de nombreuses étapes ;
- chaque famille d’entrée invalide.

### TDD — repository

Les tests du repository sont écrits et exécutés en rouge avant l’implémentation :

- les séries générées sont des `warmup` non réalisées, avec des cibles ;
- elles précèdent les séries existantes ;
- les rangs restent continus et uniques ;
- les valeurs, types et états des séries de travail restent inchangés ;
- les lignes soft-deleted ne perturbent pas l’ordre ;
- deux insertions lancées dans le même tick ne créent aucun rang dupliqué ;
- une erreur provoque un rollback sans insertion partielle.

### Pilotage réel à 375 px

Sur le serveur principal, base `/FITTRACK-RELOADED/` :

1. ouvrir une séance active contenant un exercice à charge et des séries de travail ;
2. ouvrir `⋯`, puis « Calculer l’échauffement » ;
3. mesurer les rectangles DOM de tous les contrôles ;
4. vérifier `scrollWidth === innerWidth` ;
5. lire `getComputedStyle` des contrôles, sélections et focus pour confirmer l’absence d’accent ;
6. modifier une étape et insérer ;
7. relire IndexedDB : types, cibles, ordre et séries de travail ;
8. recharger complètement ;
9. relire le DOM et IndexedDB pour confirmer la réhydratation depuis Dexie ;
10. vérifier qu’aucune erreur console n’est apparue.

## 8. Hors périmètre

- RF-31 : poids de barre modifiable.
- Réglages globaux ou méthode d’échauffement persistée.
- Inventaire de plaques et incréments personnalisés par équipement.
- Calcul à partir du 1RM.
- Échauffement général, mobilité, cardio ou recommandations médicales.
- Ajout du calculateur à l’éditeur de routines.
