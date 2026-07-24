# RF-28 — Available Plates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user choose the plate denominations available in the gym, persist that global choice in IndexedDB, and recalculate every visible plate diagram immediately.

**Architecture:** A dedicated settings repository owns the `availablePlateWeightsKg` key and normalizes every read and write against the canonical list from `lib/plates`. `WorkoutScreen` observes that repository with `useLiveQuery`, while `PlateLoadSheet` remains database-agnostic: it receives the selected weights, requests writes through a callback, and derives a `PlateInventory` for each pure `computePlateLoad` call.

**Tech Stack:** React 19, TypeScript 6 strict, Dexie 4 / IndexedDB, `dexie-react-hooks`, Tailwind CSS v4, Vitest 4, Testing Library, `fake-indexeddb`.

## Global Constraints

- Work on `master`; do not push.
- Preserve `.agents/`, `.codex/`, and `AGENTS.md`; never stage or commit them.
- No Dexie schema change or migration.
- Access `settings` only through `src/data/repositories/settings.ts`; no component imports `db`.
- Keep all UI text in `src/i18n/fr.ts`.
- Keep the app fully local-first and functional offline.
- Keep the existing RF-31 bar weight ephemeral per workout exercise.
- Use the same plate selection for barbells, Smith machines, and plate-loaded machines.
- Allow an empty selection and show the achieved bare load plus the missing weight.
- Do not add pair counts, custom denominations, pounds, a central equipment settings screen, or any other Lot 8 setting.
- Touch targets must be at least 48 px.
- Selection and focus use neutral surfaces, borders, and weight; the accent remains reserved for records and completed sets.
- Do not start Lot 5bis, Lot 7, or Lot 8.

---

### Task 1: Persist and normalize the available plate denominations

**Files:**
- Create: `src/data/repositories/settings.ts`
- Create: `src/data/repositories/settings.test.ts`

**Interfaces:**
- Consumes: `db.settings`, `Setting`, and `DEFAULT_PLATES_KG`.
- Produces:
  - `getAvailablePlateWeightsKg(): Promise<number[]>`
  - `setAvailablePlateWeightsKg(weights: readonly number[]): Promise<number[]>`

- [ ] **Step 1: Write the failing repository tests**

Create `src/data/repositories/settings.test.ts` with a fresh database before each test. Cover:

```ts
expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);

await setAvailablePlateWeightsKg(DEFAULT_PLATES_KG.filter((weight) => weight !== 25));
expect(await getAvailablePlateWeightsKg()).toEqual(
  DEFAULT_PLATES_KG.filter((weight) => weight !== 25),
);

await setAvailablePlateWeightsKg([]);
expect(await getAvailablePlateWeightsKg()).toEqual([]);

await db.settings.put({
  key: 'availablePlateWeightsKg',
  value: [1, 25, 1, 2.5, 20],
  updatedAt: 1,
});
expect(await getAvailablePlateWeightsKg()).toEqual([25, 20, 2.5, 1]);

await db.settings.put({
  key: 'availablePlateWeightsKg',
  value: { weight: 25 },
  updatedAt: 1,
});
expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);

await db.settings.put({
  key: 'availablePlateWeightsKg',
  value: [0, -1, 30, Number.NaN, '25'],
  updatedAt: 1,
});
expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
```

Use fake system time for two successive writes and assert that the stored `updatedAt` changes from the first epoch-millisecond value to the second.

- [ ] **Step 2: Run the repository test and verify RED**

Run:

```bash
npx vitest run src/data/repositories/settings.test.ts
```

Expected: FAIL because `./settings` does not exist.

- [ ] **Step 3: Implement the minimal settings repository**

Create `src/data/repositories/settings.ts` with one private key and one normalization function:

```ts
import { db } from '@/data/db';
import { DEFAULT_PLATES_KG } from '@/lib/plates';

const AVAILABLE_PLATE_WEIGHTS_KEY = 'availablePlateWeightsKg';

function defaultPlateWeights(): number[] {
  return [...DEFAULT_PLATES_KG];
}

function normalizeAvailablePlateWeightsKg(value: unknown): number[] {
  if (!Array.isArray(value)) return defaultPlateWeights();
  if (value.length === 0) return [];

  const validWeights = new Set(
    value.filter(
      (weight): weight is number =>
        typeof weight === 'number' &&
        Number.isFinite(weight) &&
        weight > 0 &&
        DEFAULT_PLATES_KG.includes(weight as (typeof DEFAULT_PLATES_KG)[number]),
    ),
  );
  const normalized = DEFAULT_PLATES_KG.filter((weight) => validWeights.has(weight));
  return normalized.length > 0 ? normalized : defaultPlateWeights();
}

export async function getAvailablePlateWeightsKg(): Promise<number[]> {
  const setting = await db.settings.get(AVAILABLE_PLATE_WEIGHTS_KEY);
  return setting === undefined
    ? defaultPlateWeights()
    : normalizeAvailablePlateWeightsKg(setting.value);
}

export async function setAvailablePlateWeightsKg(
  weights: readonly number[],
): Promise<number[]> {
  const normalized = normalizeAvailablePlateWeightsKg([...weights]);
  await db.settings.put({
    key: AVAILABLE_PLATE_WEIGHTS_KEY,
    value: normalized,
    updatedAt: Date.now(),
  });
  return normalized;
}
```

