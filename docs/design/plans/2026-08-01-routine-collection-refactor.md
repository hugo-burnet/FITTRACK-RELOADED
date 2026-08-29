# Routine Collection Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the complete routine-composition journey, then extract the loaded collection UI and folder-placement knowledge from `RoutinesScreen` without changing behavior.

**Architecture:** A real route-level integration test first establishes preservation evidence through React Router, the three routine screens, repositories, Dexie, and `fake-indexeddb`. A feature-specific deep module named `RoutineCollection` then accepts loaded routine/folder snapshots and emits discriminated user intents while hiding empty rendering, headings, rows, drag mechanics, and placement projection.

**Tech Stack:** React 19, TypeScript strict, React Router `MemoryRouter`, Dexie + `fake-indexeddb`, Testing Library + `user-event`, Vitest, Tailwind CSS v4.

## Global Constraints

- Keep the interface and all user-visible behavior unchanged.
- Keep every UI string in `src/i18n/fr.ts`; this refactor adds no string.
- Keep all IndexedDB access behind the existing repositories.
- Use the real repositories and `fake-indexeddb` in the integration test; do not mock Dexie, React Router, or the three screens in the journey.
- Preserve the distinction between `undefined` (live query still loading) and a loaded empty collection.
- Preserve the current folder and drag semantics, including the root heading.
- Do not refactor `RoutineEditorScreen` or `ExercisePickerScreen` in this slice.
- Commit the preservation test separately from the production refactor.
- Add no speculative extension point or generic collection abstraction.
- Work on `master`, as required by the project `AGENTS.md`.
- Code, identifiers, and comments remain English; test descriptions and user-facing strings remain French.
- Do not modify `src/router.tsx`, any repository, `src/i18n/fr.ts`, schema, migration, or dependency file.

## File Structure

- Create `src/features/routines/RoutineFlow.integration.test.tsx`: the only route-level preservation proof for composing and persisting a routine through the three real screens.
- Create `src/features/routines/RoutineCollection.tsx`: the deep module whose external interface is loaded snapshots plus one intent callback; all collection projection and rendering stays private.
- Create `src/features/routines/RoutineCollection.test.tsx`: interface-level tests for the deep module; no helper implementation is imported.
- Modify `src/features/routines/RoutinesScreen.tsx`: retain loading, live queries, navigation, commands, templates, active-workout behavior, and sheets; delegate loaded main-content rendering to `RoutineCollection`.
- Modify `PROGRESS.md` only after both tasks, their reviews, the whole-change review, and all final gates are complete.

---

### Task 1: Persistent routine-composition integration proof

**Files:**
- Create: `src/features/routines/RoutineFlow.integration.test.tsx`
- Do not modify production files permanently.

**Interfaces:**
- Consumes: `RoutinesScreen`, `RoutineEditorScreen`, `ExercisePickerScreen`, the real route paths `/routines`, `/routines/:id`, `/routines/:id/add`, `createCustomExercise`, `getRoutineDetail`, `listRoutineSummaries`, and `resetDb`.
- Produces: a route-level preservation test that Task 2 must keep green unchanged.

- [ ] **Step 1: Add the complete characterization test**

Create `src/features/routines/RoutineFlow.integration.test.tsx` with this exact content:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import { getRoutineDetail, listRoutineSummaries } from '@/data/repositories/routines';
import { resetDb } from '@/test/resetDb';
import { ExercisePickerScreen } from './ExercisePickerScreen';
import { RoutineEditorScreen } from './RoutineEditorScreen';
import { RoutinesScreen } from './RoutinesScreen';

