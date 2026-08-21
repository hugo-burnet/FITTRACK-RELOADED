import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  applyWorkoutDeload,
  completeSet,
  deleteSet,
  duplicateLastSet,
  getActiveWorkout,
  getWorkoutDetail,
  insertWarmupSets,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  restoreSet,
  uncompleteSet,
  updateSetType,
  updateSetValues,
  updateWorkout,
  updateWorkoutExercise,
  workoutExerciseIdentityOf,
} from '@/data/repositories/workouts';
import {
  getAvailablePlateWeightsKg,
  setAvailablePlateWeightsKg,
} from '@/data/repositories/settings';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { applyCoachObjective } from '@/data/repositories/coachApply';
import {
  dismissRecommendation,
  listPendingRecommendations,
  markRecommendationFollowed,
} from '@/data/repositories/coachRecommendations';
import { listRecordsForWorkout } from '@/data/repositories/personalRecords';
import { SET_TYPES } from '@/data/types';
import type { SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';
import { setTypeHint, setTypeLabel } from '@/i18n/labels';
import { isDeloadEligibleMeasurement } from '@/lib/deload';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { isRestTriggering, restPlans } from '@/lib/rest';
import { supersetPlaces } from '@/lib/routineOrder';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { loadEffortPrompt } from '@/stores/effortPrompt';
import { useRepPacer } from '@/stores/repPacer';
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
  OrderLockButton,
  ReorderableList,
  Sheet,
  Textarea,
  Toggle,
} from '@/ui';
import { CollapseAllIcon, ExpandAllIcon, MoreIcon } from '@/ui/icons';
import { ElapsedTime } from './ElapsedTime';
import { DeloadSheet } from './DeloadSheet';
import { PlateLoadSheet } from './PlateLoadSheet';
import { platesConfigFor } from './plateConfig';
import { announce, primeAnnouncer } from '@/audio/announce';
import { restBonusSecondsFor } from '@/lib/restBonus';
import { nextPaceTarget, prepareFollowingExercisePace, prepareNextPace } from './paceTarget';
import {
  IDLE_PACE_PLAN,
  PACE_LEAD_SECONDS,
  leadSecondsAt,
  paceDecision,
  planAskingReps,
  planWithoutSet,
  type PacePlan,
} from './paceMachine';
import { claimNewRecords, recordAnnouncementKeys } from './recordAnnouncements';
import { claimWorkoutGreeting, setValidationCue } from './workoutCues';
import { WarmupSheet } from './WarmupSheet';
import { warmupContextFor } from './warmupContext';
import { WorkoutExerciseCard, workoutRecordNotices } from './WorkoutExerciseCard';
import { INITIAL_WORKOUT_FOLD_COMMAND, nextWorkoutFoldCommand } from './workoutFold';
import { WorkoutRpeField } from './WorkoutRpeField';
import { workoutProgressLine } from './summary';

type SheetState =
  | { kind: 'workout' }
  | { kind: 'deload' }
  | { kind: 'rename' }
  | { kind: 'notes' }
  | { kind: 'exercise'; rowId: string; openedAt: number }
  | { kind: 'exerciseNotes'; rowId: string }
  | { kind: 'removeExercise'; rowId: string }
  | { kind: 'warmup'; rowId: string }
  | { kind: 'set'; setId: string; number: number }
  | { kind: 'setType'; setId: string; number: number }
  | { kind: 'plates' };

const SET_TYPE_OPTIONS = SET_TYPES.map((value) => ({
  value,
  label: setTypeLabel(value),
  hint: setTypeHint(value),
}));

/** Plate data must survive the menu's closing animation. */
type PlatesView = {
  rowId: string;
  loads: number[];
  barWeight: number;
  sides: number;
  barWeightAdjustable: boolean;
};

function launchAfter(delayMs: number): number {
  return Date.now() + delayMs;
}

