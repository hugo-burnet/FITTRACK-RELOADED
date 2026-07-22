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
  AddRow,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  HeaderAction,
  Input,
  ReorderableList,
  Sheet,
  Textarea,
} from '@/ui';
import { MoreIcon } from '@/ui/icons';
import { ElapsedTime } from './ElapsedTime';
import { WorkoutExerciseCard } from './WorkoutExerciseCard';
import type { SupersetPlace } from './WorkoutExerciseCard';
import { workoutProgressLine } from './summary';

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

  const totalSets = exercises.reduce((count, line) => count + line.sets.length, 0);
  const completedSets = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );

  const lineOf = (rowId: string): WorkoutExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const nameOf = (rowId: string): string =>
    lineOf(rowId)?.exercise?.name ?? t('workout.deletedExercise');

  return (
    <Screen
      title={workout.name === '' ? t('workout.emptyName') : workout.name}
      onBack={() => void navigate('/')}
      /* Une icône, comme sur tous les autres écrans. Le chronomètre occupait
         cette place et **rien ne disait que c'était un menu** : un relevé qui
         cache l'unique accès à « Renommer » et « Notes », sur l'écran le plus
         important de l'app. Il descend au-dessus de la liste, là où le Lot 4 a
         mis les relevés. */
      action={
        <HeaderAction label={t('workout.workoutMenu')} onClick={() => setSheet({ kind: 'workout' })}>
          <MoreIcon />
        </HeaderAction>
      }
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => void navigate('/workout/finish')}
        >
          {t('workout.finish')}
        </Button>
      }
    >
      {exercises.length === 0 ? (
        <EmptyState reading="0" unit={t('routine.emptyUnit')} body={t('workout.emptyBody')} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* Le temps écoulé et l'avancement, dans les deux registres du Lot 1 :
              un chiffre tabulaire et un micro-libellé gravé. Hors de la liste
              réordonnable — elle fait correspondre ses enfants aux index un pour
              un, un enfant intrus décalerait chaque glissement. */}
          <div className="flex items-baseline gap-2 px-1">
            <ElapsedTime startedAt={workout.startedAt} className="text-base text-[var(--text-1)]" />
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {workoutProgressLine(completedSets, totalSets)}
            </span>
          </div>

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

          {/* Au pied de la liste qu'il allonge, dans le geste que les cartes
              emploient déjà pour leurs séries. « Terminer » garde la barre
              collante : c'est la seule action qu'on doit trouver sans chercher. */}
          <Card>
            <AddRow
              label={t('workout.addExercise')}
              onClick={() => void navigate('/workout/add')}
            />
          </Card>
        </div>
      )}

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