The `put` stores `value` and `updatedAt` atomically in one Dexie write. An absent row and a malformed non-empty row fall back to the full canonical list; an explicit empty array remains empty.

- [ ] **Step 4: Run the repository tests and verify GREEN**

Run:

```bash
npx vitest run src/data/repositories/settings.test.ts
```

Expected: the new repository test file passes with zero failures.

- [ ] **Step 5: Run focused data-layer regression tests**

Run:

```bash
npx vitest run src/data/repositories
```

Expected: all repository test files pass.

- [ ] **Step 6: Commit the repository**

Stage only the two new repository files and commit:

```bash
git add src/data/repositories/settings.ts src/data/repositories/settings.test.ts
git commit -m "feat(lot-06): persiste les plaques disponibles"
```

---

### Task 2: Add the collapsible selector and wire live recalculation

**Files:**
- Modify: `src/features/workout/PlateLoadSheet.test.tsx`
- Modify: `src/features/workout/PlateLoadSheet.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes:
  - `getAvailablePlateWeightsKg(): Promise<number[]>`
  - `setAvailablePlateWeightsKg(weights: readonly number[]): Promise<number[]>`
  - `DEFAULT_PLATES_KG`
- Extends `PlateLoadSheet` with:
  - `availablePlateWeightsKg: readonly number[]`
  - `onAvailablePlateWeightsChange: (weights: number[]) => void | Promise<void>`
- Produces: a database-agnostic selector whose successful callback causes the Dexie live query to re-render every plate block.

- [ ] **Step 1: Write the failing component tests**

Extend the sheet harnesses so they pass `availablePlateWeightsKg` and update that value only when the callback resolves. Add focused tests for:

```ts
// Default: expand the disclosure, then all ten buttons are selected.
expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(10);

// Deselect 25 kg: the callback receives the other nine canonical weights.
expect(onAvailablePlateWeightsChange).toHaveBeenCalledWith(
  DEFAULT_PLATES_KG.filter((weight) => weight !== 25),
);

// Without 25 kg, 100 kg on a 20 kg bar becomes two 20 kg plates per side.
expect(screen.getByText('2 × 20')).toBeInTheDocument();

// Reselecting 25 kg restores the canonical 25 · 15 result.
expect(screen.getByText('25 · 15')).toBeInTheDocument();

// Empty inventory keeps the bare bar and reports the missing 80 kg.
expect(screen.getByText('Barre nue, aucune plaque à ajouter.')).toBeInTheDocument();
expect(screen.getByText('Il manque 80 kg pour la charge exacte.')).toBeInTheDocument();

// Every denomination exposes its state without relying on colour.
expect(screen.getByRole('button', { name: '25 kg' })).toHaveAttribute(
  'aria-pressed',
  'false',
);