/** Live workout backed entirely by the persisted active-workout query. */
export function WorkoutScreen() {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const reorderUnlocked = useExerciseOrderLock((state) => state.unlocked.workout);
  const toggleReorder = useExerciseOrderLock((state) => state.toggle);
  const [platesView, setPlatesView] = useState<PlatesView | null>(null);
  /** The one set currently being asked how hard it was. */
  const [effortSetId, setEffortSetId] = useState<string | null>(null);
  /** The one cadence being prepared — waiting for reps, or armed by them. */
  const [pacePlan, setPacePlan] = useState<PacePlan>(IDLE_PACE_PLAN);
  const armedTypedSets = useRef(new Set<string>());
  const [foldCommand, setFoldCommand] = useState(INITIAL_WORKOUT_FOLD_COMMAND);
  const willExpandAll = !foldCommand.expanded;
  const [plateBarWeights, setPlateBarWeights] = useState<Record<string, number>>({});
  const rest = useRestTimer();
  const pacer = useRepPacer();

  // Keep loading (`undefined`) distinct from no active workout (`null`).
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );
  const availablePlateWeightsKg = useLiveQuery(getAvailablePlateWeightsKg);

  const recordEntries = useLiveQuery(
    async () => (active == null ? undefined : listRecordsForWorkout(active.id)),
    [active?.id],
  );

  const pendingCoach = useLiveQuery(async () => {
    if (detail == null) return [] as Awaited<ReturnType<typeof listPendingRecommendations>>;
    const ids = detail.exercises.map((line) => line.row.exerciseId);
    const pending = await listPendingRecommendations(ids);
    return detail.workout.programId === undefined
      ? pending
      : pending.filter((recommendation) => recommendation.nextLoadKg === undefined);
  }, [detail?.workout.id, detail?.exercises.map((line) => line.row.exerciseId).join('|')]);

  // Mobile browsers require a user gesture before later timer-driven audio.
  useEffect(() => {
    document.addEventListener('pointerdown', primeAnnouncer);
    return () => document.removeEventListener('pointerdown', primeAnnouncer);
  }, []);

  const workoutId = detail?.workout.id;
  const openedSets =
    detail?.exercises.reduce(
      (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
      0,
    ) ?? 0;
  const availableSets =
    detail?.exercises.reduce(
      (count, line) => count + line.sets.filter((set) => set.deletedAt === 0).length,
      0,
    ) ?? 0;

  // Runs again when a first exercise is added or a set is validated. The
  // greeting is claimed once per workout id; an empty shell and a session
  // already under way are both silent.
  useEffect(() => {
    if (workoutId === undefined) return;
    // The tap that started the session happened on another screen, so this one
    // opens with no gesture of its own — but the document has one, and that is
    // what the browser actually requires.
    primeAnnouncer();
    if (claimWorkoutGreeting(workoutId, openedSets, availableSets)) announce('workout-started');
  }, [workoutId, openedSets, availableSets]);

  /**
   * Records arrive from the database a beat after the set that took them, so
   * the announcement watches the list rather than the validation. What has
   * already been said is remembered outside the component — leaving the screen
   * and coming back is not a reason to hear the whole session again; cf.
   * `recordAnnouncements`.
   *
   * One word for a batch, not one per record: three records taken by the same
   * set is one moment, and the announcer's cooldown would swallow the rest
   * anyway.
   */
  useEffect(() => {
    if (workoutId === undefined || recordEntries === undefined) return;
    if (claimNewRecords(workoutId, recordAnnouncementKeys(recordEntries)) > 0) {
      announce('record-beaten');
    }
  }, [workoutId, recordEntries]);

  const stopRest = useRestTimer((state) => state.stop);
  const extendRest = useRestTimer((state) => state.extend);
  const startPace = useRepPacer((state) => state.start);
  const stopPace = useRepPacer((state) => state.stop);
  const restingSetId = rest.setId;

  // The whole preparation of a cadence, from one state and one rule.
  //
  // Waiting for repetitions is legitimate; waiting for a set nobody is going to
  // perform is not, and it costs every arming that comes after — validating a
  // set inside its own ten-second lead is the ordinary way of logging a series
  // after doing it. `paceDecision` is what says which of the two this is.
  //
  // Ten seconds gives enough time to put the phone down and get under the bar;
  // the final 3–2–1 is armed by `RepPaceRail` at the right time.
  useEffect(() => {
    if (pacePlan.kind === 'idle' || detail == null) return;
    const rowId = pacePlan.rowId;
    const line = detail.exercises.find(({ row }) => row.id === rowId);
    const preparation =
      line === undefined
        ? null
        : prepareNextPace(
            line.sets,
            Date.now() - detail.workout.startedAt,
            pacePlan.kind === 'awaiting-reps' ? pacePlan.afterSetId : undefined,
          );
    const decision = paceDecision(pacePlan, preparation, Date.now());

    if (decision.kind === 'hold') return;
    if (decision.kind === 'forget') {
      const forget = setTimeout(() =>
        setPacePlan((current) => planWithoutSet(current, pacePlan.setId)),
      );
      return () => clearTimeout(forget);
    }

    if (decision.kind === 'ask') {
      const timer = setTimeout(() => {
        announce('pace-reps-missing');
        setPacePlan((current) => planAskingReps(current, decision.rowId, decision.setId));
      }, decision.delayMs);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (decision.announceStart) announce('pace-start-10');
      startPace(
        decision.rowId,
        decision.target.setId,
        decision.target.reps,
        decision.target.repSeconds,
        // Read now, not when the decision was taken: the settle delay must not
        // push the beat back.
        leadSecondsAt(decision.launchAt, Date.now()),
      );
      setPacePlan((current) => planWithoutSet(current, decision.setId));
    }, decision.delayMs);
    return () => clearTimeout(timer);
  }, [detail, pacePlan, startPace]);

  // Stop rests whose set was deleted with its row or exercise.
  useEffect(() => {
    if (restingSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === restingSetId));
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
  const deloadActive = workout.deloadPercent === 80;
  const canDeload = exercises.some((line) =>
    (() => {
      return (
        isDeloadEligibleMeasurement(workoutExerciseIdentityOf(line).measurementType) &&
        line.sets.some(
          (set, index) =>
            set.isCompleted === 0 &&
            (set.weight ?? set.targetWeight ?? line.previous[index]?.weight) !== undefined,
        )
      );
    })(),
  );
  const places = supersetPlaces(exercises.map(({ row }) => row));
  const plans = restPlans(exercises.map(({ row }) => row));
  const coachByExercise = new Map(
    (pendingCoach ?? []).map((row) => [row.exerciseId, row] as const),
  );

  // Warm-ups, supersets, and chained drop sets do not trigger a rest.
  const startRest = (line: WorkoutExerciseDetail, setId: string, setType: SetType): void => {
    const plan = plans.get(line.row.id);
    if (plan === undefined) return;
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

  const records = workoutRecordNotices(recordEntries ?? []);

  const totalSets = exercises.reduce((count, line) => count + line.sets.length, 0);
  const completedSets = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );

  const lineOf = (rowId: string): WorkoutExerciseDetail | null =>
    exercises.find((line) => line.row.id === rowId) ?? null;

  const warmupContextOf = (rowId: string) => {
    const line = lineOf(rowId);
    return line === null ? null : warmupContextFor(line);
  };

  const warmupLine = sheet?.kind === 'warmup' ? lineOf(sheet.rowId) : null;
  const warmupContext = warmupLine === null ? null : warmupContextFor(warmupLine);

  const nameOf = (rowId: string): string => {
    const line = lineOf(rowId);
    return line === null
      ? t('workout.deletedExercise')
      : (workoutExerciseIdentityOf(line).name ?? t('workout.deletedExercise'));
  };

  // Sheets outlive deleted rows during their closing animation.
  const setOf = (setId: string): WorkoutSet | undefined => {
    for (const line of exercises) {
      const found = line.sets.find((set) => set.id === setId);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const typeOf = (setId: string): SetType => setOf(setId)?.setType ?? 'normal';

  // Preserve ordered distinct loads, including warm-ups and back-off sets.
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

  const exerciseMenuLine = sheet?.kind === 'exercise' ? lineOf(sheet.rowId) : null;
  const exerciseMenuOpenedAt = sheet?.kind === 'exercise' ? sheet.openedAt : workout.startedAt;
  const exerciseMenuPaceRunning =
    sheet?.kind === 'exercise' && pacer.rowId === sheet.rowId && pacer.setId !== null;
  const exerciseMenuPace =
    exerciseMenuLine === null
      ? null
      : exerciseMenuPaceRunning
        ? { reps: pacer.reps, repSeconds: pacer.repSeconds }
        : nextPaceTarget(exerciseMenuLine.sets, exerciseMenuOpenedAt - workout.startedAt);

  const startPaceFor = (line: WorkoutExerciseDetail, now: number, afterSetId?: string): boolean => {
    // Read at the tap, never at render: the tempo is a function of how long
    // the session has been running.
    const preparation = prepareNextPace(line.sets, now - workout.startedAt, afterSetId);
    if (preparation.kind === 'done') return false;
    primeAnnouncer();
    // Starting the next set is the clearest possible signal that rest is over.
    // Keeping both clocks alive hides the pace reading and lets the rest
    // countdown speak over the repetition beats.
    rest.stop();
    if (preparation.kind === 'missing-reps') {
      setPacePlan({
        kind: 'awaiting-reps',
        rowId: line.row.id,
        setId: preparation.setId,
        afterSetId,
      });
      announce('pace-reps-missing');
      return true;
    }
    // An explicit launch supersedes whatever was being prepared: replacing the
    // single plan is what keeps a delayed launch from restarting a cadence the
    // user has just stopped.
    setPacePlan(IDLE_PACE_PLAN);
    const target = preparation.target;
    startPace(line.row.id, target.setId, target.reps, target.repSeconds);
    return true;
  };

  const startFollowingExercisePace = (
    completedLine: WorkoutExerciseDetail,
    now: number,
  ): boolean => {
    const following = prepareFollowingExercisePace(
      exercises.map((line) => ({ rowId: line.row.id, sets: line.sets })),
      completedLine.row.id,
      now - workout.startedAt,
    );
    if (following === null) return false;

    primeAnnouncer();
    rest.stop();
    if (following.preparation.kind === 'missing-reps') {
      setPacePlan({
        kind: 'awaiting-reps',
        rowId: following.rowId,
        setId: following.preparation.setId,
      });
      announce('pace-reps-missing');
      return true;
    }

    const target = following.preparation.target;
    setPacePlan(IDLE_PACE_PLAN);
    // A new exercise needs its own preparation window. The rest has just
    // finished; this is a fresh “dans dix secondes”, followed by 3–2–1.
    announce('pace-start-10');
    startPace(following.rowId, target.setId, target.reps, target.repSeconds, 10);
    return true;
  };

  const armPaceFromTypedReps = (
    line: WorkoutExerciseDetail,
    setId: string,
    values: Partial<Parameters<typeof updateSetValues>[1]>,
  ): void => {
    if (values.reps === undefined || values.reps <= 0) return;
    const nextWorkingSet = line.sets.find(
      (set) => set.deletedAt === 0 && set.setType !== 'warmup' && set.isCompleted === 0,
    );
    if (
      nextWorkingSet?.id !== setId ||
      pacer.setId !== null ||
      rest.setId !== null ||
      pacePlan.kind !== 'idle' ||
      armedTypedSets.current.has(setId)
    ) {
      return;
    }

    armedTypedSets.current.add(setId);
    primeAnnouncer();
    announce('pace-start-10');
    // The first digit deliberately starts the ten-second preparation, while
    // the effect above waits for the complete cell value before fixing the
    // cadence target (for example 10, not the transient 1).
    setPacePlan({
      kind: 'arming',
      rowId: line.row.id,
      setId,
      launchAt: launchAfter(PACE_LEAD_SECONDS * 1_000),
    });
  };

  return (
    <Screen
      title={workout.name === '' ? t('workout.emptyName') : workout.name}
      onBack={() => void navigate('/')}
      action={
        <div className="flex items-center gap-2">
          <ElapsedTime
            startedAt={workout.startedAt}
            className="text-base font-semibold text-[var(--text-2)]"
            label={(time) => t('workout.elapsedLabel', { time })}
          />
          <HeaderAction
            label={t('workout.workoutMenu')}
            onClick={() => setSheet({ kind: 'workout' })}
          >
            <MoreIcon />
          </HeaderAction>
        </div>
      }
      sub={
        exercises.length > 0 ? (
          <div className="flex min-h-12 items-center border-b border-[var(--border)] pl-4">
            <p className="label-xs min-w-0 flex-1 truncate font-semibold text-[var(--text-2)]">
              {workoutProgressLine(completedSets, totalSets)}
            </p>
            <Toggle
              label={t(deloadActive ? 'workout.deloadActive' : 'workout.deloadAction')}
              mark={t('workout.deloadMark')}
              checked={deloadActive}
              disabled={deloadActive || !canDeload}
              onChange={() => setSheet({ kind: 'deload' })}
            />
            <OrderLockButton unlocked={reorderUnlocked} onToggle={() => toggleReorder('workout')} />
            <button
              type="button"
              aria-label={t(willExpandAll ? 'workout.expandAll' : 'workout.collapseAll')}
              onClick={() => setFoldCommand(nextWorkoutFoldCommand)}
              className="flex size-12 shrink-0 items-center justify-center text-[var(--text-2)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              {willExpandAll ? <ExpandAllIcon /> : <CollapseAllIcon />}
            </button>
          </div>
        ) : undefined
      }
      footer={
        <ActionBand label={t('workout.finish')} onClick={() => void navigate('/workout/finish')} />
      }
    >
      <div className="flex flex-col gap-2">
        {workout.programId !== undefined && workout.programWeekIndex !== undefined && (
          <Card padded>
            <div className="flex min-h-12 items-center justify-between gap-3">
              <p className="label-xs font-semibold text-[var(--text-2)]">
                {t('workout.programContext', { week: workout.programWeekIndex + 1 })}
              </p>
              {workout.programIsDeload === 1 && (
                <p className="text-sm font-semibold text-[var(--accent-ink)]">
                  {t('workout.programDeload')}
                </p>
              )}
            </div>
          </Card>
        )}
        {exercises.length === 0 ? (
          <EmptyState reading="0" unit={t('routine.emptyUnit')} body={t('workout.emptyBody')} />
        ) : (
          <>
            <ReorderableList
              className="flex flex-col gap-3"
              items={exercises}
              keyOf={(line) => line.row.id}
              disabled={!reorderUnlocked}
              onReorder={(from, to) => void reorderWorkoutExercises(workout.id, from, to)}
              renderItem={(line, _index, state) => {
                const config = line.exercise !== undefined ? platesConfigFor(line.exercise) : null;
                const loads = config !== null ? exerciseLoads(line) : [];
                return (
                  <WorkoutExerciseCard
                    line={line}
                    superset={places.get(line.row.id)}
                    pace={
                      pacer.setId !== null && pacer.rowId === line.row.id
                        ? { ...pacer, setId: pacer.setId, onFinished: () => stopPace() }
                        : null
                    }
                    onStopPace={
                      pacer.rowId === line.row.id && pacer.setId !== null
                        ? () => stopPace()
                        : undefined
                    }
                    rest={
                      rest.setId !== null && line.sets.some((set) => set.id === rest.setId)
                        ? {
                            setId: rest.setId,
                            startedAt: rest.startedAt,
                            endsAt: rest.endsAt,
                            onDone: () => {
                              // The rest's 3–2–1 is the preparation: at zero,
                              // its next working set owns the audio clock.
                              const paced = startPaceFor(line, Date.now(), rest.setId ?? undefined);
                              if (paced) return true;
                              const advanced = startFollowingExercisePace(line, Date.now());
                              if (!advanced) rest.stop();
                              return advanced;
                            },
                          }
                        : null
                    }
                    effort={
                      effortSetId !== null && line.sets.some((set) => set.id === effortSetId)
                        ? {
                            setId: effortSetId,
                            onExpire: () =>
                              setEffortSetId((current) =>
                                current === effortSetId ? null : current,
                              ),
                            onAnswer: (rpe) => {
                              void updateSetValues(effortSetId, { rpe });
                              const bonus = restBonusSecondsFor(rpe);
                              // Only when the rest being extended is this set’s:
                              // a superset round and a set followed by a drop
                              // set start none, and announcing a bonus nothing
                              // is counting down is the announcer crying wolf.
                              if (bonus > 0 && useRestTimer.getState().setId === effortSetId) {
                                extendRest(effortSetId, bonus);
                                announce('rest-extended');
                              }
                              setEffortSetId(null);
                            },
                          }
                        : null
                    }
                    records={records}
                    state={state}
                    reorderEnabled={reorderUnlocked}
                    foldCommand={foldCommand}
                    onMenu={() =>
                      setSheet({ kind: 'exercise', rowId: line.row.id, openedAt: Date.now() })
                    }
                    onPlates={
                      config !== null && loads.length > 0
                        ? () => {
                            setPlatesView({
                              rowId: line.row.id,
                              loads,
                              barWeight: plateBarWeights[line.row.id] ?? config.barWeight,
                              sides: config.sides,
                              barWeightAdjustable: config.barWeightAdjustable,
                            });
                            setSheet({ kind: 'plates' });
                          }
                        : undefined
                    }
                    onSetMenu={(set, number) => setSheet({ kind: 'set', setId: set.id, number })}
                    onWrite={(setId, values) => {
                      void updateSetValues(setId, values);
                      armPaceFromTypedReps(line, setId, values);
                    }}
                    onComplete={(setId, values, set) => {
                      void completeSet(setId, values);
                      // The metronome paced this set; the set is over.
                      stopPace(setId);
                      startRest(line, setId, set.setType);
                      announce(setValidationCue(line.sets, setId));
                      // A warm-up is not an effort to report, and one strip at a
                      // time: the previous question dies with the set that
                      // replaces it rather than stacking up down the card.
                      setEffortSetId(set.setType !== 'warmup' && loadEffortPrompt() ? setId : null);
                    }}
                    onUncomplete={(setId) => {
                      void uncompleteSet(setId);
                      setEffortSetId((current) => (current === setId ? null : current));
                      // Only stop the rest owned by this set.
                      stopRest(setId);
                    }}
                    onDeleteSet={(setId) => void deleteSet(setId)}
                    onRestoreSet={(setId) => void restoreSet(setId)}
                    onAddSet={() => void duplicateLastSet(line.row.id)}
                    coachObjective={coachByExercise.get(line.row.exerciseId)}
                    onDismissCoach={
                      coachByExercise.get(line.row.exerciseId) === undefined
                        ? undefined
                        : () =>
                            void dismissRecommendation(coachByExercise.get(line.row.exerciseId)!.id)
                    }
                    onApplyCoach={
                      // Left undefined without a load: an observation has nothing
                      // to write, and a dead tap target is worse than none.
                      coachByExercise.get(line.row.exerciseId)?.nextLoadKg === undefined
                        ? undefined
                        : () => {
                            const objective = coachByExercise.get(line.row.exerciseId)!;
                            // Applying *is* accepting: the card closes on the spot
                            // because it leaves `pending`, not by a local flag a
                            // remount would forget.
                            void applyCoachObjective(line.row.id, objective.nextLoadKg!).then(() =>
                              markRecommendationFollowed(objective.id, {
                                workoutId: workout.id,
                                loadKg: objective.nextLoadKg,
                              }),
                            );
                          }
                    }
                  />
                );
              }}
            />
          </>
        )}

        <Card>
          <AddRow label={t('workout.addExercise')} onClick={() => void navigate('/workout/add')} />
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

      <DeloadSheet
        open={sheet?.kind === 'deload'}
        onClose={() => setSheet(null)}
        onApply={async () => {
          const updated = await applyWorkoutDeload(workout.id, t('workout.deloadNote'));
          if (updated !== null) {
            setDraft({ id: updated.id, name: updated.name, notes: updated.notes ?? '' });
          }
        }}
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
          ...(exerciseMenuPace === null
            ? []
            : [
                {
                  label: t(exerciseMenuPaceRunning ? 'workout.paceStop' : 'workout.pace'),
                  hint: t('workout.paceHint', {
                    reps: exerciseMenuPace.reps,
                    tempo: formatNumber(exerciseMenuPace.repSeconds),
                  }),
                  onSelect: () => {
                    if (exerciseMenuPaceRunning) {
                      stopPace();
                    } else if (exerciseMenuLine !== null) {
                      startPaceFor(exerciseMenuLine, Date.now());
                    }
                  },
                },
              ]),
          {
            label: t('workout.addSetAction'),
            onSelect: () => {
              if (sheet?.kind === 'exercise') void duplicateLastSet(sheet.rowId);
            },
          },
          ...(sheet?.kind === 'exercise' && warmupContextOf(sheet.rowId) !== null
            ? [
                {
                  label: t('workout.warmupAction'),
                  onSelect: () => {
                    if (sheet?.kind === 'exercise') {
                      setSheet({ kind: 'warmup', rowId: sheet.rowId });
                    }
                  },
                },
              ]
            : []),
          {
            label: t('workout.notesLabel'),
            onSelect: () => {
              if (sheet?.kind === 'exercise')
                setSheet({ kind: 'exerciseNotes', rowId: sheet.rowId });
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

      <WarmupSheet
        open={sheet?.kind === 'warmup' && warmupContext !== null}
        onClose={() => setSheet(null)}
        initialTargetWeightKg={warmupContext?.targetWeightKg}
        minimumWeightKg={warmupContext?.minimumWeightKg ?? 0}
        onInsert={async (suggestions) => {
          if (sheet?.kind !== 'warmup') return;
          await insertWarmupSets(sheet.rowId, suggestions);
        }}
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
            targetValue={setOf(sheet.setId)?.targetRpe}
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
        barWeightAdjustable={platesView?.barWeightAdjustable ?? false}
        availablePlateWeightsKg={availablePlateWeightsKg ?? [...DEFAULT_PLATES_KG]}
        onAvailablePlateWeightsChange={async (weights) => {
          await setAvailablePlateWeightsKg(weights);
        }}
        onBarWeightChange={(barWeight) => {
          if (platesView === null) return;
          setPlateBarWeights((current) => ({ ...current, [platesView.rowId]: barWeight }));
          setPlatesView({ ...platesView, barWeight });
        }}
      />
    </Screen>
  );
}

/** Keeps the notes draft keyed to its workout-exercise row. */
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
