import { useEffect, useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  applyWorkoutDeload,
  completeFirstSide,
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
  getDefaultRepSeconds,
  setAvailablePlateWeightsKg,
  setDefaultRepSeconds,
} from '@/data/repositories/settings';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { applyCoachObjective } from '@/data/repositories/coachApply';
import {
  dismissRecommendation,
  listPendingRecommendations,
  markRecommendationFollowed,
} from '@/data/repositories/coachRecommendations';
import { listRecordsForWorkout } from '@/data/repositories/personalRecords';
import { updateExercise } from '@/data/repositories/exercises';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { SET_TYPES } from '@/data/types';
import type { PlateLoading, SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { formatNumber } from '@/ui/numberField';
import { setTypeHint, setTypeLabel } from '@/i18n/labels';
import { DELOAD_PERCENT, isDeloadEligibleMeasurement } from '@/lib/deload';
import { platesConfigFor } from '@/lib/plateLoading';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { isRestTriggering, restPlans } from '@/lib/rest';
import { sideStageFor } from './sideProgress';
import { supersetPlaces } from '@/lib/routineOrder';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { loadEffortPrompt } from '@/stores/effortPrompt';
import { useHoldTimer } from '@/stores/holdTimer';
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
import { PaceSheet } from './PaceSheet';
import { PlateLoadSheet } from './PlateLoadSheet';
import { announce } from '@/audio/announce';
import { restBonusSecondsFor } from '@/lib/restBonus';
import { ExerciseNotesSheet } from './ExerciseNotesSheet';
import { setValidationCue } from './workoutCues';
import { heldSecondsAt } from './holdDuration';
import { useWorkoutAnnouncements } from './useWorkoutAnnouncements';
import { useWorkoutPace } from './useWorkoutPace';
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
  | { kind: 'pace'; rowId: string }
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
  exerciseId: string;
  loads: number[];
  barWeight: number;
  sides: number;
  loading: Exclude<PlateLoading, 'none'>;
};

/** A stable empty list, so the pace hook's effect does not re-run on every render. */
const EMPTY_LINES: WorkoutExerciseDetail[] = [];

