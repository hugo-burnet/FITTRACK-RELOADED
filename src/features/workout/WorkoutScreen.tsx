import { useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import {
  deleteSet,
  reorderWorkoutExercises,
  restoreSet,
  updateSetValues,
  workoutExerciseIdentityOf,
} from '@/data/repositories/workouts';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import { applyCoachObjective } from '@/data/repositories/coachApply';
import {
  dismissRecommendation,
  markRecommendationFollowed,
} from '@/data/repositories/coachRecommendations';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import { DELOAD_PERCENT, isDeloadEligibleMeasurement } from '@/lib/deload';
import { platesConfigFor } from '@/lib/plateLoading';
import { restPlans } from '@/lib/rest';
import { supersetPlaces } from '@/lib/routineOrder';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import {
  ActionBand,
  AddRow,
  Card,
  EmptyState,
  HeaderAction,
  OrderLockButton,
  ReorderableList,
  Toggle,
} from '@/ui';
import { CollapseAllIcon, ExpandAllIcon, MoreIcon } from '@/ui/icons';
import { ElapsedTime } from './ElapsedTime';
import { announce } from '@/audio/announce';
import { restBonusSecondsFor } from '@/lib/restBonus';
import { useWorkoutPace } from './useWorkoutPace';
import { useWorkoutSetActions } from './useWorkoutSetActions';
import { useActiveWorkout } from './useActiveWorkout';
import { workoutExerciseLoads } from './workoutLookups';
import { WorkoutExerciseCard, workoutRecordNotices } from './WorkoutExerciseCard';
import { INITIAL_WORKOUT_FOLD_COMMAND, nextWorkoutFoldCommand } from './workoutFold';
import { workoutProgressLine } from './summary';
import { WorkoutSheets } from './WorkoutSheets';
import type { PlatesView, SheetState } from './WorkoutSheets';

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

  const {
    active,
    detail,
    workoutId,
    availablePlateWeightsKg,
    defaultRepSeconds,
    recordEntries,
    pendingCoach,
    draft,
    setDraft,
  } = useActiveWorkout();

  const extendRest = useRestTimer((state) => state.extend);
  const pacer = useRepPacer();
  const hold = useHoldTimer();
  const pace = useWorkoutPace(detail?.exercises ?? EMPTY_LINES, defaultRepSeconds);

  /*
   * Les repos et les gestes sur une série sont calculés **avant** les retours
   * anticipés, sur une liste vide tant que la séance charge.
   *
   * `useWorkoutSetActions` est un hook : le placer après le `return` de l'écran
   * de chargement le sautait un rendu sur deux, ce que React interdit. Rien
   * n'est perdu à le monter tôt — aucun de ses gestes ne peut partir avant que
   * la première carte soit à l'écran.
   */
  const plans = restPlans((detail?.exercises ?? EMPTY_LINES).map(({ row }) => row));
  const { onWrite, onComplete, onUncomplete, onAddSet, onPaceFinished } = useWorkoutSetActions({
    workoutId,
    plans,
    pace,
    setEffortSetId,
  });

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
  const coachByExercise = new Map(
    (pendingCoach ?? []).map((row) => [row.exerciseId, row] as const),
  );

  const records = workoutRecordNotices(recordEntries ?? []);

  const totalSets = exercises.reduce((count, line) => count + line.sets.length, 0);
  const completedSets = exercises.reduce(
    (count, line) => count + line.sets.filter((set) => set.isCompleted === 1).length,
    0,
  );

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
                const loads = config !== null ? workoutExerciseLoads(line) : [];
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
                            // La fin d'un côté n'est pas la fin de la série : sur
                            // le premier, la cadence repart d'elle-même après
                            // dix secondes, sur la même série.
                            onFinished: () => onPaceFinished(line, pacer.setId),
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
                    onWrite={(setId, values, recordable) => onWrite(line, setId, values, recordable)}
                    onComplete={(setId, values, set) => onComplete(line, setId, values, set)}
                    onUncomplete={onUncomplete}
                    onDeleteSet={(setId) => void deleteSet(setId)}
                    onRestoreSet={(setId) => void restoreSet(setId)}
                    onAddSet={() => onAddSet(line.row.id)}
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

      <WorkoutSheets
        sheet={sheet}
        setSheet={setSheet}
        workout={workout}
        exercises={exercises}
        draft={draft}
        setDraft={setDraft}
        pace={pace}
        platesView={platesView}
        setPlatesView={setPlatesView}
        availablePlateWeightsKg={availablePlateWeightsKg}
      />
    </Screen>
  );
}
