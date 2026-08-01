# Routine collection refactor design

**Date:** 2026-08-01  
**Status:** approved in conversation, awaiting written-spec review  
**Scope:** phase 6 preservation proof followed by the first structural split of
`RoutinesScreen`

## Goal

Protect the complete routine-composition journey with a real integration test,
then reduce the responsibilities of `RoutinesScreen` without changing any
visible behavior, route, persistence rule, translation, or repository contract.

The preserved journey is:

1. open the empty routines list;
2. create a blank routine;
3. rename it in the editor;
4. open the real exercise picker and select an existing exercise;
5. add a second planned set;
6. fully unmount the route tree;
7. remount the routines list and observe the persisted name and summary.

## Constraints

- Keep the interface and all user-visible behavior unchanged.
- Keep every UI string in `src/i18n/fr.ts`; this refactor adds no string.
- Keep all IndexedDB access behind the existing repositories.
- Use the real repositories and `fake-indexeddb` in the integration test; do not
  mock Dexie, React Router, or the three screens in the journey.
- Preserve the distinction between `undefined` (live query still loading) and a
  loaded empty collection.
- Preserve the current folder and drag semantics, including the root heading.
- Do not refactor `RoutineEditorScreen` or `ExercisePickerScreen` in this slice.
- Commit the preservation test separately from the production refactor.
- Add no speculative extension point or generic collection abstraction.

## Preservation proof

Add `src/features/routines/RoutineFlow.integration.test.tsx` before touching
production code. The test renders the three real routes with `MemoryRouter`,
uses the real screens and repositories, and resets the real Dexie database on
`fake-indexeddb` between tests.

The fixture creates one custom exercise through the exercise repository before
rendering. Every routine operation is then performed through the UI. After the
routine is renamed, the exercise is selected and a second set is added, the
entire route tree is unmounted. A fresh render of `/routines` must show the
persisted routine name and the exact current summary `1 exercice · 2 séries`.
The test may additionally read `getRoutineDetail` to diagnose a failure, but the
primary assertion is the visible result through the screen interface.

Because this is a characterization test for existing behavior, its sensitivity
must be demonstrated with a temporary manual mutant. Neutralizing one relevant
write path, such as the call to `addExercisesToRoutine`, must make the test fail
for the expected reason. The exact production code is then restored and the
test must pass. The mutant is never committed.

## Module design

Create a feature-specific deep module at
`src/features/routines/RoutineCollection.tsx`. Its seam sits between a loaded
routine/folder snapshot and the screen's navigation, persistence, and sheet
orchestration.

### Interface

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

export function RoutineCollection(
  props: RoutineCollectionProps,
): ReactElement;
```

The three props are the complete external interface. `summaries` and `folders`
are already-loaded snapshots; neither may be `undefined`. `onIntent` is invoked
synchronously and reports user intent without performing navigation, opening a
sheet, or writing to a repository.

`RoutinesScreen` handles the discriminated intent exhaustively. It keeps all
live queries, the loading distinction, the header count and add action,
navigation, active-workout behavior, repository commands, templates, and every
sheet state.

### Hidden implementation

`RoutineCollection` hides:

- the private heading/routine entry union;
- projection of summaries and folders into the flat rendered order;
- the empty state and its two actions;
- folder headings and routine rows;
- `ReorderableList`, drag handles, icons, and item state;
- the root-heading rule;
- conversion of a visual move into the complete persistent placement;
- the list-specific ARIA labels and summary rendering already used today.

Private helpers are not exported. Tests exercise them through
`RoutineCollection`, which is the module interface. A second public model file
would create a shallow seam and is therefore excluded.

## Ordering and folder invariants

- With no folder, no root heading is rendered.
- With at least one folder, the root heading is first even when it contains no
  routine.
- Root routines follow the root heading when it exists.
- Each folder heading follows in repository order and precedes its routines.
- Relative routine order from `listRoutineSummaries` is preserved.
- Headings are landmarks and never draggable items.
- Moving a routine across a heading changes both its order and `folderId`.
- Reorder intent contains every rendered routine exactly once in final order.
- Input snapshots are never mutated.
- An empty state appears only when both snapshots are empty; an empty folder is
  still rendered.

Repository guarantees remain the preconditions for unique IDs and valid folder
references. The module does not invent repair behavior for orphaned references
or duplicate IDs.

## Dependency strategy

Projection, React rendering, translations, icons, and reordering are in-process
dependencies kept behind the module seam. They need no adapter.

Dexie remains outside `RoutineCollection`. `RoutinesScreen` observes the
existing repository queries, while the integration test uses the same
repositories against `fake-indexeddb`. No repository port is introduced: there
is only one production adapter, so an additional interface would be
hypothetical indirection.

## Error behavior

The collection performs no asynchronous work and introduces no new domain
error. Exceptions raised by the parent intent handler are not captured or
translated. Repository and navigation failures remain handled exactly where
they are today. Invalid drag indices keep the current `moveItem` tolerance; no
new validation or stale-snapshot policy is added.

## Verification strategy

The work is split into two commits:

1. `test(routines): couvre la composition persistante d'une routine`
2. `refactor(routines): extrait la collection de routines`

The refactor adds interface-level tests for `RoutineCollection` covering:

- empty state actions;
- root and folder ordering, including an empty root;
- routine, routine-menu, and folder-menu intents;
- movement from root into a folder and back into root;
- complete placement ordering;
- absence of input mutation.

Manual mutants must demonstrate that the preservation proof catches a missing
routine/exercise write and that the collection tests catch a removed root
heading and a broken folder-context scan. All mutants are restored before
commits.

After both commits, run fresh:

```text
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:run
npm.cmd run build
git diff --check
```

An independent reviewer checks each task for spec compliance and code quality,
followed by a whole-change review. `PROGRESS.md` is updated only after the final
gates and review succeed.

## Manual checkpoint

On the phone, create a blank routine, rename it, add an exercise and a second
set, force-close FitTrack, reopen it, and verify that the routine list shows the
same name and `1 exercice · 2 séries`. No visual change is expected.

## Explicitly out of scope

- UI, copy, route, schema, migration, or repository behavior changes;
- refactoring `RoutineEditorScreen` or `ExercisePickerScreen`;
- redesigning sheets or active-workout behavior;
- generic list/render-prop abstractions;
- optimistic concurrency or stale-snapshot detection;
- the separate manual checkpoint for the completed Hevy import work.
