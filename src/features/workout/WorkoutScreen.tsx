import { useEffect, useState } from 'react';
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
  restoreSet,
  uncompleteSet,
  updateSetValues,
  updateWorkout,
  updateWorkoutExercise,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { isRestTriggering, resolveRestSeconds } from '@/lib/rest';
import { toBlocks } from '@/lib/routineOrder';
import { useRestTimer } from '@/stores/restTimer';
import {
  ActionBand,
  ActionSheet,
  AddRow,
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
import { PlateLoadSheet } from './PlateLoadSheet';
import { platesConfigFor } from './plateConfig';
import { unlockChime } from './restChime';
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
  | { kind: 'set'; setId: string; number: number }
  | { kind: 'plates' };

/** The bar load a plate sheet reads, kept out of `SheetState` so its close
 *  animation still has valid numbers after the set menu is gone. */
type PlatesView = { weightKg: number; barWeight: number; sides: number };

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

/** What validating a set of this exercise is worth, in rest. */
interface RestPlan {
  /** False between two members of a superset — the round is not over. */
  isLastOfBlock: boolean;
  seconds: number;
}

/**
 * The rest each exercise owes, from the same blocks the superset marks use.
 *
 * A superset rests **once, after the round**, and for the **longest** duration
 * configured in the group: recovery from a round is governed by its most
 * demanding movement, not by whichever exercise happens to come last.
 */
function restPlans(lines: WorkoutExerciseDetail[]): Map<string, RestPlan> {
  const plans = new Map<string, RestPlan>();

  for (const block of toBlocks(lines.map((line) => line.row))) {
    // Read through the resolver rather than straight off the row: a session
    // started before this field existed has no `restSeconds` at all — the field
    // is unindexed, so there was no migration to write and nothing backfilled
    // the rows already in the database. `Math.max` over one `undefined` yields
    // NaN, `endsAt` becomes NaN, and the rest ends the instant it starts.
    const seconds = Math.max(
      ...block.rows.map((row) => resolveRestSeconds(row.restSeconds, undefined)),
    );
    block.rows.forEach((row, index) => {
      plans.set(row.id, { isLastOfBlock: index === block.rows.length - 1, seconds });
    });
  }

  return plans;
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
  const [platesView, setPlatesView] = useState<PlatesView | null>(null);
  const rest = useRestTimer();

  // `null` is "no session", `undefined` is "not answered yet". Blurring them
  // makes the screen flash its empty state on every open (Lot 3 lesson).
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );

  /**
   * The gesture that lets the timer make a noise two minutes from now.
   *
   * A mobile browser refuses to start audio outside a user gesture, and the
   * `setTimeout` that ends a rest has none — it would fail *silently*, which is
   * the worst failure available to a feature whose job is to be heard. On the
   * document rather than on a wrapper: the tick that starts a rest can land on
   * any control of this screen.
   */
  useEffect(() => {
    document.addEventListener('pointerdown', unlockChime);
    return () => document.removeEventListener('pointerdown', unlockChime);
  }, []);

  const stopRest = useRestTimer((state) => state.stop);
  const restingSetId = rest.setId;

  /**
   * The safety net for a rest whose set is gone — deleted, or carried off with
   * its exercise. Without it the store keeps a dead id and the session line
   * reads "Repos 1:30" for the rest of the workout.
   */
  useEffect(() => {
    if (restingSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) =>
      line.sets.some((set) => set.id === restingSetId),
    );
    if (!alive) stopRest(restingSetId);
  }, [restingSetId, detail, stopRest]);

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
  const plans = restPlans(exercises);

  /**
   * Validating a set is what starts its rest. A rest ends three ways: it runs
   * out, its exercise leaves the session, or the set is un-ticked (`onUncomplete`
   * below). Un-ticking stops it because a set you un-tick is one you are no
   * longer resting on — and fixing a typo is not a reason to un-tick, since the
   * figures stay editable while the set is ticked (`SetValueCell`). Nothing
   * fires for a warm-up or between two members of a superset (`isRestTriggering`).
   */
  const startRest = (rowId: string, setId: string, setType: SetType): void => {
    const plan = plans.get(rowId);
    if (plan === undefined) return;
    if (!isRestTriggering({ setType }, { isLastOfBlock: plan.isLastOfBlock })) return;
    rest.start(setId, plan.seconds);
  };

  const totalSets = exercises.reduce((count, line) => count + line.sets.length, 0);
  const completedSets = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );

  const lineOf = (rowId: string): WorkoutExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const nameOf = (rowId: string): string =>
    lineOf(rowId)?.exercise?.name ?? t('workout.deletedExercise');

  /** A set and the exercise it belongs to — the plate calculator needs both. */
  const setContext = (setId: string): { set: WorkoutSet; exercise: Exercise } | null => {
    for (const line of exercises) {
      const set = line.sets.find((candidate) => candidate.id === setId);
      if (set !== undefined && line.exercise !== undefined) return { set, exercise: line.exercise };
    }
    return null;
  };

  /**
   * The set menu, which always deletes and — on a barbell load with a weight
   * entered — offers the plate calculator. The load comes from what was typed,
   * or failing that the prescription: you check plates before you lift, when the
   * cell is still the grey target.
   */
  const setSheetActions = () => {
    const context = sheet?.kind === 'set' ? setContext(sheet.setId) : null;
    const config = context !== null ? platesConfigFor(context.exercise) : null;
    const weight = context?.set.weight ?? context?.set.targetWeight;
    const actions = [];

    if (context !== null && config !== null && weight !== undefined && weight > 0) {
      actions.push({
        label: t('workout.plates'),
        onSelect: () => {
          setPlatesView({ weightKg: weight, barWeight: config.barWeight, sides: config.sides });
          setSheet({ kind: 'plates' });
        },
      });
    }

    actions.push({
      label: t('workout.deleteSet'),
      danger: true,
      onSelect: () => {
        if (sheet?.kind === 'set') void deleteSet(sheet.setId);
      },
    });

    return actions;
  };

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
        <div className="flex items-center gap-2">
          {/* Le chrono global, épinglé au header : c'est un fait de séance, pas
              d'exercice, donc il ne descend jamais dans une card ni ne part au
              défilement. À droite du titre, à gauche du menu — l'avancement
              descend au-dessus de la liste, le repos vit sur la card. Le bandeau
              `WorkoutMeter` est dissous : chaque relevé va où vit son sens. */}
          <ElapsedTime startedAt={workout.startedAt} className="text-base text-[var(--text-2)]" />
          <HeaderAction
            label={t('workout.workoutMenu')}
            onClick={() => setSheet({ kind: 'workout' })}
          >
            <MoreIcon />
          </HeaderAction>
        </div>
      }
      footer={
        <ActionBand
          label={t('workout.finish')}
          onClick={() => void navigate('/workout/finish')}
        />
      }
    >
      <div className="flex flex-col gap-2">
        {exercises.length === 0 ? (
          <EmptyState reading="0" unit={t('routine.emptyUnit')} body={t('workout.emptyBody')} />
        ) : (
          <>
            {/* L'avancement descend au-dessus de la liste qu'il compte (règle du
                Lot 4), là où l'ancien bandeau le pinglait. */}
            <p className="label-xs px-1 font-semibold text-[var(--text-2)]">
              {workoutProgressLine(completedSets, totalSets)}
            </p>
            <ReorderableList
              className="flex flex-col gap-3"
              items={exercises}
              keyOf={(line) => line.row.id}
              onReorder={(from, to) => void reorderWorkoutExercises(workout.id, from, to)}
              renderItem={(line, _index, state) => (
                <WorkoutExerciseCard
                  line={line}
                  superset={places.get(line.row.id)}
                  // The rest belongs to the exercise whose set is counting down.
                  rest={
                    rest.setId !== null && line.sets.some((set) => set.id === rest.setId)
                      ? {
                          setId: rest.setId,
                          startedAt: rest.startedAt,
                          endsAt: rest.endsAt,
                          onDone: () => rest.stop(),
                        }
                      : null
                  }
                  state={state}
                  onMenu={() => setSheet({ kind: 'exercise', rowId: line.row.id })}
                  onSetMenu={(set, number) => setSheet({ kind: 'set', setId: set.id, number })}
                  onWrite={(setId, values) => void updateSetValues(setId, values)}
                  onComplete={(setId, values, set) => {
                    void completeSet(setId, values);
                    startRest(line.row.id, setId, set.setType);
                  }}
                  onUncomplete={(setId) => {
                    void uncompleteSet(setId);
                    // The rest this set started ends with it. `stop(setId)` only
                    // touches the rest that belongs to this set, so un-ticking an
                    // older set never cancels a rest a newer one is running.
                    stopRest(setId);
                  }}
                  onDeleteSet={(setId) => void deleteSet(setId)}
                  onRestoreSet={(setId) => void restoreSet(setId)}
                  onAddSet={() => void duplicateLastSet(line.row.id)}
                />
              )}
            />
          </>
        )}

        {/* Toujours au pied de la liste, identique que la séance soit vide ou
            non : une séance démarrée à vide depuis l'accueil doit pouvoir
            accueillir son premier exercice — c'était le seul écran où ce geste
            disparaissait quand la liste était vide. Même carte que l'éditeur de
            routine, même geste que les cartes emploient pour leurs séries.
            « Terminer » garde la barre collante. */}
        <Card>
          <AddRow
            label={t('workout.addExercise')}
            onClick={() => void navigate('/workout/add')}
          />
        </Card>
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
        actions={setSheetActions()}
      />

      <PlateLoadSheet
        open={sheet?.kind === 'plates'}
        onClose={() => setSheet(null)}
        weightKg={platesView?.weightKg ?? 0}
        barWeight={platesView?.barWeight ?? 20}
        sides={platesView?.sides ?? 2}
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
