# Home Routine Folder Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home suggestion remember a routine folder (or “Sans dossier”) and rank only the routines inside that context.

**Architecture:** Persist a discriminated routine context in the existing local settings table. Extend the single home repository projection to validate that context, filter routine summaries, and expose render-ready picker options; keep ranking in `pickSuggestedRoutine`. Let a dedicated sheet own asynchronous selection/error behavior while `HomeSuggestionCard` remains the card orchestrator.

**Tech Stack:** React 19, TypeScript strict, Dexie/IndexedDB, dexie-react-hooks, Vitest, Testing Library, Tailwind CSS v4.

## Global Constraints

- The feature remains fully local-first and works without network or account.
- “Sans dossier” is a deliberate context distinct from “no choice yet”.
- With zero folders, preserve the current global suggestion behavior and do not show a picker.
- An active program remains higher priority than the free-routine suggestion.
- Components never import `db`; all persistence goes through repositories.
- All UI copy lives in `src/i18n/fr.ts`; code, names, and comments stay in English.
- Touch targets remain at least 48 px and color alone never carries meaning.
- Preserve the unrelated working-tree change in `src/audio/voiceScript.json`.

---

### Task 1: Persist the selected routine context

**Files:**
- Modify: `src/data/repositories/settings.ts`
- Modify: `src/data/repositories/settings.test.ts`

**Interfaces:**
- Produces: `type RoutineFolderContext = { kind: 'root' } | { kind: 'folder'; folderId: string }`
- Produces: `getRoutineFolderContext(): Promise<RoutineFolderContext | null>`
- Produces: `setRoutineFolderContext(context: RoutineFolderContext): Promise<void>`

- [ ] **Step 1: Write failing setting tests**

Append a focused `describe('home routine folder context setting', ...)` that proves all three persisted states and defensive normalization:

```ts
it('distinguishes no choice from an explicit root choice', async () => {
  expect(await getRoutineFolderContext()).toBeNull();

  await setRoutineFolderContext({ kind: 'root' });

  expect(await getRoutineFolderContext()).toEqual({ kind: 'root' });
});

it('persists a folder id', async () => {
  await setRoutineFolderContext({ kind: 'folder', folderId: 'push' });
  expect(await getRoutineFolderContext()).toEqual({ kind: 'folder', folderId: 'push' });
});

it.each([null, '', { kind: 'folder', folderId: '' }, { kind: 'other' }])(
  'normalizes an invalid stored context to no choice: %j',
  async (value) => {
    await db.settings.put({ key: 'homeRoutineFolderContext', value, updatedAt: 1 });
    expect(await getRoutineFolderContext()).toBeNull();
  },
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: FAIL because the three context exports do not exist.

- [ ] **Step 3: Implement the minimal normalized setting**

Add the key, type guard, getter, and setter to `settings.ts`:

```ts
const HOME_ROUTINE_FOLDER_CONTEXT_KEY = 'homeRoutineFolderContext';

export type RoutineFolderContext =
  | { kind: 'root' }
  | { kind: 'folder'; folderId: string };

function normalizeRoutineFolderContext(value: unknown): RoutineFolderContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'root') return { kind: 'root' };
  return candidate.kind === 'folder' &&
    typeof candidate.folderId === 'string' && candidate.folderId.length > 0
    ? { kind: 'folder', folderId: candidate.folderId }
    : null;
}

export async function getRoutineFolderContext(): Promise<RoutineFolderContext | null> {
  return normalizeRoutineFolderContext(
    (await db.settings.get(HOME_ROUTINE_FOLDER_CONTEXT_KEY))?.value,
  );
}

