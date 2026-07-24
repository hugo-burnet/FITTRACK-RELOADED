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
  updateSetType,
  updateSetValues,
  updateWorkout,
  updateWorkoutExercise,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { listRecordSets } from '@/data/repositories/workoutHistory';
import { SET_TYPES } from '@/data/types';
import type { SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeHint, setTypeLabel } from '@/i18n/labels';
import { recordsBeatenBy } from '@/lib/records';
import type { RecordKind } from '@/lib/records';
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
  OptionSheet,
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
import { WorkoutRpeField } from './WorkoutRpeField';
import { workoutProgressLine } from './summary';

type SheetState =
  | { kind: 'workout' }
  | { kind: 'rename' }
  | { kind: 'notes' }
  | { kind: 'exercise'; rowId: string }
  | { kind: 'exerciseNotes'; rowId: string }
  | { kind: 'removeExercise'; rowId: string }
  | { kind: 'set'; setId: string; number: number }
  | { kind: 'setType'; setId: string; number: number }
  | { kind: 'plates' };

/** RF-20 — the four types, each with the sentence `fr.ts` already gives it. */
const SET_TYPE_OPTIONS = SET_TYPES.map((value) => ({
  value,
  label: setTypeLabel(value),
  hint: setTypeHint(value),
}));

/** The bar loads a plate sheet reads, kept out of `SheetState` so its close
 *  animation still has valid numbers after the card's menu is gone. */
