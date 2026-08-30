# RPE masquable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de saisir ou effacer un RPE 6–10 sur chaque série sans ajouter de
colonne à la grille de séance.

**Architecture:** Un composant interactif isolé vit dans les `children` de l’`ActionSheet`
de série. Il ne possède que l’état éphémère de divulgation ; `WorkoutScreen` lui fournit la
valeur Dexie réactive et relaie les changements vers `updateSetValues`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, Dexie, Vitest, Testing Library.

## Global Constraints

- Interface en français ; tous les textes vivent dans `src/i18n/fr.ts`.
- Cibles tactiles d’au moins 48 px à 375 px.
- Aucun accent hors records et séries validées.
- Aucun changement de schéma ni de repository sans nécessité démontrée.
- La grille principale reste inchangée.

---

### Task 1: Divulgation RPE interactive

**Files:**
- Create: `src/features/workout/WorkoutRpeField.test.tsx`
- Create: `src/features/workout/WorkoutRpeField.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `value: number | undefined`, `onChange(value: number | undefined): void`
- Produces: `WorkoutRpeField`

- [x] **Step 1: écrire le test rouge**

Tester que le contrôle affiche « Non renseigné » replié, révèle les valeurs après un appui,
appelle `onChange(8.5)` sur « 8,5 », puis appelle `onChange(undefined)` sur l’effacement.

- [x] **Step 2: vérifier le rouge**

Run: `npm run test:run -- src/features/workout/WorkoutRpeField.test.tsx`

Expected: FAIL car `WorkoutRpeField` n’existe pas.

- [x] **Step 3: implémenter le minimum**

Créer la divulgation, la grille fixe `[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]`, la case
d’effacement et les textes typés dans `fr.ts`.

- [x] **Step 4: vérifier le vert**

Run: `npm run test:run -- src/features/workout/WorkoutRpeField.test.tsx`

Expected: PASS.

### Task 2: Intégration à la feuille de série

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `setOf(setId)`, `updateSetValues(setId, { rpe })`
- Produces: saisie RPE persistée dans l’`ActionSheet` de la série sélectionnée

- [x] **Step 1: intégrer le composant**

Rendre `WorkoutRpeField` en enfant de l’`ActionSheet` uniquement lorsque
`sheet.kind === 'set'`, avec `value={setOf(sheet.setId)?.rpe}` et un callback vers
`updateSetValues`.

- [x] **Step 2: vérifier le test ciblé et le typecheck**

Run: `npm run test:run -- src/features/workout/WorkoutRpeField.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: exit 0.

### Task 3: Vérification réelle et livraison

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: application sur `http://localhost:5173/FITTRACK-RELOADED/`
- Produces: mesures DOM/CSS et preuve IndexedDB à 375 px

- [x] **Step 1: piloter à 375 px**

Ouvrir une série, déplier le RPE, choisir 8,5, mesurer les dix cibles et vérifier les
couleurs calculées.

- [x] **Step 2: vérifier IndexedDB**

Lire la série dans `fittrack.workoutSets`, recharger, rouvrir la feuille, puis effacer et
relire la ligne.

- [x] **Step 3: exécuter les quatre portes**

Run: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

Expected: quatre exits 0.

- [x] **Step 4: documenter et préparer le commit**

Mettre `PROGRESS.md` à jour puis créer un seul commit :
`feat(lot-06): ajoute le RPE masquable en séance`.