/** Live workout backed entirely by the persisted active-workout query. */
export function WorkoutScreen() {
  const navigate = useAppNavigate();
  const tutorial = useTutorialControls();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const reorderUnlocked = useExerciseOrderLock((state) => state.unlocked.workout);
  const toggleReorder = useExerciseOrderLock((state) => state.toggle);
  const [platesView, setPlatesView] = useState<PlatesView | null>(null);
  /** The one set currently being asked how hard it was. */
  const [effortSetId, setEffortSetId] = useState<string | null>(null);
  const [foldCommand, setFoldCommand] = useState(INITIAL_WORKOUT_FOLD_COMMAND);
  const willExpandAll = !foldCommand.expanded;
  const rest = useRestTimer();

  // Keep loading (`undefined`) distinct from no active workout (`null`).
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );
  const availablePlateWeightsKg = useLiveQuery(getAvailablePlateWeightsKg);
  const defaultRepSeconds = useLiveQuery(getDefaultRepSeconds);

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

  useWorkoutAnnouncements({ workoutId, openedSets, availableSets, recordEntries });

  const stopRest = useRestTimer((state) => state.stop);
  const extendRest = useRestTimer((state) => state.extend);
  const restingSetId = rest.setId;
  const pacer = useRepPacer();
  const hold = useHoldTimer();
  const stopHold = useHoldTimer((state) => state.stop);
  const holdSetId = hold.setId;
  const pace = useWorkoutPace(detail?.exercises ?? EMPTY_LINES, defaultRepSeconds);

  /**
   * Fin du premier côté — le seul chemin, qu'on y arrive par la coche ou par la
   * cadence qui s'achève d'elle-même.
   *
   * **Rien de durable n'en découle** : ni validation, ni repos, ni RPE, ni
   * record. La série n'est pas finie, elle est à moitié faite, et l'écrire
   * autrement enregistrerait une demi-série comme une série entière.
   *
   * L'annonce et la reprise du tempo n'ont lieu que sur `started` : un second
   * appui pendant la transition répond `existing`, et réannoncer « changement
   * de côté » à ce moment-là dirait deux fois une chose qui n'est arrivée
   * qu'une.
   */
  const finishFirstSide = (line: WorkoutExerciseDetail, setId: string): void => {
    void completeFirstSide(setId)
      .then((result) => {
        if (result.kind !== 'started') return;
        announce('side-change');
        tutorial?.report({ type: 'workout-side-turned', setId });
        pace.startSecondSide(line, setId, result.startsAt);
      })
      .catch(() => undefined);
  };

  /** Le stade de cette série, ou `null` si elle n'est pas unilatérale. */
  const stageOf = (line: WorkoutExerciseDetail, set: WorkoutSet) =>
    sideStageFor(set, workoutExerciseIdentityOf(line).isUnilateral === 1);

  // Stop rests whose set was deleted with its row or exercise.
  useEffect(() => {
    if (restingSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === restingSetId));
    if (!alive) stopRest(restingSetId);
  }, [restingSetId, detail, stopRest]);

  // Même raison que pour le repos : un chrono qui suit un set supprimé avec sa
  // ligne ou son exercice ne s'arrêterait jamais tout seul.
  useEffect(() => {
    if (holdSetId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === holdSetId));
    if (!alive) stopHold(holdSetId);
  }, [holdSetId, detail, stopHold]);

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
  const deloadActive = workout.deloadPercent === DELOAD_PERCENT;
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

  const paceSheetLine = sheet?.kind === 'pace' ? lineOf(sheet.rowId) : null;

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
              tutorialId="workout-deload"
              onChange={() => {
                setSheet({ kind: 'deload' });
                tutorial?.report({ type: 'deload-sheet-opened', workoutId: workout.id });
              }}
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
        <ActionBand
          label={t('workout.finish')}
          tutorialId="workout-finish"
          onClick={() => {
            tutorial?.report({ type: 'workout-finish-opened', workoutId: workout.id });
            void navigate('/workout/finish');
          }}
        />
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
              renderItem={(line, index, state) => {
                const config = line.exercise !== undefined ? platesConfigFor(line.exercise) : null;
                const loads = config !== null ? exerciseLoads(line) : [];
                const activeRestSetId =
                  rest.setId !== null && line.sets.some((set) => set.id === rest.setId)
                    ? rest.setId
                    : null;
                return (
                  <WorkoutExerciseCard
                    line={line}
                    tutorial={index === 0}
                    superset={places.get(line.row.id)}
                    pace={
                      pacer.setId !== null && pacer.rowId === line.row.id
                        ? {
                            ...pacer,
                            setId: pacer.setId,
                            // La fin d'un côté n'est pas la fin de la série : sur
                            // le premier, la cadence repart d'elle-même après
                            // dix secondes, sur la même série.
                            onFinished: () => {
                              const setId = pacer.setId;
                              const set =
                                setId === null
                                  ? undefined
                                  : line.sets.find((candidate) => candidate.id === setId);
                              if (
                                setId !== null &&
                                set !== undefined &&
                                stageOf(line, set) === 'first'
                              ) {
                                finishFirstSide(line, setId);
                                return;
                              }
                              pace.stop();
                            },
                          }
                        : null
                    }
                    sideStageOf={pace.sideStageOf}
                    hold={
                      hold.setId !== null && hold.rowId === line.row.id
                        ? { ...hold, setId: hold.setId }
                        : null
                    }
                    onStopPace={
                      (pacer.rowId === line.row.id && pacer.setId !== null) ||
                      (hold.rowId === line.row.id && hold.setId !== null)
                        ? () => {
                            const stopping = pacer.setId;
                            pace.stop();
                            tutorial?.report({ type: 'pace-stopped', setId: stopping });
                          }
                        : undefined
                    }
                    rest={
                      activeRestSetId !== null
                        ? {
                            setId: activeRestSetId,
                            startedAt: rest.startedAt,
                            endsAt: rest.endsAt,
                            audioSuppressed: effortSetId === activeRestSetId,
                            onDone: (audioAllowed) => {
                              tutorial?.report({
                                type: 'rest-finished',
                                setId: activeRestSetId,
                              });
                              // The wall clock is authoritative even while the
                              // effort strip is open. At its deadline the rest
                              // still ends, but the unanswered RPE must not
                              // start a cadence behind the user's question.
                              if (!audioAllowed) {
                                rest.stop(activeRestSetId);
                                return false;
                              }
                              // The rest's 3–2–1 is the preparation: at zero,
                              // its next working set owns the audio clock.
                              const paced = pace.startFor(line, activeRestSetId);
                              if (paced) return true;
                              const advanced = pace.startFollowing(line);
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
                              tutorial?.report({
                                type: 'workout-rpe-updated',
                                setId: effortSetId,
                                rpe,
                              });
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
                    onMenu={() => {
                      setSheet({ kind: 'exercise', rowId: line.row.id, openedAt: Date.now() });
                      tutorial?.report({
                        type: 'workout-exercise-menu-opened',
                        rowId: line.row.id,
                      });
                    }}
                    onPace={() => {
                      setSheet({ kind: 'pace', rowId: line.row.id });
                      tutorial?.report({ type: 'pace-sheet-opened', rowId: line.row.id });
                    }}
                    onPlates={
                      config !== null && loads.length > 0
                        ? () => {
                            setPlatesView({
                              rowId: line.row.id,
                              exerciseId: line.row.exerciseId,
                              loads,
                              // Straight from the exercise: the bar weight is
                              // stored on it now, so a 15 kg bar typed once is
                              // still 15 kg at the next session.
                              barWeight: config.barWeight,
                              sides: config.sides,
                              loading: config.loading,
                            });
                            setSheet({ kind: 'plates' });
                            tutorial?.report({ type: 'plate-sheet-opened', rowId: line.row.id });
                          }
                        : undefined
                    }
                    onSetMenu={(set, number) => {
                      setSheet({ kind: 'set', setId: set.id, number });
                      tutorial?.report({ type: 'workout-set-menu-opened', setId: set.id });
                    }}
                    onWrite={(setId, values, recordable) => {
                      void updateSetValues(setId, values)
                        .then(() => {
                          tutorial?.report({
                            type: 'workout-set-written',
                            workoutId: workout.id,
                            setId,
                            recordable,
                          });
                        })
                        .catch(() => undefined);
                      pace.armFromTypedReps(line, setId, values.reps);
                    }}
                    onComplete={(setId, values, set) => {
                      /*
                       * Sur une ligne unilatérale, la première coche finit le
                       * côté et non la série. Le stade est lu dans la série
                       * elle-même : il survit ainsi à un écran éteint, à un
                       * appel et à un kill — un cycle en mémoire renvoyait au
                       * premier côté quelqu'un qui venait de finir les deux.
                       *
                       * Pendant la transition, le bouton est déjà désactivé ;
                       * la garde reste parce qu'une coche peut arriver par un
                       * autre chemin que le doigt.
                       */
                      const stage = stageOf(line, set);
                      if (stage === 'transition') return;
                      if (stage === 'first') {
                        finishFirstSide(line, setId);
                        return;
                      }
                      // Le chrono est ce qui sait combien de temps a été tenu, et
                      // la coche est le geste qui l'arrête : c'est donc elle qui
                      // écrit la durée. Tant qu'il tourne, la saisie manuelle des
                      // secondes n'a plus lieu d'être.
                      const held =
                        hold.setId === setId
                          ? heldSecondsAt(hold.startedAt, Date.now())
                          : undefined;
                      const written =
                        held === undefined ? values : { ...values, durationSeconds: held };
                      void completeSet(setId, written)
                        .then(() => {
                          tutorial?.report({
                            type: 'workout-set-completed',
                            workoutId: workout.id,
                            setId,
                          });
                        })
                        .catch(() => undefined);
                      // The metronome or the chronometer owned this set; it is over.
                      pace.stop(setId);
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
                    onAddSet={() =>
                      void duplicateLastSet(line.row.id)
                        .then(() =>
                          tutorial?.report({ type: 'workout-set-added', rowId: line.row.id }),
                        )
                        .catch(() => undefined)
                    }
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
                        : async () => {
                            const objective = coachByExercise.get(line.row.exerciseId)!;
                            // Applying *is* accepting: the card closes on the spot
                            // because it leaves `pending`, not by a local flag a
                            // remount would forget.
                            await applyCoachObjective(line.row.id, objective.nextLoadKg!);
                            await markRecommendationFollowed(objective.id, {
                              workoutId: workout.id,
                              loadKg: objective.nextLoadKg,
                            });
                          }
                    }
                  />
                );
              }}
            />
          </>
        )}

        <Card>
          <AddRow
            label={t('workout.addExercise')}
            tutorialId="workout-add-exercise"
            onClick={() => {
              tutorial?.report({ type: 'workout-exercise-picker-opened' });
              void navigate('/workout/add');
            }}
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
          {
            label: t('workout.paceTitle'),
            // The tempo in force, so the entry says what it is about to open
            // rather than making you open it to find out.
            hint:
              sheet?.kind === 'exercise' && lineOf(sheet.rowId) !== null
                ? t('workout.paceMenuHint', {
                    tempo: formatNumber(pace.repSecondsOf(lineOf(sheet.rowId)!)),
                  })
                : undefined,
            onSelect: () => {
              if (sheet?.kind !== 'exercise') return;
              setSheet({ kind: 'pace', rowId: sheet.rowId });
              tutorial?.report({ type: 'pace-sheet-opened', rowId: sheet.rowId });
            },
          },
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
                  tutorialId: 'workout-warmup',
                  onSelect: () => {
                    if (sheet?.kind !== 'exercise') return;
                    setSheet({ kind: 'warmup', rowId: sheet.rowId });
                    tutorial?.report({ type: 'warmup-sheet-opened', rowId: sheet.rowId });
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
          const rowId = sheet.rowId;
          await insertWarmupSets(rowId, suggestions);
          // Après l'écriture, et avec le compte : une feuille vidée de ses
          // étapes insère zéro série, ce qui n'est pas insérer.
          tutorial?.report({ type: 'warmup-inserted', rowId, count: suggestions.length });
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
            tutorialId: 'workout-set-type',
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
          if (sheet?.kind !== 'setType') return;
          const setId = sheet.setId;
          void updateSetType(setId, setType)
            .then(() => tutorial?.report({ type: 'workout-set-type-updated', setId, setType }))
            .catch(() => undefined);
        }}
      />

      <PaceSheet
        open={sheet?.kind === 'pace'}
        onClose={() => setSheet(null)}
        view={pace.viewFor(
          paceSheetLine,
          paceSheetLine === null ? '' : nameOf(paceSheetLine.row.id),
        )}
        onChange={(repSeconds) => {
          if (sheet?.kind === 'pace') void updateWorkoutExercise(sheet.rowId, { repSeconds });
        }}
        onSetDefault={(repSeconds) => void setDefaultRepSeconds(repSeconds)}
        onStart={() => {
          if (paceSheetLine === null) return;
          if (!pace.startFor(paceSheetLine)) return;
          // L'horloge qui vient de partir dit laquelle des deux c'était : le
          // maintien mesure la série, la cadence la rythme, et deux missions
          // différentes les apprennent.
          const startedHold = useHoldTimer.getState().setId;
          const startedPace = useRepPacer.getState().setId;
          if (startedHold !== null) tutorial?.report({ type: 'hold-started', setId: startedHold });
          else if (startedPace !== null) {
            tutorial?.report({ type: 'pace-started', setId: startedPace });
          }
        }}
        onStop={() => {
          const stopping = useRepPacer.getState().setId;
          pace.stop();
          tutorial?.report({ type: 'pace-stopped', setId: stopping });
        }}
      />

      <PlateLoadSheet
        open={sheet?.kind === 'plates'}
        onClose={() => setSheet(null)}
        loads={platesView?.loads ?? []}
        barWeight={platesView?.barWeight ?? 20}
        sides={platesView?.sides ?? 2}
        loading={platesView?.loading ?? 'barbell'}
        availablePlateWeightsKg={availablePlateWeightsKg ?? [...DEFAULT_PLATES_KG]}
        onAvailablePlateWeightsChange={async (weights) => {
          await setAvailablePlateWeightsKg(weights);
          tutorial?.report({ type: 'plate-availability-changed', count: weights.length });
        }}
        onBarWeightChange={(barWeight) => {
          if (platesView === null) return;
          // Shown immediately, written to the exercise straight after: the
          // diagram must not wait for a round trip through Dexie, and the
          // figure must not die with the sheet the way it used to.
          setPlatesView({ ...platesView, barWeight });
          void updateExercise(platesView.exerciseId, { plateBaseWeightKg: barWeight });
        }}
      />
    </Screen>
  );
}