type PlatesView = { loads: number[]; barWeight: number; sides: number };

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
   * RF-23 — the scoreboard every set of this session is judged against: each
   * exercise's whole validated history, **today's ticked sets included**.
   *
   * A second query rather than a field of `getWorkoutDetail`, because it answers a
   * different question than the "précédent" column does — that one exists to keep
   * the current session *out* (`excludeWorkoutId`), this one to let it in.
   *
   * Re-read live, and that is the point: nothing about a record is stored, so
   * un-ticking a set, deleting it or turning it into a warm-up mid-session
   * un-makes its record with no invalidation code at all. Keyed on the exercise
   * ids, so adding an exercise re-subscribes and nothing else does.
   */
  const exerciseIds = detail?.exercises.map((line) => line.row.exerciseId) ?? [];
  const recordSets = useLiveQuery(() => listRecordSets(exerciseIds), [exerciseIds.join()]);

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
  const startRest = (line: WorkoutExerciseDetail, setId: string, setType: SetType): void => {
    const plan = plans.get(line.row.id);
    if (plan === undefined) return;
    // The set that follows, in this exercise's own grid: a drop set is chained to
    // the one before it, so that one hands over with no rest (`isRestTriggering`).
    const index = line.sets.findIndex((set) => set.id === setId);
    const next = index === -1 ? undefined : line.sets[index + 1];
    if (
      !isRestTriggering(
        { setType },
        { isLastOfBlock: plan.isLastOfBlock, nextSetType: next?.setType },
      )
    ) {
      return;
    }
    rest.start(setId, plan.seconds);
  };

  /**
   * The set that holds each record, by set id — the question asked again on every
   * render instead of an answer written down anywhere (cf. `recordsBeatenBy`).
   *
   * Only this session's sets can carry a mark: a record set last month is history,
   * not news. And only the **first** of the records a set takes is kept, because a
   * heavier set at equal reps almost always takes the volume record with the load
   * one — two lines of congratulation for one set is noise, and "Charge max" is
   * the headline of the two.
   */
  const records = new Map<string, RecordKind>();
  for (const line of exercises) {
    const universe = recordSets?.get(line.row.exerciseId);
    if (universe === undefined) continue;
    for (const set of line.sets) {
      if (set.isCompleted !== 1) continue;
      const [top] = recordsBeatenBy(set, universe);
      if (top !== undefined) records.set(set.id, top.kind);
    }
  }

  const totalSets = exercises.reduce((count, line) => count + line.sets.length, 0);
  const completedSets = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );

  const lineOf = (rowId: string): WorkoutExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const nameOf = (rowId: string): string =>
    lineOf(rowId)?.exercise?.name ?? t('workout.deletedExercise');

  /**
   * The type of one set, by id. Falls back to `normal` rather than throwing: the
   * sheet keeps rendering through its closing animation, by which point the set
   * it was opened on may already be deleted.
   */
  const setOf = (setId: string): WorkoutSet | undefined => {
    for (const line of exercises) {
      const found = line.sets.find((set) => set.id === setId);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const typeOf = (setId: string): SetType => setOf(setId)?.setType ?? 'normal';

  /**
   * The distinct loads to size plates for — every weight the bar is set to across
   * the exercise's sets, in order, de-duplicated. Warm-ups are included: you load
   * the bar for those too. A back-off set at 55 and a top set at 100 each get
   * their own diagram, rather than one figure standing in for both.
   */
  const exerciseLoads = (line: WorkoutExerciseDetail): number[] => {
    const seen = new Set<number>();
    const loads: number[] = [];
    for (const set of line.sets) {
      const weight = set.weight ?? set.targetWeight;
      if (weight !== undefined && weight > 0 && !seen.has(weight)) {
        seen.add(weight);
        loads.push(weight);
      }
    }
    return loads;
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
      /* L'avancement, épinglé sous l'en-tête, hors du défilement : « il faut que
         ça reste visible tout le temps » — reporté du téléphone, où le relevé
         posé au-dessus de la liste partait au premier scroll. Sur sa propre
         ligne, jamais à côté du titre (leçon du Lot 4). Rien tant que la séance
         est vide : l'état vide dit déjà « 0 ». */
      sub={
        exercises.length > 0 ? (
          <p className="label-xs border-b border-[var(--border)] px-4 pb-3 font-semibold
            text-[var(--text-2)]">
            {workoutProgressLine(completedSets, totalSets)}
          </p>
        ) : undefined
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
            {/* L'avancement ne vit plus ici : il est épinglé sous l'en-tête
                (prop `sub`), pour rester visible même une fois la liste
                défilée. */}
            <ReorderableList
              className="flex flex-col gap-3"
              items={exercises}
              keyOf={(line) => line.row.id}
              onReorder={(from, to) => void reorderWorkoutExercises(workout.id, from, to)}
              renderItem={(line, _index, state) => {
                // The bar's setup and every distinct load it takes across the
                // exercise's sets. Absent config or no load → no plate icon.
                const config =
                  line.exercise !== undefined ? platesConfigFor(line.exercise) : null;
                const loads = config !== null ? exerciseLoads(line) : [];
                return (
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
                  records={records}
                  state={state}
                  onMenu={() => setSheet({ kind: 'exercise', rowId: line.row.id })}
                  onPlates={
                    config !== null && loads.length > 0
                      ? () => {
                          setPlatesView({
                            loads,
                            barWeight: config.barWeight,
                            sides: config.sides,
                          });
                          setSheet({ kind: 'plates' });
                        }
                      : undefined
                  }
                  onSetMenu={(set, number) => setSheet({ kind: 'set', setId: set.id, number })}
                  onWrite={(setId, values) => void updateSetValues(setId, values)}
                  onComplete={(setId, values, set) => {
                    void completeSet(setId, values);
                    startRest(line, setId, set.setType);
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
                );
              }}
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
        actions={[
          {
            label: t('workout.setTypeAction'),
            // The current type, so the entry says what it is about to change
            // rather than making you open the sheet to find out.
            hint: sheet?.kind === 'set' ? setTypeLabel(typeOf(sheet.setId)) : undefined,
            onSelect: () => {
              if (sheet?.kind === 'set') {
                setSheet({ kind: 'setType', setId: sheet.setId, number: sheet.number });
              }
            },
          },
          {
            label: t('workout.deleteSet'),
            danger: true,
            onSelect: () => {
              if (sheet?.kind === 'set') void deleteSet(sheet.setId);
            },
          },
        ]}
      >
        {sheet?.kind === 'set' && (
          <WorkoutRpeField
            value={setOf(sheet.setId)?.rpe}
            onChange={(rpe) => void updateSetValues(sheet.setId, { rpe })}
          />
        )}
      </ActionSheet>

      <OptionSheet
        open={sheet?.kind === 'setType'}
        onClose={() => setSheet(null)}
        title={t('workout.setTypeAction')}
        options={SET_TYPE_OPTIONS}
        value={sheet?.kind === 'setType' ? typeOf(sheet.setId) : 'normal'}
        onSelect={(setType) => {
          if (sheet?.kind === 'setType') void updateSetType(sheet.setId, setType);
        }}
      />

      <PlateLoadSheet
        open={sheet?.kind === 'plates'}
        onClose={() => setSheet(null)}
        loads={platesView?.loads ?? []}
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