function renderRoutineFlow(initialEntry = '/routines') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/routines" element={<RoutinesScreen />} />
        <Route path="/routines/:id" element={<RoutineEditorScreen />} />
        <Route path="/routines/:id/add" element={<ExercisePickerScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('parcours de composition d’une routine', () => {
  beforeEach(resetDb);

  it('persiste la routine complète après un remontage de la liste', async () => {
    const exercise = await createCustomExercise({
      name: 'Développé militaire',
      primaryMuscle: 'shoulders',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const user = userEvent.setup();
    const mounted = renderRoutineFlow();

    await user.click(await screen.findByRole('button', { name: 'Routine vide' }));

    const name = await screen.findByRole('textbox', { name: 'Nom de la routine' });
    await user.clear(name);
    await user.type(name, 'Épaules force');

    let routineId = '';
    await waitFor(async () => {
      const summaries = await listRoutineSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.routine.name).toBe('Épaules force');
      routineId = summaries[0]?.routine.id ?? '';
      expect(routineId).not.toBe('');
    });

    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(await screen.findByRole('checkbox', { name: /Développé militaire/ }));
    await user.click(screen.getByRole('button', { name: 'Ajouter 1 exercice' }));

    expect(await screen.findByText(exercise.name)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    expect(await screen.findByText('1 exercice · 2 séries')).toBeVisible();

    await waitFor(async () => {
      const detail = await getRoutineDetail(routineId);
      expect(detail?.routine.name).toBe('Épaules force');
      expect(detail?.exercises).toHaveLength(1);
      expect(detail?.exercises[0]?.exercise?.id).toBe(exercise.id);
      expect(detail?.exercises[0]?.sets).toHaveLength(2);
    });

    mounted.unmount();
    renderRoutineFlow();

    expect(await screen.findByText('Épaules force')).toBeVisible();
    expect(screen.getByText('1 exercice · 2 séries')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new test against the current production code**

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: `1 passed`. This is a characterization test of existing behavior, so RED is demonstrated by mutation in the next step rather than by a missing implementation.

- [ ] **Step 3: Demonstrate sensitivity with a temporary manual mutant**

In `src/features/routines/ExercisePickerScreen.tsx`, temporarily replace only the `add` function with:

```ts
const add = () => {
  void Promise.resolve().then(() => navigate(-1));
};
```

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: FAIL because `Développé militaire` never appears in the editor or the persisted summary never reaches `1 exercice · 2 séries`.

Restore the exact original function before doing anything else:

```ts
const add = () => {
  // Added in the order they were tapped, which is the order they were meant.
  void addExercisesToRoutine(id, selected).then(() => navigate(-1));
};
```

Confirm that `git diff -- src/features/routines/ExercisePickerScreen.tsx` is empty.

- [ ] **Step 4: Verify the restored preservation proof and static gates**

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineFlow.integration.test.tsx
npm.cmd run typecheck
npm.cmd exec eslint -- src/features/routines/RoutineFlow.integration.test.tsx
git diff --check
```

Expected: the integration test passes, TypeScript exits 0, targeted ESLint exits 0, and `git diff --check` prints nothing.

- [ ] **Step 5: Commit the preservation test separately**

```powershell
git add -- src/features/routines/RoutineFlow.integration.test.tsx
git commit -m "test(routines): couvre la composition persistante"
```

The commit must contain only `RoutineFlow.integration.test.tsx`.

---

### Task 2: Deep `RoutineCollection` module

**Files:**
- Create: `src/features/routines/RoutineCollection.tsx`
- Create: `src/features/routines/RoutineCollection.test.tsx`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Test unchanged: `src/features/routines/RoutineFlow.integration.test.tsx`

**Interfaces:**
- Consumes: loaded `readonly RoutineSummary[]`, loaded `readonly RoutineFolder[]`, existing `routineSummaryLine`, `ReorderableList`, `moveItem`, translations, and icons.
- Produces:

```ts
export type RoutinePlacement = Readonly<{
  id: Routine['id'];
  folderId: Routine['folderId'];
}>;

export type RoutineCollectionIntent =
  | { kind: 'createBlank' }
  | { kind: 'showTemplates' }
  | { kind: 'openRoutine'; routine: Routine }
  | { kind: 'openRoutineActions'; routine: Routine }
  | { kind: 'openFolderActions'; folder: RoutineFolder }
  | { kind: 'reorderRoutines'; placement: readonly RoutinePlacement[] };

export type RoutineCollectionProps = Readonly<{
  summaries: readonly RoutineSummary[];
  folders: readonly RoutineFolder[];
  onIntent: (intent: RoutineCollectionIntent) => void;
}>;

export function RoutineCollection(props: RoutineCollectionProps): ReactElement;
```

- [ ] **Step 1: Write interface-level tests before the module exists**

Create `src/features/routines/RoutineCollection.test.tsx` with this exact content:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { RoutineCollection } from './RoutineCollection';

const stamps = {
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

function routine(id: string, name: string, folderId = '', order = 0): Routine {
  return {
    ...stamps,
    id,
    name,
    folderId,
    order,
    version: 1,
  };
}

function folder(id: string, name: string, order = 0): RoutineFolder {
  return { ...stamps, id, name, order };
}

function summary(value: Routine, exerciseCount = 1, setCount = 2): RoutineSummary {
  return { routine: value, exerciseCount, setCount };
}

describe('RoutineCollection', () => {
  it('expose les deux intentions de l’état vide', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    render(<RoutineCollection summaries={[]} folders={[]} onIntent={onIntent} />);

    await user.click(screen.getByRole('button', { name: 'Routine vide' }));
    await user.click(screen.getByRole('button', { name: 'Partir d’un modèle' }));

    expect(onIntent).toHaveBeenNthCalledWith(1, { kind: 'createBlank' });
    expect(onIntent).toHaveBeenNthCalledWith(2, { kind: 'showTemplates' });
  });

  it('rend la racine puis chaque dossier dans l’ordre reçu', () => {
    const rootRoutine = routine('routine-root', 'Racine');
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Poussée', pushFolder.id, 1);
    render(
      <RoutineCollection
        summaries={[summary(rootRoutine), summary(pushRoutine)]}
        folders={[pushFolder]}
        onIntent={vi.fn()}
      />,
    );

    const rootHeading = screen.getByRole('heading', { name: 'Sans dossier' });
    const rootName = screen.getByText('Racine');
    const folderHeading = screen.getByRole('heading', { name: 'Push' });
    const folderName = screen.getByText('Poussée');

    expect(rootHeading.compareDocumentPosition(rootName) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(rootName.compareDocumentPosition(folderHeading) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(folderHeading.compareDocumentPosition(folderName) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('rend la racine même vide dès qu’un dossier existe', () => {
    render(
      <RoutineCollection
        summaries={[]}
        folders={[folder('folder-push', 'Push')]}
        onIntent={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sans dossier' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Push' })).toBeVisible();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('traduit les ouvertures en intentions portant les entités courantes', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Poussée', pushFolder.id);
    render(
      <RoutineCollection
        summaries={[summary(pushRoutine)]}
        folders={[pushFolder]}
        onIntent={onIntent}
      />,
    );

    await user.click(screen.getByText('Poussée'));
    await user.click(screen.getByRole('button', { name: 'Routine — Poussée' }));
    await user.click(screen.getByRole('button', { name: 'Dossier — Push' }));

    expect(onIntent).toHaveBeenNthCalledWith(1, {
      kind: 'openRoutine',
      routine: pushRoutine,
    });
    expect(onIntent).toHaveBeenNthCalledWith(2, {
      kind: 'openRoutineActions',
      routine: pushRoutine,
    });
    expect(onIntent).toHaveBeenNthCalledWith(3, {
      kind: 'openFolderActions',
      folder: pushFolder,
    });
  });

  it('classe une routine racine dans le dossier franchi au clavier', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const rootRoutine = routine('routine-root', 'Racine');
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Poussée', pushFolder.id, 1);
    const summaries = Object.freeze([
      Object.freeze(summary(rootRoutine)),
      Object.freeze(summary(pushRoutine)),
    ]);
    const folders = Object.freeze([Object.freeze(pushFolder)]);
    render(
      <RoutineCollection summaries={summaries} folders={folders} onIntent={onIntent} />,
    );

    await user.click(screen.getByRole('button', { name: 'Déplacer Racine' }));
    await user.keyboard('{ArrowDown}');

    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'reorderRoutines',
      placement: [
        { id: rootRoutine.id, folderId: pushFolder.id },
        { id: pushRoutine.id, folderId: pushFolder.id },
      ],
    });
    expect(summaries[0]?.routine.folderId).toBe('');
    expect(folders[0]?.id).toBe(pushFolder.id);
  });

  it('reclasse une routine dans la racine en franchissant son dossier', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    const pushFolder = folder('folder-push', 'Push');
    const pushRoutine = routine('routine-push', 'Poussée', pushFolder.id);
    render(
      <RoutineCollection
        summaries={[summary(pushRoutine)]}
        folders={[pushFolder]}
        onIntent={onIntent}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Déplacer Poussée' }));
    await user.keyboard('{ArrowUp}');

    expect(onIntent).toHaveBeenLastCalledWith({
      kind: 'reorderRoutines',
      placement: [{ id: pushRoutine.id, folderId: '' }],
    });
  });
});
```

- [ ] **Step 2: Verify RED for the missing module**

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineCollection.test.tsx
```

Expected: FAIL because `./RoutineCollection` does not exist.

- [ ] **Step 3: Implement the deep module with no data access**

Create `src/features/routines/RoutineCollection.tsx` with this exact content:

```tsx
import type { ReactElement } from 'react';
import type { RoutineSummary } from '@/data/repositories/routines';
import type { Routine, RoutineFolder } from '@/data/types';
import { t } from '@/i18n/fr';
import { moveItem } from '@/lib/routineOrder';
import { Button, EmptyState, ReorderableList } from '@/ui';
import type { ItemState } from '@/ui';
import { GripIcon, MoreIcon } from '@/ui/icons';
import { routineSummaryLine } from './summary';

export type RoutinePlacement = Readonly<{
  id: Routine['id'];
  folderId: Routine['folderId'];
}>;

export type RoutineCollectionIntent =
  | { kind: 'createBlank' }
  | { kind: 'showTemplates' }
  | { kind: 'openRoutine'; routine: Routine }
  | { kind: 'openRoutineActions'; routine: Routine }
  | { kind: 'openFolderActions'; folder: RoutineFolder }
  | { kind: 'reorderRoutines'; placement: readonly RoutinePlacement[] };

export type RoutineCollectionProps = Readonly<{
  summaries: readonly RoutineSummary[];
  folders: readonly RoutineFolder[];
  onIntent: (intent: RoutineCollectionIntent) => void;
}>;

type Entry =
  | { kind: 'heading'; id: string; folder?: RoutineFolder }
  | { kind: 'routine'; id: string; summary: RoutineSummary };

function projectEntries(
  summaries: readonly RoutineSummary[],
  folders: readonly RoutineFolder[],
): Entry[] {
  const entries: Entry[] = [];
  const inFolder = (id: string) => summaries.filter((row) => row.routine.folderId === id);

  if (folders.length > 0) entries.push({ kind: 'heading', id: 'root' });
  for (const summary of inFolder('')) {
    entries.push({ kind: 'routine', id: summary.routine.id, summary });
  }

  for (const folder of folders) {
    entries.push({ kind: 'heading', id: folder.id, folder });
    for (const summary of inFolder(folder.id)) {
      entries.push({ kind: 'routine', id: summary.routine.id, summary });
    }
  }

  return entries;
}

function projectPlacement(entries: readonly Entry[]): RoutinePlacement[] {
  const placement: RoutinePlacement[] = [];
  let folderId = '';

  for (const entry of entries) {
    if (entry.kind === 'heading') folderId = entry.folder?.id ?? '';
    else placement.push({ id: entry.id, folderId });
  }

  return placement;
}

function RoutineRow({
  summary,
  state,
  onIntent,
}: {
  summary: RoutineSummary;
  state: ItemState;
  onIntent: (intent: RoutineCollectionIntent) => void;
}) {
  const { routine, exerciseCount, setCount } = summary;
  const subtitle = routine.subtitle?.trim();

  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-2xl transition-colors
        duration-[var(--dur-1)]
        ${
          state.dragging
            ? 'bg-[var(--surface-2)] ring-2 ring-[var(--accent-ink)]'
            : 'bg-[var(--surface-1)]'
        }`}
    >
      <button
        type="button"
        aria-label={t('routines.dragHandle', { name: routine.name })}
        className="flex w-11 shrink-0 cursor-grab items-center justify-center text-[var(--text-2)]
          active:cursor-grabbing"
        {...state.handleProps}
      >
        <GripIcon />
      </button>

      <button
        type="button"
        onClick={() => onIntent({ kind: 'openRoutine', routine })}
        className="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-1 py-3 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <span className="truncate text-base text-[var(--text-1)]">{routine.name}</span>
        {subtitle !== undefined && subtitle !== '' && (
          <span className="truncate text-sm text-[var(--text-2)]">{subtitle}</span>
        )}
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {routineSummaryLine(exerciseCount, setCount)}
        </span>
      </button>

      <button
        type="button"
        aria-label={`${t('routines.actionsTitle')} — ${routine.name}`}
        onClick={() => onIntent({ kind: 'openRoutineActions', routine })}
        className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <MoreIcon />
      </button>
    </div>
  );
}

export function RoutineCollection({
  summaries,
  folders,
  onIntent,
}: RoutineCollectionProps): ReactElement {
  if (summaries.length === 0 && folders.length === 0) {
    return (
      <EmptyState
        reading="0"
        unit={t('routines.countUnit')}
        body={t('routines.emptyBody')}
        action={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => onIntent({ kind: 'createBlank' })}
            >
              {t('routines.newBlank')}
            </Button>
            <Button fullWidth onClick={() => onIntent({ kind: 'showTemplates' })}>
              {t('routines.newFromTemplate')}
            </Button>
          </div>
        }
      />
    );
  }

  const entries = projectEntries(summaries, folders);

  return (
    <ReorderableList
      className="flex flex-col gap-3"
      items={entries}
      keyOf={(entry) => entry.id}
      onReorder={(from, to) =>
        onIntent({
          kind: 'reorderRoutines',
          placement: projectPlacement(moveItem(entries, from, to)),
        })
      }
      renderItem={(entry, _index, state) =>
        entry.kind === 'routine' ? (
          <RoutineRow summary={entry.summary} state={state} onIntent={onIntent} />
        ) : (
          <div className="flex items-center gap-2 px-1 pt-2">
            <h2 className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
              {entry.folder?.name ?? t('routines.rootFolder')}
            </h2>
            {entry.folder !== undefined && (
              <button
                type="button"
                aria-label={`${t('routines.folderTitle')} — ${entry.folder.name}`}
                onClick={() =>
                  entry.folder && onIntent({ kind: 'openFolderActions', folder: entry.folder })
                }
                className="-my-2 -mr-2 flex size-12 items-center justify-center
                  text-[var(--text-2)]"
              >
                <MoreIcon width="18" height="18" />
              </button>
            )}
          </div>
        )
      }
    />
  );
}
```

- [ ] **Step 4: Verify the new module tests are GREEN before integrating the caller**

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineCollection.test.tsx
```

Expected: `6 passed`.

- [ ] **Step 5: Replace the collection implementation inside `RoutinesScreen`**

In `src/features/routines/RoutinesScreen.tsx`:

1. Remove the `RoutineSummary` type import, `moveItem`, `Button`, `EmptyState`, `ReorderableList`, `ItemState`, `GripIcon`, `MoreIcon`, `routineSummaryLine`, the private `Entry` union, `toEntries`, `toPlacement`, and `RoutineRow`.
2. Keep `Routine`, `RoutineFolder`, `ActionSheet`, `ConfirmSheet`, `HeaderAction`, `OptionSheet`, and `PlusIcon`.
3. Add these imports:

```ts
import { RoutineCollection } from './RoutineCollection';
import type { RoutineCollectionIntent } from './RoutineCollection';
```

4. After `loaded` is computed, add this exhaustive handler:

```ts
const handleCollectionIntent = (intent: RoutineCollectionIntent) => {
  switch (intent.kind) {
    case 'createBlank':
      startBlank();
      return;
    case 'showTemplates':
      setSheet({ kind: 'templates' });
      return;
    case 'openRoutine':
      openEditor(intent.routine);
      return;
    case 'openRoutineActions':
      setSheet({ kind: 'routineActions', routine: intent.routine });
      return;
    case 'openFolderActions':
      setSheet({ kind: 'folderActions', folder: intent.folder });
      return;
    case 'reorderRoutines':
      void reorderRoutines(intent.placement.map(({ id, folderId }) => ({ id, folderId })));
  }
};
```

5. Replace the complete existing loaded-content block beginning with `{loaded &&` and ending before the first `<ActionSheet` with:

```tsx
{loaded && (
  <RoutineCollection
    summaries={summaries}
    folders={folders}
    onIntent={handleCollectionIntent}
  />
)}
```

Do not change any other JSX, callback, sheet, route, repository call, or translation.

- [ ] **Step 6: Verify the module and the unchanged route journey together**

Run:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutineFlow.integration.test.tsx
npm.cmd run typecheck
npm.cmd exec eslint -- src/features/routines/RoutineCollection.tsx src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutinesScreen.tsx
```

Expected: `7 passed`, TypeScript exits 0, and targeted ESLint exits 0.

- [ ] **Step 7: Demonstrate the module tests kill the two structural mutants**

Mutant A: temporarily change this line in `projectEntries`:

```ts
if (folders.length > 0) entries.push({ kind: 'heading', id: 'root' });
```

to:

```ts
if (false) entries.push({ kind: 'heading', id: 'root' });
```

Run the component test and expect the root-heading tests to fail:

```powershell
npm.cmd run test:run -- src/features/routines/RoutineCollection.test.tsx
```

Restore the original line.

Mutant B: temporarily change the heading branch in `projectPlacement` from:

```ts
if (entry.kind === 'heading') folderId = entry.folder?.id ?? '';
```

to:

```ts
if (entry.kind === 'heading') folderId = '';
```

Run the same component test and expect the root-to-folder placement test to fail. Restore the original line, then confirm:

```powershell
git diff --check
npm.cmd run test:run -- src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutineFlow.integration.test.tsx
```

Expected: `git diff --check` prints nothing and all 7 targeted tests pass after restoration.

- [ ] **Step 8: Run the complete pre-commit gates**

Run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

Expected: all commands exit 0, all tests pass, Vite produces the production build, and `git diff --check` prints nothing.

- [ ] **Step 9: Commit the behavior-preserving refactor**

```powershell
git add -- src/features/routines/RoutineCollection.tsx src/features/routines/RoutineCollection.test.tsx src/features/routines/RoutinesScreen.tsx
git commit -m "refactor(routines): extrait la collection de routines"
```

The commit must not contain `RoutineFlow.integration.test.tsx`, repositories, routes, translations, schema, migrations, dependency files, or `PROGRESS.md`.

---

## Post-Task Review and Completion

After Task 1 and Task 2 each pass their independent spec-and-quality review:

1. Generate a whole-change review package from commit `9d9fd58` through the refactor HEAD.
2. Dispatch an independent whole-change reviewer against the approved design spec and this plan.
3. If the reviewer reports Critical or Important findings, dispatch one fixer with the complete list, rerun covering tests, and re-review.
4. Run fresh final gates:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

5. Update `PROGRESS.md` with the completed phase-6 routine preservation proof, extracted module, fresh test counts, review result, and this phone checkpoint:

> Créer une routine vide, la renommer, ajouter un exercice et une deuxième série, forcer la fermeture de FitTrack, rouvrir l’application, puis vérifier que la liste affiche le même nom et `1 exercice · 2 séries`. Aucun changement visuel n’est attendu.

6. Commit the documentation separately:

```powershell
git add -- PROGRESS.md
git commit -m "docs: consigne la refacto de la collection de routines"
```
