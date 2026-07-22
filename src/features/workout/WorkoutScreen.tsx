import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  completeSet,
  deleteSet,
  duplicateLastSet,
  getActiveWorkout,
  getWorkoutDetail,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  uncompleteSet,
  updateSetValues,
  updateWorkout,
  updateWorkoutExercise,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { toBlocks } from '@/lib/routineOrder';
import {
  ActionSheet,
  Button,
  ConfirmSheet,
  EmptyState,
  Input,
  ReorderableList,
  Sheet,
  Textarea,
} from '@/ui';
import { PlusIcon } from '@/ui/icons';
import { ElapsedTime } from './ElapsedTime';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import type { SupersetPlace } from './WorkoutExerciseCard';

type SheetState =
  | { kind: 'workout' }
  | { kind: 'rename' }
  | { kind: 'notes' }
  | { kind: 'exercise'; rowId: string }
  | { kind: 'exerciseNotes'; rowId: string }
  | { kind: 'removeExercise'; rowId: string }
  | { kind: 'set'; setId: string; number: number };

/** Same derivation as the routine editor, from the same pure function. */
function supersetPlaces(lines: WorkoutExerciseDetail[]): Map<string, SupersetPlace> {
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
 * The most important screen of the application — the one read sixty times a
 * session, out of breath, one-handed.
 *
 * It holds no session id of its own: the active session **is** the query
 * (`getActiveWorkout`), which is what makes RF-25 free. Killing the app and
 * reopening it lands back here with everything in place, because there was never
 * anything in memory to lose — every keystroke is already in the database
 * (`updateSetValues`), and validation only adds a timestamp.
 */
export function WorkoutScreen() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetState | null>(null);

  // `null` is "no session", `undefined` is "not answered yet". Blurring them
  // makes the screen flash its empty state on every open (Lot 3 lesson).
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );

  const [draft, setDraft] = useState<{ id: string; name: string; notes: string } | null>(null);
  if (detail != null && draft?.id !== detail.workout.id) {
    setDraft({
      id: detail.workout.id,
      name: detail.workout.name,
      notes: detail.workout.notes ?? '',
    });
  }

  if (active === null) {
    // No session to show. The home screen is where one is started.
    return (
      <Screen title={t('workout.notFound')} onBack={() => void navigate('/')}>
        <span />
      </Screen>
    );
  }

  if (active === undefined || detail == null || draft === null) {
    return (
      <Screen title="">
        <span />
      </Screen>
    );
  }

  const { workout, exercises } = detail;
  const places = supersetPlaces(exercises);

  const lineOf = (rowId: string): WorkoutExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const nameOf = (rowId: string): string =>
    lineOf(rowId)?.exercise?.name ?? t('workout.deletedExercise');

  return (
    <Screen
      title={workout.name === '' ? t('workout.emptyName') : workout.name}
      onBack={() => void navigate('/')}
      action={
        <button
          type="button"
          aria-label={t('workout.workoutMenu')}
          onClick={() => setSheet({ kind: 'workout' })}
          className="flex min-h-12 shrink-0 items-center rounded-xl px-3 text-lg font-semibold
            text-[var(--accent-ink)] active:bg-[var(--surface-1)]"
        >
          <ElapsedTime startedAt={workout.startedAt} />
        </button>
      }
    >
      {exercises.length === 0 ? (
        <EmptyState reading="0" unit={t('routine.emptyUnit')} body={t('workout.emptyBody')} />
      ) : (
        <ReorderableList
          className="flex flex-col gap-3"
          items={exercises}
          keyOf={(line) => line.row.id}
          onReorder={(from, to) => void reorderWorkoutExercises(workout.id, from, to)}
          renderItem={(line, _index, state) => (
            <WorkoutExerciseCard
              line={line}
              superset={places.get(line.row.id)}
              state={state}
              onMenu={() => setSheet({ kind: 'exercise', rowId: line.row.id })}
              onSetMenu={(set, number) => setSheet({ kind: 'set', setId: set.id, number })}
              onWrite={(setId, values) => void updateSetValues(setId, values)}
              onComplete={(setId, values) => void completeSet(setId, values)}
              onUncomplete={(setId) => void uncompleteSet(setId)}
              onAddSet={() => void duplicateLastSet(line.row.id)}
            />
          )}
        />
      )}

      {/* In the flow rather than in the sticky bar: three buttons on 343 px is
          three truncated labels, and this one is reached once or twice a
          session while "Terminer" has to be under the thumb throughout. */}
      <button
        type="button"
        onClick={() => void navigate('/workout/add')}
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border
          border-dashed border-[var(--border)] text-base font-semibold text-[var(--accent-ink)]
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-1)]"
      >
        <PlusIcon width="18" height="18" />
        {t('workout.addExercise')}
      </button>

      <div
        className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-9 border-t border-[var(--border)]
          bg-[var(--surface-0)] px-4 pt-3 pb-3"
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => void navigate('/workout/finish')}
        >
          {t('workout.finish')}
        </Button>
      </div>

      <ActionSheet
        open={sheet?.kind === 'workout'}
        onClose={() => setSheet(null)}
        title={t('workout.workoutMenu')}
        actions={[
          { label: t('workout.rename'), onSelect: () => setSheet({ kind: 'rename' }) },
          { label: t('workout.workoutNotesLabel'), onSelect: () => setSheet({ kind: 'notes' }) },
        ]}
      />

      <Sheet
        open={sheet?.kind === 'rename'}
        onClose={() => setSheet(null)}
        title={t('workout.rename')}
      >
        <Input
          label={t('workout.nameLabel')}
          value={draft.name}
          enterKeyHint="done"
          onChange={(event) => {
            setDraft({ ...draft, name: event.target.value });
            void updateWorkout(workout.id, { name: event.target.value });
          }}
        />
      </Sheet>

      <Sheet
        open={sheet?.kind === 'notes'}
        onClose={() => setSheet(null)}
        title={t('workout.workoutNotesLabel')}
      >
        <Textarea
          label={t('workout.workoutNotesLabel')}
          value={draft.notes}
          onChange={(event) => {
            setDraft({ ...draft, notes: event.target.value });
            void updateWorkout(workout.id, { notes: event.target.value });
          }}
        />
      </Sheet>

      <ActionSheet
        open={sheet?.kind === 'exercise'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'exercise' ? nameOf(sheet.rowId) : ''}
        actions={[
          {
            label: t('workout.addSetAction'),
            onSelect: () => {
              if (sheet?.kind === 'exercise') void duplicateLastSet(sheet.rowId);
            },
          },
          {
            label: t('workout.notesLabel'),
            onSelect: () => {
              if (sheet?.kind === 'exercise') setSheet({ kind: 'exerciseNotes', rowId: sheet.rowId });
            },
          },
          {
            label: t('workout.removeExercise'),
            danger: true,
            onSelect: () => {
              if (sheet?.kind === 'exercise')
                setSheet({ kind: 'removeExercise', rowId: sheet.rowId });
            },
          },
        ]}
      />

      <ExerciseNotesSheet
        open={sheet?.kind === 'exerciseNotes'}
        onClose={() => setSheet(null)}
        line={sheet?.kind === 'exerciseNotes' ? lineOf(sheet.rowId) : null}
      />

      <ConfirmSheet
        open={sheet?.kind === 'removeExercise'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'removeExercise' ? nameOf(sheet.rowId) : ''}
        body={t('workout.removeExerciseConfirm')}
        confirmLabel={t('workout.removeExercise')}
        danger
        onConfirm={() => {
          if (sheet?.kind === 'removeExercise') void removeWorkoutExercise(sheet.rowId);
        }}
      />

      <ActionSheet
        open={sheet?.kind === 'set'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'set' ? t('workout.setNumber', { number: sheet.number }) : ''}
        actions={[
          {
            label: t('workout.deleteSet'),
            danger: true,
            onSelect: () => {
              if (sheet?.kind === 'set') void deleteSet(sheet.setId);
            },
          },
        ]}
      />
    </Screen>
  );
}

/**
 * Per-exercise notes, in their own component for one reason: the draft has to be
 * keyed on the row, and a draft living in the parent would be re-seeded on every
 * keystroke of the grid above it.
 */
function ExerciseNotesSheet({
  open,
  onClose,
  line,
}: {
  open: boolean;
  onClose: () => void;
  line: WorkoutExerciseDetail | null;
}) {
  const [draft, setDraft] = useState<{ id: string; notes: string } | null>(null);
  if (line !== null && draft?.id !== line.row.id) {
    setDraft({ id: line.row.id, notes: line.row.notes ?? '' });
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.notesLabel')}>
      {draft !== null && (
        <Textarea
          label={t('workout.notesLabel')}
          placeholder={t('workout.notesPlaceholder')}
          value={draft.notes}
          onChange={(event) => {
            setDraft({ ...draft, notes: event.target.value });
            void updateWorkoutExercise(draft.id, { notes: event.target.value });
          }}
        />
      )}
    </Sheet>
  );
}
