# Hevy Exercise Picker Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les filtres Muscle et Matériel au choix manuel d’un exercice Hevy.

**Architecture:** L’état reste local à `HevyExerciseMappingSheet`. Une fonction pure combine la compatibilité du type de mesure, la recherche, le muscle et le matériel ; l’interface réutilise `FilterChip` et `OptionSheet`.

**Tech Stack:** React, TypeScript strict, Testing Library, Vitest, Tailwind CSS v4.

## Global Constraints

- Réutiliser les libellés français et composants de filtre existants.
- Ne modifier ni la détection automatique ni la création personnalisée.
- Remettre recherche et filtres à zéro à la fermeture ou après sélection.
- Travailler directement sur `master`, conformément au dépôt et à l’accord utilisateur.

---

### Task 1: Filtrer le catalogue dans la feuille d’association Hevy

**Files:**
- Create: `src/features/history/HevyExerciseMappingSheet.test.tsx`
- Modify: `src/features/history/HevyExerciseMappingSheet.tsx`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: `MUSCLE_GROUPS`, `EQUIPMENT`, `FilterChip`, `OptionSheet`, `muscleLabel`, `equipmentLabel`.
- Produces: `filterHevyMappingExercises(exercises, row, search, muscle, equipment): Exercise[]`.

- [ ] **Step 1: Écrire les tests rouges**

Tester qu’une liste contenant des exercices incompatibles et plusieurs muscles/matériels ne conserve que ceux qui satisfont simultanément le type de mesure, la recherche, le muscle et le matériel. Rendre ensuite la feuille, ouvrir les choix « Muscle » et « Matériel », puis vérifier qu’une fermeture/réouverture restaure leurs libellés neutres.

- [ ] **Step 2: Vérifier l’échec attendu**

Run: `npm.cmd run test:run -- src/features/history/HevyExerciseMappingSheet.test.tsx`

Expected: FAIL, car les filtres et `filterHevyMappingExercises` n’existent pas encore.

- [ ] **Step 3: Implémenter le minimum**

Ajouter les états `muscle?: MuscleGroup`, `equipment?: Equipment` et `picker`. Construire les options depuis les constantes du schéma, afficher les deux puces sous la recherche, appliquer les quatre contraintes dans la fonction pure et centraliser la remise à zéro dans `resetAndClose` / `select`.

- [ ] **Step 4: Vérifier les tests ciblés**

Run: `npm.cmd run test:run -- src/features/history/HevyExerciseMappingSheet.test.tsx`

Expected: PASS.

- [ ] **Step 5: Vérifier l’application complète**

Run: `npm.cmd run lint`

Run: `npm.cmd run typecheck`

Run: `npm.cmd run test:run`

Run: `npm.cmd run build`

Expected: toutes les commandes passent ; seul le warning Vite historique sur le chunk principal peut subsister.

- [ ] **Step 6: Vérifier et documenter**

Contrôler la feuille en 375 × 812 px, la combinaison des filtres et l’absence de débordement. Mettre à jour `PROGRESS.md`, puis commiter uniquement les fichiers de cette tâche avec `feat(lot-07): filtre les exercices pendant l'import Hevy`.

