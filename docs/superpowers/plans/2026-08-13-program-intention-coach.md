# Intention de bloc et Coach — plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la prescription hebdomadaire `% 1RM` / RPE par `loadIndex` + `phase`, rouvrir le Coach sur les séances de bloc avec un biais de phase, et afficher les semaines comme une intention.

**Architecture:** La routine reste la référence. Le moteur de perf produit `signals` + `allowedActions` (`range_satisfied` / `range_ceiling_reached`, plateau qui retire toute escalade). La phase de la **prochaine** séance choisit parmi les actions autorisées. La Décharge est un transformateur de cibles hors Coach. `loadIndex` n’entre dans aucun calcul de charge.

**Tech Stack:** TypeScript strict, Dexie `version(7)`, modules purs `src/lib/coach/` et `src/lib/programs/`, Vitest + `fake-indexeddb`, UI française via `src/i18n/fr.ts`.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-08-13-program-intention-coach-design.md`. Ne pas rouvrir l’architecture.
- `loadIndex` : entier, non dimensionnel, non multiplicatif. Interdit dans `nextLoad`, 1RM, recette Décharge.
- Code / commentaires en anglais. UI en français, uniquement `src/i18n/fr.ts`.
- Accès données uniquement via `src/data/repositories/*`.
- TDD sur le moteur, la migration, la Décharge, la sélection de phase.
- `npm run typecheck && npm run test:run && npm run build` avant de déclarer un lot fini.
- Commits : `feat(lot-17):`, `fix(lot-17):`, `test(lot-17):`, `docs:`.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/data/types.ts` | `ProgramPhase`, `ProgramLoadIndex`, `ProgramWeek`, snapshot `Workout`, `CoachSignalCode` |
| `src/data/db.ts` | `version(7)` backfill semaines |
| `src/data/dbMigration.test.ts` | assertions v7 |
| `src/lib/coach/types.ts` | actions, contextes source/cible |
| `src/lib/coach/evaluate.ts` | partition fourchette, `allowedActions`, plateau |
| `src/lib/coach/evaluate.test.ts` | contrats §10 de la spec |
| `src/lib/coach/selectAction.ts` | **nouveau** — choix selon `targetProgramContext.phase` |
| `src/lib/programs/deloadTargets.ts` | **nouveau** — recette Décharge |
| `src/lib/programs/prescription.ts` | copie routine ; Décharge délègue à `deloadTargets` |
| `src/data/repositories/programWorkout.ts` | snapshot + cibles ; `targetProgramContext` pour le Coach |
| `src/data/repositories/coachEvaluate.ts` | plus de filtre `PROGRAM_ALLOWED_CODES` ; passe le contexte cible |
| `src/features/programs/*` | brouillon semaines, liste, détail, wizard |
| `src/i18n/fr.ts` | libellés phase / intention ; plus de « % du 1RM » |
| `src/features/workout/coachCopy.ts` | `range_ceiling_reached`, alias lecture `range_completed` |

---

### Task 1: Types, validation, migration v7

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/db.ts`
- Modify: `src/data/dbMigration.test.ts`
- Modify: `src/lib/programs/validation.ts` et `validation.test.ts`
- Modify: tous les fixtures qui construisent un `ProgramWeek` (tests programmes / routines / home)

**Interfaces:**
- Produces: `ProgramPhase`, `ProgramLoadIndex`, `ProgramWeek.{loadIndex,phase}`, `Workout.{programPhase?,programLoadIndex?}`
- Removes from write path: `ProgramPrescriptionKind` on weeks, `prescriptionKind`, `prescriptionValue`, `ProgramWeek.isDeload`

- [ ] **Step 1: Write the failing migration assertions**

In `dbMigration.test.ts`, after the existing v6 checks, add a v6-shaped week then open current `db` and assert:

```ts
expect(db.verno).toBe(7);
const week = await db.programWeeks.get('legacy-week');
expect(week).toMatchObject({ loadIndex: 75, phase: 'construction' });
expect(week).not.toHaveProperty('prescriptionKind');
```

Seed a second week with `prescriptionKind: 'target_rpe'` → expect `loadIndex: 100`, `phase: 'construction'`.
Seed a third with `isDeload: 1` → `phase: 'deload'`, `loadIndex` recopié.

- [ ] **Step 2: Run the migration test — expect FAIL** (`verno` still 6, fields missing)

- [ ] **Step 3: Types**

Replace week prescription types in `src/data/types.ts` with the block from spec §3.1. Add on `Workout`:

```ts
programPhase?: ProgramPhase;
programLoadIndex?: ProgramLoadIndex;
```

Keep `programIsDeload`. Add `'range_satisfied' | 'range_ceiling_reached'` to `CoachSignalCode` ; keep `'range_completed'` as **read alias only** (still in the union so old journal rows typecheck).

Comment on `ProgramLoadIndex` **exactly** as in the spec (non-dimensional, non-multiplicative).

- [ ] **Step 4: `version(7)`**

Append after v6, no `.stores()`:

```ts
this.version(7).upgrade(async (tx) => {
  await tx.table('programWeeks').toCollection().modify((week: Record<string, unknown>) => {
    const kind = week.prescriptionKind;
    const value = week.prescriptionValue;
    const deload = week.isDeload === 1;
    if (kind === 'target_rpe') {
      week.loadIndex = 100;
      week.phase = 'construction';
    } else {
      week.loadIndex = typeof value === 'number' ? value : 100;
      week.phase = deload ? 'deload' : 'construction';
    }
    delete week.prescriptionKind;
    delete week.prescriptionValue;
    delete week.isDeload;
  });
});
```

- [ ] **Step 5: Update `validateProgramDraft` weeks** — require `loadIndex` integer finite, `phase` in the enum. Drop `% 1RM` 1–100 / RPE 6–10 checks.

- [ ] **Step 6: Update every week fixture** to `{ weekIndex, loadIndex: 100, phase: 'construction' }` (deload weeks: `phase: 'deload'`).

- [ ] **Step 7: `npm run test:run -- src/data/dbMigration.test.ts src/lib/programs/validation.test.ts` + typecheck until green**

- [ ] **Step 8: Commit** `feat(lot-17): loadIndex et phase sur les semaines de bloc`

---

### Task 2: Moteur — partition fourchette + actions + plateau

**Files:**
- Modify: `src/lib/coach/types.ts`
- Modify: `src/lib/coach/evaluate.ts`
- Modify: `src/lib/coach/evaluate.test.ts`
- Modify: `src/lib/coach/index.ts`

**Interfaces:**
- Produces:

```ts
export type CoachAction =
  | 'increase_load'
  | 'increase_reps'
  | 'add_set'
  | 'maintain'
  | 'reduce_load';

export interface CoachEvaluation {
  signals: CoachSignal[];
  allowedActions: CoachAction[];
}
```

`collectCoachSignals` / `evaluateCoach` must expose `allowedActions` (either change return type or add `evaluateCoachPerformance(line, history): CoachEvaluation`). Prefer a new `evaluatePerformance(line, history, options): CoachEvaluation` used by `evaluateCoach` so the rest of the app can still get `CoachSignal[]` during the transition.

- [ ] **Step 1: Failing tests** in `evaluate.test.ts` — copy the four contracts from spec §10:

```ts
it('12/12/10 is satisfied only', () => {
  const ev = evaluatePerformance(line3x8to12([12, 12, 10]));
  expect(ev.signals.map((s) => s.code)).toEqual(['range_satisfied']);
  expect(ev.allowedActions.sort()).toEqual(['increase_reps', 'maintain'].sort());
});

it('12/12/12 is ceiling only', () => {
  const ev = evaluatePerformance(line3x8to12([12, 12, 12]));
  expect(ev.signals.map((s) => s.code)).toContain('range_ceiling_reached');
  expect(ev.signals.map((s) => s.code)).not.toContain('range_satisfied');
  expect(ev.allowedActions).toContain('increase_load');
  expect(ev.allowedActions).not.toContain('increase_reps');
});

it('plateau strips add_set as well as increase_*', () => {
  const ev = evaluatePerformance(ceilingWithPlateauHistory);
  expect(ev.signals.some((s) => s.code === 'plateau')).toBe(true);
  expect(ev.allowedActions).toEqual(['maintain']);
});
```

Keep existing `range_completed` tests but assert they now emit `range_ceiling_reached` (same evidence / `nextLoadKg`).

- [ ] **Step 2: Run — FAIL** (`evaluatePerformance` missing)

- [ ] **Step 3: Implement partition** in `evaluate.ts`:

```ts
function effectiveCeiling(set: CoachSetInput): number | undefined {
  return set.targetRepsMax ?? set.targetReps;
}

function rangeFlags(working: CoachSetInput[]): {
  ceiling: boolean;
  satisfied: boolean;
} {
  if (working.length === 0) return { ceiling: false, satisfied: false };
  if (working.some((set) => effectiveCeiling(set) === undefined)) {
    return { ceiling: false, satisfied: false };
  }
  const ceiling = working.every(
    (set) => set.reps !== undefined && set.reps >= effectiveCeiling(set)!,
  );
  const hasRange = working.every(
    (set) =>
      set.targetReps !== undefined &&
      set.targetRepsMax !== undefined &&
      set.targetRepsMax > set.targetReps,
  );
  const satisfied =
    hasRange &&
    !ceiling &&
    working.every((set) => set.reps !== undefined && set.reps >= set.targetReps!);
  return { ceiling, satisfied };
}
```

Severity: `range_missed` 50, `range_ceiling_reached` 40, `range_satisfied` 35, `plateau` 30, …

After building the raw action set from the exclusive range flag, if any signal is `plateau`:

```ts
for (const action of ['increase_reps', 'increase_load', 'add_set'] as const) {
  allowed.delete(action);
}
```

- [ ] **Step 4: Tests green.** Update `coachCopy.ts` + tests: new keys `coach.range_ceiling_reached*` ; reading a stored `range_completed` uses the same copy.

- [ ] **Step 5: Commit** `feat(lot-17): range_satisfied et actions autorisées`

---

### Task 3: Sélection par phase + contextes source/cible

**Files:**
- Create: `src/lib/coach/selectAction.ts`
- Create: `src/lib/coach/selectAction.test.ts`
- Modify: `src/lib/coach/types.ts` (`ProgramCoachContext`)
- Modify: `src/data/repositories/coachEvaluate.ts` — drop `PROGRAM_ALLOWED_CODES` ; resolve `targetProgramContext`

**Interfaces:**
- Consumes: `CoachAction[]`, `ProgramPhase`
- Produces:

```ts
export interface ProgramCoachContext {
  phase: ProgramPhase;
  loadIndex: number;
}

export function selectProgramAction(
  allowed: readonly CoachAction[],
  target: ProgramCoachContext | undefined,
): CoachAction
```

Hors bloc / `target === undefined` : même ordre que Construction.

Ordres (spec §6) :

```ts
const RANK: Record<ProgramPhase, CoachAction[]> = {
  construction: ['increase_load', 'increase_reps', 'maintain'], // never add_set
  progression: ['increase_load', 'increase_reps', 'maintain'],
  overload: ['add_set', 'increase_reps', 'increase_load', 'maintain'],
  deload: ['maintain'], // increases already stripped if next week is deload
  return: ['maintain', 'increase_reps', 'increase_load'],
  test: ['increase_load', 'increase_reps', 'maintain'],
};
```

`selectProgramAction` = first entry of `RANK[phase]` that is in `allowed`, else `maintain`.

- [ ] **Step 1: Failing tests**

```ts
expect(selectProgramAction(['maintain', 'increase_load', 'add_set'], { phase: 'construction', loadIndex: 100 })).toBe('increase_load');
expect(selectProgramAction(['maintain', 'increase_load', 'add_set'], { phase: 'overload', loadIndex: 110 })).toBe('add_set');
expect(selectProgramAction(['maintain', 'increase_load'], { phase: 'return', loadIndex: 100 })).toBe('maintain');
expect(selectProgramAction(['maintain'], { phase: 'progression', loadIndex: 105 })).toBe('maintain');
```

Plus un test d’intégration coachEvaluate : S4 close (`overload` snapshot) + S5 cible `deload` → pas d’`add_set` dans la reco.

- [ ] **Step 2: Implement `selectProgramAction`. Wire `coachEvaluate` :**

Resolve next programmed session via existing `pickProgramSession` / schedule + `programPosition` at `now` (or `endedAt` of the workout just finished). If that session’s week is known, pass `{ phase, loadIndex }` from the **week definition** (cible), not from the closed workout snapshot.

Signals recorded on the closed workout still use the snapshot for display (`sourceProgramContext`).

- [ ] **Step 3: Tests green. Commit** `feat(lot-17): le Coach choisit selon la semaine cible`

---

### Task 4: Snapshot de séance + transformateur Décharge

**Files:**
- Create: `src/lib/programs/deloadTargets.ts`
- Create: `src/lib/programs/deloadTargets.test.ts`
- Modify: `src/lib/programs/prescription.ts` — identity for non-deload ; deload delegates
- Modify: `src/data/repositories/programWorkout.ts` / `workoutLifecycle.ts` `buildWorkoutEntities`

**Interfaces:**
- Produces:

```ts
export function createDeloadTargets(input: {
  week: { phase: ProgramPhase; loadIndex: number };
  exercises: ProgramPrescriptionExerciseInput[];
}): ProgramPrescriptionProjection
```

Recipe (spec §6.1): `previousLoad` twice on working-set `targetWeight` ; drop one working set (keep ≥ 1) ; reps → `targetReps` (floor) ; warmups untouched. **`loadIndex` unused.**

- [ ] **Step 1: Failing tests**

```ts
expect(createDeloadTargets({ week: { phase: 'deload', loadIndex: 60 }, exercises }))
  .toEqual(createDeloadTargets({ week: { phase: 'deload', loadIndex: 90 }, exercises }));
```

Plus : 3 working sets 80×8–12 → 2 working sets, weight `previousLoad(previousLoad(80))`, reps 8.

- [ ] **Step 2: Implement. `projectProgramPrescription` :** if `week.phase !== 'deload'`, return `routineTargets` for every set (no %1RM). If deload, `createDeloadTargets`.

- [ ] **Step 3: On workout insert**, set:

```ts
programPhase: week.phase,
programLoadIndex: week.loadIndex,
programIsDeload: week.phase === 'deload' ? 1 : 0,
```

Test : create S3 progression/105, then edit week 3 to deload/60 → stored workout still progression/105.

- [ ] **Step 4: Commit** `feat(lot-17): snapshot de phase et recette Décharge`

---

### Task 5: UI semaines + wizard + i18n

**Files:**
- Modify: `src/features/programs/ProgramWeeksStep.tsx`
- Modify: `src/features/programs/ProgramEditorScreen.tsx` (`defaultWeeks`, validation, hydrate)
- Modify: `src/features/programs/ProgramDetailScreen.tsx`, `ProgramSessionList.tsx`
- Modify: `src/features/home/HomeProgramCard.tsx` (lecture semaine)
- Modify: `src/i18n/fr.ts` + `fr.test.ts` si clés listées
- Modify: `src/features/programs/ProgramFlow.integration.test.tsx`

**Suggested loadIndex map** (editor only):

```ts
export const SUGGESTED_LOAD_INDEX: Record<ProgramPhase, number> = {
  construction: 100,
  progression: 105,
  overload: 110,
  deload: 60,
  return: 100,
  test: 110,
};
```

On phase change in the week sheet: `loadIndex = SUGGESTED_LOAD_INDEX[phase]`. User can edit after. Do **not** call this from repositories.

Week line: `t('program.weekLine', { number, level: week.loadIndex, phase: phaseLabel })` → `05 — 60 % · Décharge`.

Wizard nav: replace the 3-col `border-b-2` list with:

```tsx
<nav aria-label={t('program.stepProgress', { current, name })}>
  <p className="text-sm font-semibold text-[var(--text-1)]">
    {t('program.stepProgress', { current, name })}
  </p>
  <ol className="mt-3 flex gap-4">
    {([1, 2, 3]).map((n) => (
      <li
        key={n}
        aria-current={n === current ? 'step' : undefined}
        className={n === current ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]'}
      >
        {n}
      </li>
    ))}
  </ol>
</nav>
```

No `button`. No full-width `border-b`.

Delete i18n keys that claim `% du 1RM` as a calculation (`percentOneRm`, `percentReading`, week-level `targetRpe`). Add `program.phase.*`, `program.weekLine`, intention strings from spec §7.

- [ ] **Step 1: Update integration tests** that look for « % du 1RM » or `isDeload` / `prescriptionKind` — they fail first.

- [ ] **Step 2: Implement UI + i18n.**

- [ ] **Step 3: `npm run test:run -- src/features/programs src/features/home/HomeProgramCard.test.tsx src/i18n` + typecheck**

- [ ] **Step 4: Commit** `feat(lot-17): semaines en intention et wizard lisible`

---

### Task 6: Copie Coach + non-régression

**Files:**
- Modify: `src/features/workout/coachCopy.ts`, `coachCopy.test.ts`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx` (`range_completed` → ceiling)
- Modify: `src/data/repositories/coachEvaluate.test.ts` if it filters program codes

- [ ] **Step 1:** Progression without `increase_*` → copy **Maintien — progression différée** (`coach.progressionDeferred`).
- [ ] **Step 2:** Test phase + authorized `increase_load` → wording « tentative contrôlée », même `nextLoadKg`.
- [ ] **Step 3:** Full `npm run typecheck && npm run test:run && npm run build`
- [ ] **Step 4: Commit** `feat(lot-17): le Coach parle en intention de bloc`

---

## Couverture spec

| Spec | Tâche |
|---|---|
| §3 types + snapshot + v7 | 1, 4 |
| §4 partition + actions + plateau/add_set | 2 |
| §5 source ≠ cible, invariants | 3 |
| §6 phases + recette Décharge | 3, 4 |
| §7 semaines / accueil / suggestion éditeur | 5 |
| §8 wizard | 5 |
| §9 i18n | 5, 6 |
| §10 tests listés | 2, 3, 4, 5 |

## Exécution

Ordre sûr, sans rouvrir l’architecture : **1 → 2 → 3 → 4 → 5 → 6**.
