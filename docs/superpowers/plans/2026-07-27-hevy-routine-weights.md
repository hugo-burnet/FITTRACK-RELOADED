# Hevy Routine Weights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copier le poids de chaque série Hevy dans la série cible de la routine importée.

**Architecture:** Le constructeur existant `buildHevyRoutineEntities` copie déjà répétitions, durée et distance. Il copiera de la même façon `parsedSet.weight` vers `targetWeight`, sans inventer de valeur absente et sans copier le RPE.

**Tech Stack:** TypeScript strict, Vitest, Dexie entities.

## Global Constraints

- Copier le poids série par série depuis la séance représentative.
- Ne pas créer `targetWeight` lorsque le CSV ne fournit pas de poids.
- Ne pas modifier la règle de sélection de la séance ni copier le RPE.

---

### Task 1: Copier les poids

**Files:**
- Modify: `src/data/repositories/hevyRoutineImport.test.ts`
- Modify: `src/data/repositories/hevyRoutineImport.ts`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: `HevyParsedSet.weight?: number`.
- Produces: `RoutineSet.targetWeight?: number`.

- [ ] Modifier le test existant pour attendre `targetWeight: 80` et conserver l’absence de `targetRpe`.
- [ ] Exécuter `npm.cmd run test:run -- src/data/repositories/hevyRoutineImport.test.ts` et constater l’échec sur `targetWeight`.
- [ ] Ajouter conditionnellement `{ targetWeight: parsedSet.weight }` dans le constructeur.
- [ ] Réexécuter le test ciblé, puis `lint`, `typecheck`, `test:run` et `build`.
- [ ] Mettre à jour `PROGRESS.md`, commiter uniquement ces fichiers et pousser `master`.

