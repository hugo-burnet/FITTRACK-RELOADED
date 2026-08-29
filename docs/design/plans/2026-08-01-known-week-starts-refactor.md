# Known Week Starts Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one pure module the authority for which local weeks are known well enough to render, without changing session-count or volume analytics.

**Architecture:** Add `knownWeekStarts` beside the existing weekly session arithmetic in `src/lib/analytics/weeks.ts`. Both `weeklySessionCounts` and `weeklyVolumeBuckets` will pass their observed week keys through this seam, then keep ownership of their metric-specific bucket values.

**Tech Stack:** TypeScript strict, Vitest, existing DST-safe helpers from `src/lib/history.ts`.

## Global Constraints

- Preserve every current analytic result, including bounded periods, `all`, empty histories, internal gaps, historical timezone offsets, and DST transitions.
- This is a behavior-preserving refactor; add no UI, repository, schema, migration, route, dependency, or translation change.
- Keep `weeklySessionCounts` and `weeklyVolumeBuckets` as their consumers' stable interfaces.
- The new seam is pure and in-process; add no port, adapter, class, hook, or generic analytics abstraction.
- Preserve the meaning of `hasEarlierHistory`: a bounded period begins at `bounds.from` only when history predates the window; otherwise it begins at the oldest observed week.
- For `all`, an empty history returns no weeks and a non-empty history begins at its oldest observed week.
- Enumerate weeks with `startOfLocalWeek` and `addLocalWeeks`, never fixed millisecond arithmetic.
- Work on `master`, as required by the project `AGENTS.md`.
- Code, identifiers, and comments remain English; test descriptions remain French.
- Commit the refactor separately from planning and documentation.

## File Structure

- Modify `src/lib/analytics/weeks.ts`: own and export the shared `knownWeekStarts` rule; consume it from `weeklySessionCounts`.
- Modify `src/lib/analytics/weeks.test.ts`: test the new seam directly before implementation.
- Modify `src/lib/analytics/volume.ts`: replace its duplicate week-start selection and enumeration with `knownWeekStarts`.
- Keep `src/lib/analytics/volume.test.ts` unchanged as the second consumer's preservation proof.
- Modify `PROGRESS.md` only after review and final gates are clean.

---

### Task 1: Centralize the known-week timeline

**Files:**
- Modify: `src/lib/analytics/weeks.test.ts`
- Modify: `src/lib/analytics/weeks.ts`
- Modify: `src/lib/analytics/volume.ts`
- Test unchanged: `src/lib/analytics/volume.test.ts`

**Interfaces:**
- Consumes: `PeriodBounds`, observed local week-start timestamps, `startOfLocalWeek`, and `addLocalWeeks`.
- Produces:

```ts
export function knownWeekStarts(
  observedWeekStarts: Iterable<number>,
  bounds: PeriodBounds,
  hasEarlierHistory?: boolean,
): number[];
```

- [ ] **Step 1: Record the green preservation baseline**

Run:

```powershell
npm.cmd run test:run -- src/lib/analytics/weeks.test.ts src/lib/analytics/volume.test.ts
```

Expected: both files pass before any edit.

- [ ] **Step 2: Add direct interface tests before the export exists**

Add `knownWeekStarts` to the import from `./weeks`, then add this suite to `src/lib/analytics/weeks.test.ts`:

```ts
describe('knownWeekStarts', () => {
  const bounds = periodBounds('4w', now);

  it('part de la borne quand une histoire antérieure rend toute la fenêtre connue', () => {
    expect(knownWeekStarts([], bounds, true)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
  });

  it('part de la plus ancienne semaine observée et conserve les trous internes', () => {
    expect(
      knownWeekStarts(
        [week(2026, 6, 20), week(2026, 6, 6)],
        bounds,
      ),
    ).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
  });

  it('ne fabrique aucune semaine pour une histoire complète vide', () => {
    expect(knownWeekStarts([], periodBounds('all', now))).toEqual([]);
  });

  it('énumère les semaines par calendrier local à travers un changement d’heure', () => {
    const october = new Date(2026, 9, 27, 14, 0, 0).getTime();
    const starts = knownWeekStarts([], periodBounds('4w', october), true);

    expect(starts).toHaveLength(4);
    expect(starts[3]).toBe(addLocalWeeks(starts[0]!, 3));
    expect(starts.every((start) => new Date(start).getHours() === 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Verify RED for the missing interface**

Run:

```powershell
npm.cmd run test:run -- src/lib/analytics/weeks.test.ts
```

Expected: FAIL because `knownWeekStarts` is not exported.

- [ ] **Step 4: Implement the smallest pure authority**

Add to `src/lib/analytics/weeks.ts`, immediately before `weeklySessionCounts`:

```ts
export function knownWeekStarts(
  observedWeekStarts: Iterable<number>,
  bounds: PeriodBounds,
  hasEarlierHistory = false,
): number[] {
  const observed = [...observedWeekStarts];
  const oldest = observed.length === 0 ? undefined : Math.min(...observed);
  const first = bounds.from !== undefined && hasEarlierHistory ? bounds.from : oldest;
  if (first === undefined) return [];

  const starts: number[] = [];
  for (
    let weekStart = startOfLocalWeek(first);
    weekStart < bounds.to;
    weekStart = addLocalWeeks(weekStart, 1)
  ) {
    starts.push(weekStart);
  }
  return starts;
}
```

In `weeklySessionCounts`, replace its `oldest` / `first` / `for` selection with:

```ts
  return knownWeekStarts(counts.keys(), bounds, hasEarlierHistory).map((weekStart) => ({
    weekStart,
    sessions: counts.get(weekStart) ?? 0,
    goal: resolveWeeklyGoal(goals, weekStart),
  }));
```

Do not change `weekStartOf`, goal resolution, or session counting.

- [ ] **Step 5: Verify GREEN at the new seam and first consumer**

Run:

```powershell
npm.cmd run test:run -- src/lib/analytics/weeks.test.ts
```

Expected: all `weeks.test.ts` tests pass.

- [ ] **Step 6: Replace the duplicate volume timeline**

In `src/lib/analytics/volume.ts`:

- remove the direct `addLocalWeeks` and `startOfLocalWeek` import;
- import `knownWeekStarts` with `weekStartOf` from `./weeks`;
- replace the `oldest` / `first` / `for` block with:

```ts
  return knownWeekStarts(totals.keys(), bounds, hasEarlierHistory).map((weekStart) => {
    const value = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    return { weekStart, ...value };
  });
```

Do not change source filtering, historical offset handling, tonnage, or duration calculations.

- [ ] **Step 7: Verify both stable consumer interfaces**

Run:

```powershell
npm.cmd run test:run -- src/lib/analytics/weeks.test.ts src/lib/analytics/volume.test.ts
npm.cmd run typecheck
npm.cmd exec eslint -- src/lib/analytics/weeks.ts src/lib/analytics/weeks.test.ts src/lib/analytics/volume.ts
git diff --check
```

Expected: both test files, TypeScript, targeted ESLint, and diff check pass.

- [ ] **Step 8: Demonstrate preservation sensitivity with temporary mutants**

Temporarily replace only the `first` declaration in `knownWeekStarts` with each mutant separately:

```ts
const first = oldest;
```

Expected: bounded empty-history tests with `hasEarlierHistory = true` fail in both analytics suites.

```ts
const first = bounds.from;
```

Expected: bounded-period tests forbidding invented leading weeks fail.

Restore the exact implementation, rerun the two targeted suites, and confirm `git diff --check` is clean.

- [ ] **Step 9: Run complete pre-commit gates**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 10: Commit the behavior-preserving refactor**

```powershell
git add -- src/lib/analytics/weeks.ts src/lib/analytics/weeks.test.ts src/lib/analytics/volume.ts
git commit -m "refactor(analytics): centralise les semaines connues"
```

The commit must contain no UI, repository, schema, migration, route, dependency, translation, or progress-document change.

---

## Post-Task Review and Completion

1. Dispatch an independent task reviewer against this plan and the complete task diff.
2. Fix every Critical or Important finding, rerun covering tests, and re-review.
3. Run fresh final gates: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:run`, `npm.cmd run build`, and `git diff --check`.
4. Update `PROGRESS.md` with the centralized week-knowledge rule, mutation evidence, fresh test count, review result, and a phone checkpoint: compare the 4-week and `Tout` views of “Séances par semaine” and “Volume d’entraînement”; the same weeks, zeros, totals and averages must remain visible.
5. Commit documentation separately with `docs: consigne la chronologie hebdomadaire`.