export async function setRoutineFolderContext(context: RoutineFolderContext): Promise<void> {
  await db.settings.put({
    key: HOME_ROUTINE_FOLDER_CONTEXT_KEY,
    value: context,
    updatedAt: Date.now(),
  });
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: all settings tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/data/repositories/settings.ts src/data/repositories/settings.test.ts
git commit -m "feat(home): mémoriser le dossier de routines actif"
```

### Task 2: Project a validated, folder-scoped suggestion

**Files:**
- Modify: `src/data/repositories/home.ts`
- Modify: `src/data/repositories/home.test.ts`

**Interfaces:**
- Consumes: `RoutineFolderContext`, `getRoutineFolderContext()` from Task 1
- Produces: `HomeRoutineContextOption = { value: 'root' | `folder:${string}`; label: string; routineCount: number }`
- Extends `HomeDashboardData` with `routineContext: { required: boolean; selected: string | null; options: HomeRoutineContextOption[] }`
- Keeps `suggestedRoutine: SuggestedRoutine | null` as the already scoped suggestion

- [ ] **Step 1: Write failing repository tests**

Add fixtures with `createFolder`, `createRoutine(name, folderId)`, and `setRoutineFolderContext` for these behaviors:

```ts
it('keeps the global suggestion when no folder exists', async () => {
  const push = await createRoutine('Push');
  const dashboard = await getHomeDashboard();
  expect(dashboard.routineContext).toEqual({ required: false, selected: null, options: [] });
  expect(dashboard.suggestedRoutine?.routineId).toBe(push.id);
});

it('offers folders and root, then scopes the suggestion to the chosen folder', async () => {
  const root = await createRoutine('Libre');
  const folder = await createFolder('Salle');
  const inside = await createRoutine('Push salle', folder.id);
  await setRoutineFolderContext({ kind: 'folder', folderId: folder.id });

  const dashboard = await getHomeDashboard();

  expect(dashboard.routineContext.options.map(({ value }) => value)).toEqual([
    `folder:${folder.id}`,
    'root',
  ]);
  expect(dashboard.routineContext.selected).toBe(`folder:${folder.id}`);
  expect(dashboard.suggestedRoutine?.routineId).toBe(inside.id);
  expect(dashboard.suggestedRoutine?.routineId).not.toBe(root.id);
});
```

Also test: no saved choice makes `required: true`; an empty selected folder yields no suggestion without fallback; a deleted folder invalidates `selected`; root is omitted when it has no routines; active program projection remains present.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:run -- src/data/repositories/home.test.ts`

Expected: FAIL because `routineContext` is absent and suggestions are still global.

- [ ] **Step 3: Implement projection filtering without duplicating ranking**

Read folders, settings, routines, completed workouts, weekly goals, and active program in the existing `Promise.all`. Build options in folder order, append root only when root routines exist, validate the saved context against those options, and select candidates before the existing `pickSuggestedRoutine` call:

```ts
const selectedValue = context === null
  ? null
  : context.kind === 'root'
    ? 'root'
    : `folder:${context.folderId}` as const;
const validSelected = options.some((option) => option.value === selectedValue)
  ? selectedValue
  : null;
const candidates = folders.length === 0
  ? routines
  : validSelected === 'root'
    ? routines.filter(({ routine }) => routine.folderId === '')
    : validSelected?.startsWith('folder:')
      ? routines.filter(({ routine }) => routine.folderId === validSelected.slice(7))
      : [];
```

Set `required` only when at least one folder exists and `validSelected === null`. Keep `routineCount` as the total library count so the existing “no routines” state stays truthful.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:run -- src/data/repositories/home.test.ts`

Expected: all home repository tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/data/repositories/home.ts src/data/repositories/home.test.ts
git commit -m "feat(home): limiter la suggestion au dossier actif"
```

### Task 3: Add the persistent folder picker to the home card

**Files:**
- Create: `src/features/home/HomeRoutineContextSheet.tsx`
- Create: `src/features/home/HomeRoutineContextSheet.test.tsx`
- Create: `src/features/home/HomeSuggestionCard.test.tsx`
- Modify: `src/features/home/HomeSuggestionCard.tsx`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/home/HomeScreen.test.tsx`
- Modify: `src/ui/icons.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `HomeDashboardData['routineContext']` from Task 2
- Consumes: `setRoutineFolderContext()` from Task 1
- Produces: `HomeRoutineContextSheet({ open, value, options, onClose }: Props)`
- Extends `HomeSuggestionCard` props with `routineContext`

- [ ] **Step 1: Write the failing UI tests**

Test the sheet using real controls and a mocked settings repository:

```tsx
it('persists a folder and closes only after the write succeeds', async () => {
  const user = userEvent.setup();
  render(<HomeRoutineContextSheet open value={null} options={options} onClose={onClose} />);

  await user.click(screen.getByRole('radio', { name: /Salle/ }));

  expect(setRoutineFolderContext).toHaveBeenCalledWith({ kind: 'folder', folderId: 'push' });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it('keeps the sheet open and reports a failed local write', async () => {
  vi.mocked(setRoutineFolderContext).mockRejectedValueOnce(new Error('disk full'));
  const user = userEvent.setup();
  render(<HomeRoutineContextSheet open value={null} options={options} onClose={onClose} />);

  await user.click(screen.getByRole('radio', { name: /Salle/ }));

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Impossible de changer de dossier.',
  );
  expect(onClose).not.toHaveBeenCalled();
});
```

Test the card for: initial required picker, context label, “Changer de dossier” action, scoped empty-folder copy, and no change action when `required` is false with zero folders.

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run: `npm run test:run -- src/features/home/HomeRoutineContextSheet.test.tsx src/features/home/HomeSuggestionCard.test.tsx src/features/home/HomeScreen.test.tsx`

Expected: FAIL because the sheet, props, icon, and copy do not exist.

- [ ] **Step 3: Add the explicit folder-change icon**

Add a hand-drawn icon to `src/ui/icons.tsx` that combines a folder silhouette with two short exchange arrows, exported as `FolderSwitchIcon`. Keep the existing 24 px grid, 2 px stroke, and `currentColor`; do not reuse `PlusIcon`.

- [ ] **Step 4: Implement the async sheet**

Build the sheet directly on `Sheet` rather than `OptionSheet`, because `OptionSheet` closes before invoking `onSelect` and cannot satisfy the write-failure contract. Map values back to settings contexts:

```ts
const context = value === 'root'
  ? { kind: 'root' as const }
  : { kind: 'folder' as const, folderId: value.slice('folder:'.length) };

try {
  setSaving(value);
  setError(false);
  await setRoutineFolderContext(context);
  onClose();
} catch {
  setError(true);
} finally {
  setSaving(null);
}
```

Every row is at least `min-h-14`, uses `role="radio"`, exposes `aria-checked`, disables duplicate writes while saving, and displays the existing `CheckIcon` for the selected value.

- [ ] **Step 5: Wire the card and home projection**

Pass `state.data.routineContext` from `HomeScreen`. In `HomeSuggestionCard`, open the sheet automatically in an effect only when `routineContext.required` changes to true; do not reopen it after the user dismisses it during the same mount. Render the context label and a 48 px icon button with `aria-label={t('home.changeRoutineFolder')}`. For a selected empty folder, render `home.emptyRoutineFolder` and the same change action instead of `home.noRoutines`.

Add exact French copy under `home`:

```ts
chooseRoutineFolder: 'Choisir un dossier',
changeRoutineFolder: 'Changer de dossier',
rootRoutineFolder: 'Sans dossier',
emptyRoutineFolder: 'Aucune routine dans ce dossier.',
routineFolderWriteError: 'Impossible de changer de dossier.',
```

- [ ] **Step 6: Run the focused UI tests and verify GREEN**

Run: `npm run test:run -- src/features/home/HomeRoutineContextSheet.test.tsx src/features/home/HomeSuggestionCard.test.tsx src/features/home/HomeScreen.test.tsx`

Expected: all focused home UI tests PASS with no act warnings.

- [ ] **Step 7: Commit**

```bash
git add -- src/features/home/HomeRoutineContextSheet.tsx src/features/home/HomeRoutineContextSheet.test.tsx src/features/home/HomeSuggestionCard.tsx src/features/home/HomeSuggestionCard.test.tsx src/features/home/HomeScreen.tsx src/features/home/HomeScreen.test.tsx src/ui/icons.tsx src/i18n/fr.ts
git commit -m "feat(home): choisir le dossier de la séance suggérée"
```

### Task 4: Close verification blockers, document, and release

**Files:**
- Modify if root cause requires it: `src/features/tutorial/TutorialProvider.test.tsx` or the smallest responsible tutorial source file
- Modify: `PROGRESS.md`

**Interfaces:**
- No new production interface; this task makes the merged tree releasable.

- [ ] **Step 1: Reproduce the four existing tutorial failures alone**

Run: `npm run test:run -- src/features/tutorial/TutorialProvider.test.tsx --reporter=verbose`

Expected before investigation: the four failures observed after merging `57c5002` reproduce with complete assertion/stack output. If they pass alone, run the full suite with verbose output and trace the leaked shared state before changing code.

- [ ] **Step 2: Apply systematic debugging before any fix**

Compare `57c5002^..57c5002`, the setup/teardown in `TutorialProvider.test.tsx`, and the new persisted store behavior. Form one evidence-backed hypothesis, write the smallest failing regression test if the existing assertion does not isolate the cause, then make one minimal fix. Do not weaken assertions or add arbitrary waits.

- [ ] **Step 3: Verify the tutorial fix**

Run: `npm run test:run -- src/features/tutorial/TutorialProvider.test.tsx`

Expected: all four tests PASS, with no hanging worker or unhandled error.

- [ ] **Step 4: Record the feature and checkpoint**

Update `PROGRESS.md` with the persistent folder-context decision, the root/no-choice distinction, the empty/deleted-folder behavior, tests, and phone checkpoint. Do not alter the A/B/C superset decision or unrelated release history.

- [ ] **Step 5: Run the complete release gate**

Run: `npm run lint && npm run typecheck && npm run test:run && npm run build`

Expected: exit 0; all tests pass; production build succeeds. A known bundle-size warning is acceptable, test failures or unhandled errors are not.

- [ ] **Step 6: Commit final verification/documentation changes**

```bash
git add -- PROGRESS.md <only-the-tutorial-files-actually-fixed>
git commit -m "fix(tutorial): stabiliser la reprise persistée"
```

If no tutorial source change is required, use `docs: consigner le dossier actif de l'accueil` and stage only `PROGRESS.md`.

- [ ] **Step 7: Push and verify GitHub Actions**

Push `master` without force. Confirm `origin/master` equals local `HEAD`, then inspect the `Android APK` run for that SHA until it is at least queued/in progress. Report the run URL and whether this push creates only the 30-day debug artifact or a tagged GitHub Release; do not create a release tag unless explicitly requested.