// A rejected write keeps the sheet open and exposes a localized alert.
expect(await screen.findByRole('alert')).toHaveTextContent(
  'Impossible d’enregistrer les plaques disponibles.',
);
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
npx vitest run src/features/workout/PlateLoadSheet.test.tsx
```

Expected: FAIL because the sheet does not yet expose the selector props or controls.

- [ ] **Step 3: Add localized copy**

Add these keys under `workout` in `src/i18n/fr.ts`:

```ts
platesAvailable: 'Plaques disponibles',
platesAvailableCount: '{selected} sur {total}',
platesAvailableOption: '{weight} kg',
platesAvailableEmpty: 'Aucune plaque sélectionnée.',
platesAvailableSaveError: 'Impossible d’enregistrer les plaques disponibles.',
```

Keep the existing calculation and bar-weight strings unchanged.

- [ ] **Step 4: Implement the collapsible neutral selector**

In `PlateLoadSheet.tsx`:

1. Import `useState`, `DEFAULT_PLATES_KG`, `type PlateInventory`, and `ChevronDownIcon`.
2. Accept the two new props.
3. Render a native `<details>` after the optional bar-weight control and before the load blocks.
4. Give the `<summary>` a visible neutral focus and `min-h-12`.
5. Render the ten canonical weights in a five-column grid. Each button has `min-h-12`, localized `kg` text, `aria-pressed`, and a selected state carried by neutral fill, border, ring, and font weight.
6. On toggle, derive the next canonical-order array and await `onAvailablePlateWeightsChange(next)`. Do not update a local copy of the selection; the persisted prop remains the source of truth.
7. Catch a rejected write, keep the sheet mounted, and show `platesAvailableSaveError` with `role="alert"`.
8. Show `platesAvailableEmpty` when the selected array is empty.

Derive the inventory once per render:

```ts
const inventory: PlateInventory = availablePlateWeightsKg.map((weight) => ({ weight }));
```

Pass it to every `PlateBlock`, then into the existing pure engine:

```ts
const load = computePlateLoad(weightKg, { barWeight, sides, inventory });
```

No component imports `db`.

- [ ] **Step 5: Wire the repository into `WorkoutScreen`**

Import the two repository functions and the canonical default:

```ts
import {
  getAvailablePlateWeightsKg,
  setAvailablePlateWeightsKg,
} from '@/data/repositories/settings';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
```

Observe the setting next to the other live queries:

```ts
const availablePlateWeightsKg = useLiveQuery(getAvailablePlateWeightsKg);
```

Pass the persisted selection and repository writer to the sheet:

```tsx
availablePlateWeightsKg={availablePlateWeightsKg ?? [...DEFAULT_PLATES_KG]}
onAvailablePlateWeightsChange={setAvailablePlateWeightsKg}
```

Do not alter `plateBarWeights` or `platesView`: RF-31 remains ephemeral per workout exercise.

- [ ] **Step 6: Run the component tests and verify GREEN**

Run:

```bash
npx vitest run src/features/workout/PlateLoadSheet.test.tsx
```

Expected: all sheet tests pass, including recalculation, empty inventory, accessibility state, and rejected-write feedback.

- [ ] **Step 7: Run the RF-28/RF-31 regression set**

Run:

```bash
npx vitest run src/lib/plates.test.ts src/features/workout/plateConfig.test.ts src/features/workout/PlateLoadSheet.test.tsx
```

Expected: all calculator, equipment eligibility, bar-weight, and available-plate tests pass.

- [ ] **Step 8: Commit the interface**

Stage only the interface, tests, wiring, and French copy:

```bash
git add src/features/workout/PlateLoadSheet.test.tsx src/features/workout/PlateLoadSheet.tsx src/features/workout/WorkoutScreen.tsx src/i18n/fr.ts
git commit -m "feat(lot-06): configure les plaques disponibles"
```

---

### Task 3: Verify the mobile contract and close Lot 6 in project memory

**Files:**
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: the completed repository and UI behavior from Tasks 1–2.
- Produces: fresh verification evidence, an accurate Lot 6 status, and the exact phone checkpoint.

- [ ] **Step 1: Run all four quality gates**

Run each command independently and read its full output:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Expected: all four exit with code 0. Record the final test count and any known non-failing Vite chunk warning.

- [ ] **Step 2: Verify the live mobile layout**

Run the real app at `/FITTRACK-RELOADED/` in a 375 × 812 viewport and verify:

- the disclosure summary and every plate button are at least 48 px high;
- `document.body.scrollWidth === innerWidth`;
- the selected and focused plate buttons use neutral tokens, never `--accent-ink`;
- deselecting 25 kg changes 100 kg / 20 kg to `2 × 20` per side immediately;
- selecting no plates shows the bare load and 80 kg missing;
- a reload retains the selection from IndexedDB;
- reselecting 25 kg restores `25 · 15`;
- no console errors or warnings are introduced.

- [ ] **Step 3: Update `PROGRESS.md`**

Update the opening status, the “Lot en cours” section, and the advancement table. Add a dated RF-28 closure section recording:

- the repository key and normalization rules;
- the reactive `useLiveQuery` flow;
- the neutral collapsible selector and 48 px geometry;
- the empty-inventory behavior;
- the RED/GREEN test evidence and final suite count;
- the four quality-gate results;
- that Lot 6 implementation is complete, with the final phone checkpoint still awaiting the user’s validation.

Do not claim the phone checkpoint itself is validated before the user performs it.

- [ ] **Step 4: Re-run documentation sanity checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; `.agents/`, `.codex/`, and `AGENTS.md` remain untracked and unstaged.

- [ ] **Step 5: Commit the progress update**

Stage only `PROGRESS.md` and commit:

```bash
git add PROGRESS.md
git commit -m "docs(lot-06): prepare le checkpoint final"
```

- [ ] **Step 6: Present the phone checkpoint**

Ask the user to:

1. deselect 25 kg;
2. verify that 100 kg on a 20 kg bar becomes `2 × 20 kg` per side;
3. reload the app and verify the choice persists;
4. reselect 25 kg and verify `25 + 15 kg` per side returns.

Do not push without explicit approval.
