import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  addRoutineSet,
  applyToAllSets,
  deleteRoutineSet,
  getRoutineDetail,
  groupWithPrevious,
  listFolders,
  removeRoutineExercise,
  reorderRoutineExercises,
  ungroupSuperset,
  updateRoutine,
  updateRoutineExercise,
  updateRoutineSet,
} from '@/data/repositories/routines';
import type { RoutineExerciseDetail, RoutineSetTargets } from '@/data/repositories/routines';
import type { RoutineSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { toBlocks } from '@/lib/routineOrder';
import { Button, Card, EmptyState, Input, ListRow, OptionSheet, ReorderableList } from '@/ui';
import type { Option } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { RoutineExerciseCard } from './RoutineExerciseCard';
import type { SupersetPlace } from './RoutineExerciseCard';
import { RoutineExerciseSheet } from './RoutineExerciseSheet';
import { RoutineSetSheet } from './RoutineSetSheet';
import { routineSummaryLine } from './summary';

type SheetState =
  | { kind: 'folder' }
  | { kind: 'exercise'; rowId: string }
  | { kind: 'set'; setId: string; rowId: string; number: number };

/**
 * Where each exercise sits in its superset, keyed by row id.
 *
 * Derived from the stored groups by the same pure function the repository
 * normalises with, so the bracket on screen can never disagree with the numbers
 * in the database.
 */
function supersetPlaces(lines: RoutineExerciseDetail[]): Map<string, SupersetPlace> {
  const places = new Map<string, SupersetPlace>();

  for (const block of toBlocks(lines.map((line) => line.row))) {
    if (block.group === 0) continue;
    block.rows.forEach((row, index) => {
      places.set(row.id, { index, size: block.rows.length });
    });
  }

  return places;
}

/**
 * A routine's screen **is** its editor.
 *
 * There is no read-only view because there is nothing to distinguish it from:
 * every keystroke below is already in the database, so there is no modified
 * state to commit and no "cancel" to offer. Lot 5 adds "Démarrer" at the top of
 * this same screen — and until it exists there is deliberately no button for it,
 * because a button that does nothing is worse than no button.
 */
export function RoutineEditorScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetState | null>(null);

  // `null` is "gone", `undefined` is "not answered yet" — without the
  // distinction the screen flashes "cette routine n'existe plus" on every open.
  const detail = useLiveQuery(() => getRoutineDetail(id), [id]);
  const folders = useLiveQuery(listFolders);

  /**
   * Name and subtitle are typed here and written straight through. The draft
   * exists only to keep `useLiveQuery` from echoing each write back into the
   * field and moving the caret — the exact bug Lot 3 measured on the exercise
   * notes.
   */
  const [draft, setDraft] = useState<{ id: string; name: string; subtitle: string } | null>(null);
  if (detail != null && draft?.id !== detail.routine.id) {
    setDraft({
      id: detail.routine.id,
      name: detail.routine.name,
      subtitle: detail.routine.subtitle ?? '',
    });
  }

  const goBack = () => {
    // React Router's own history index, not `location.key`: arriving here through
    // a `replace` mints a fresh key while leaving the index at 0, so the key says
    // "you can go back" and `navigate(-1)` silently does nothing.
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate('/routines');
  };

  if (detail === null) {
    return (
      <Screen title={t('routine.notFound')} onBack={goBack}>
        <span />
      </Screen>
    );
  }

  if (detail === undefined || draft === null) {
    return (
      <Screen title="" onBack={goBack}>
        <span />
      </Screen>
    );
  }

  const { routine, exercises } = detail;
  const places = supersetPlaces(exercises);
  const setCount = exercises.reduce((total, line) => total + line.sets.length, 0);

  const lineOf = (rowId: string): RoutineExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const openSheetSet = (): RoutineSet | null => {
    if (sheet?.kind !== 'set') return null;
    return lineOf(sheet.rowId)?.sets.find((set) => set.id === sheet.setId) ?? null;
  };

  const folderOptions: Option<string>[] = [
    { value: '', label: t('routines.noFolder') },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];
  const folderName =
    routine.folderId === ''
      ? t('routines.noFolder')
      : (folders?.find((folder) => folder.id === routine.folderId)?.name ??
        t('routines.noFolder'));

  return (
    <Screen
      title={routine.name === '' ? t('routines.untitled') : routine.name}
      /* The arrow is the only thing beside the title. A reading here made three
         elements compete for 375px against a name the user chose, and it
         wrapped badly the moment the name was longer than "Poussée" — reported
         from a real phone. The count now sits above the list it counts, which
         is also where it is actually informative. */
      onBack={goBack}
    >
      <div className="flex flex-col gap-6">
        <Card padded>
          <div className="flex flex-col gap-5">
            <Input
              label={t('routine.nameLabel')}
              placeholder={t('routine.namePlaceholder')}
              value={draft.name}
              enterKeyHint="done"
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                void updateRoutine(routine.id, { name: event.target.value });
              }}
            />
            {/* Everything the name should not have to carry, so the title stays
                one scannable line instead of wrapping into a paragraph. */}
            <Input
              label={t('routine.subtitleLabel')}
              placeholder={t('routine.subtitlePlaceholder')}
              value={draft.subtitle}
              enterKeyHint="done"
              onChange={(event) => {
                setDraft({ ...draft, subtitle: event.target.value });
                void updateRoutine(routine.id, { subtitle: event.target.value });
              }}
            />
          </div>
        </Card>

        <Card>
          <ListRow
            title={t('routine.folderLabel')}
            onClick={() => setSheet({ kind: 'folder' })}
            trailing={
              <span className="flex items-center gap-1 text-base text-[var(--text-1)]">
                {folderName}
                <ChevronDownIcon className="text-[var(--text-2)]" />
              </span>
            }
          />
        </Card>

        {exercises.length === 0 ? (
          <EmptyState
            reading="0"
            unit={t('routine.emptyUnit')}
            body={t('routine.emptyBody')}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* The reading, above the list it measures rather than in the header
                where it fought the routine's name for room. Outside the
                reorderable list on purpose: that component maps its children to
                item indices one for one, so a stray child would misalign every
                drag. */}
            <p className="label-xs px-1 font-semibold text-[var(--text-2)]">
              {routineSummaryLine(exercises.length, setCount)}
            </p>
            <ReorderableList
              className="flex flex-col gap-3"
              items={exercises}
              keyOf={(line) => line.row.id}
              onReorder={(from, to) => void reorderRoutineExercises(routine.id, from, to)}
              renderItem={(line, _index, state) => (
                <RoutineExerciseCard
                  line={line}
                  superset={places.get(line.row.id)}
                  state={state}
                  onMenu={() => setSheet({ kind: 'exercise', rowId: line.row.id })}
                  onOpenSet={(set) =>
                    setSheet({
                      kind: 'set',
                      setId: set.id,
                      rowId: line.row.id,
                      number: line.sets.indexOf(set) + 1,
                    })
                  }
                  onAddSet={() => void addRoutineSet(line.row.id)}
                />
              )}
            />
          </div>
        )}
      </div>

      {/* The way out and the verb of this screen, both under the thumb. The
          Lot 3 lesson is not negotiable: a primary action that needs scrolling
          to reach is a primary action nobody finds. */}
      <div
        className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-9 flex gap-2 border-t
          border-[var(--border)] bg-[var(--surface-0)] px-4 pt-3 pb-3"
      >
        <Button size="lg" className="flex-1" onClick={goBack}>
          {t('routine.done')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={() => void navigate(`/routines/${routine.id}/add`)}
        >
          {t('routine.addExercise')}
        </Button>
      </div>

      <OptionSheet<string>
        open={sheet?.kind === 'folder'}
        onClose={() => setSheet(null)}
        title={t('routine.folderLabel')}
        options={folderOptions}
        value={routine.folderId}
        onSelect={(folderId) => void updateRoutine(routine.id, { folderId })}
      />

      <RoutineExerciseSheet
        open={sheet?.kind === 'exercise'}
        onClose={() => setSheet(null)}
        line={sheet?.kind === 'exercise' ? lineOf(sheet.rowId) : null}
        canGroup={
          sheet?.kind === 'exercise' &&
          exercises.findIndex((line) => line.row.id === sheet.rowId) > 0
        }
        onWrite={(changes) => {
          if (sheet?.kind === 'exercise') void updateRoutineExercise(sheet.rowId, changes);
        }}
        onGroup={() => {
          if (sheet?.kind === 'exercise') void groupWithPrevious(routine.id, sheet.rowId);
        }}
        onUngroup={() => {
          if (sheet?.kind === 'exercise') void ungroupSuperset(routine.id, sheet.rowId);
        }}
        onRemove={() => {
          if (sheet?.kind === 'exercise') void removeRoutineExercise(sheet.rowId);
        }}
      />

      <RoutineSetSheet
        open={sheet?.kind === 'set'}
        onClose={() => setSheet(null)}
        set={openSheetSet()}
        number={sheet?.kind === 'set' ? sheet.number : 1}
        onSave={(changes: RoutineSetTargets) => {
          if (sheet?.kind === 'set') void updateRoutineSet(sheet.setId, changes);
        }}
        onApplyToAll={(changes: RoutineSetTargets) => {
          if (sheet?.kind === 'set') void applyToAllSets(sheet.rowId, changes);
        }}
        onDelete={() => {
          if (sheet?.kind === 'set') void deleteRoutineSet(sheet.setId);
        }}
      />
    </Screen>
  );
}
