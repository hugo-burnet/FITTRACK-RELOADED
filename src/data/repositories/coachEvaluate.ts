import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  evaluatePerformance,
  mergeLinesForWorkout,
  pickSignals,
  selectProgramAction,
  type CoachAction,
  type CoachExerciseLine,
  type CoachSignal,
  type ProgramCoachContext,
} from '@/lib/coach';
import { coachLineFromSource } from '@/lib/coach/fromWorkout';
import {
  pickProgramSession,
  programPosition,
  resolveSchedule,
} from '@/lib/programs';
import { alive } from './base';
import { recordCoachSignals, reconcileFollowedLoads } from './coachRecommendations';
import { getOneRepMaxFormula } from './settings';
import { getWorkoutDetail, workoutExerciseIdentityOf } from './workoutDetail';

function cloneSignal(signal: CoachSignal): CoachSignal {
  return {
    ...signal,
    evidence: signal.evidence.map((item) => ({ ...item })),
  };
}

function stripLoadProposal(signal: CoachSignal): CoachSignal {
  const rest = { ...signal };
  delete rest.nextLoadKg;
  return {
    ...rest,
    evidence: signal.evidence
      .filter(
        (item) => item.label !== 'next_load_kg' && item.label !== 'current_load_kg',
      )
      .map((item) => ({ ...item })),
  };
}

/**
 * Machine flags the UI localises (coachCopy). Value `1` = present.
 * Kept as evidence so stored recommendations re-read correctly without
 * re-resolving the target week.
 */
const FLAG_PROGRESSION_DEFERRED = 'progression_deferred';
const FLAG_CONTROLLED_ATTEMPT = 'controlled_attempt';
const FLAG_ADD_SET = 'add_set';

function withPhaseCopyFlags(
  signal: CoachSignal,
  selected: CoachAction,
  target: ProgramCoachContext | undefined,
): CoachSignal {
  const phase = target?.phase;
  const flags: { label: string; value: number }[] = [];

  // Progression chose maintain because no increase_* was authorized (or ranked).
  // range_missed is a back-off story, not a deferred progression.
  // Never stamp on plateau: that row must stay « Plateau détecté » (spec §5.2).
  if (
    phase === 'progression' &&
    selected === 'maintain' &&
    signal.code !== 'range_missed' &&
    signal.code !== 'plateau'
  ) {
    flags.push({ label: FLAG_PROGRESSION_DEFERRED, value: 1 });
  }

  // Test does not invent permissions: it requalifies an authorized increase_*.
  if (phase === 'test' && (selected === 'increase_load' || selected === 'increase_reps')) {
    flags.push({ label: FLAG_CONTROLLED_ATTEMPT, value: 1 });
  }

  // Overload chose volume: the ceiling card must say add a set, not go silent.
  if (
    selected === 'add_set' &&
    (signal.code === 'range_ceiling_reached' || signal.code === 'range_completed')
  ) {
    flags.push({ label: FLAG_ADD_SET, value: 1 });
  }

  if (flags.length === 0) return signal;
  return {
    ...signal,
    evidence: [...signal.evidence, ...flags],
  };
}

/**
 * Phase ranking chooses among escalations; it does not invent permissions.
 * - `increase_load` proposals (`range_ceiling_reached.nextLoadKg`) stay only
 *   when the selected action is `increase_load` (so overload→add_set and
 *   deload→maintain never push a heavier bar).
 * - `reduce_load` proposals stay: RANK does not list them, but the engine still
 *   authorizes back-off and the finish screen must surface the figure.
 * - Phase copy flags (progression deferred / controlled attempt / add_set) are stamped here.
 */
function shapeSignalsForSelectedAction(
  signals: readonly CoachSignal[],
  selected: CoachAction,
  target: ProgramCoachContext | undefined,
): CoachSignal[] {
  return signals.map((signal) => {
    let shaped: CoachSignal;
    if (signal.nextLoadKg === undefined) {
      shaped = cloneSignal(signal);
    } else if (signal.code === 'range_missed') {
      shaped = cloneSignal(signal);
    } else if (selected === 'increase_load') {
      shaped = cloneSignal(signal);
    } else {
      shaped = stripLoadProposal(signal);
    }
    return withPhaseCopyFlags(shaped, selected, target);
  });
}

function contextFromWeek(
  weeks: readonly { weekIndex: number; phase: ProgramCoachContext['phase']; loadIndex: number }[],
  weekIndex: number,
): ProgramCoachContext | undefined {
  const week = weeks.find((candidate) => candidate.weekIndex === weekIndex);
  if (week === undefined) return undefined;
  return { phase: week.phase, loadIndex: week.loadIndex };
}

/**
 * Resolve the **next** programmed week's intention after the session under
 * review (source snapshot ≠ target week — spec §5.1).
 *
 * Prefer the closed session's `programWeekIndex` + schedule entry: the next
 * unfinished slot that week, else the following week. Falls back to
 * `pickProgramSession` + civil `programPosition` when the session has no
 * schedule snapshot.
 */
export async function resolveTargetProgramContext(
  workout: Pick<
    Workout,
    'id' | 'programId' | 'programWeekIndex' | 'programScheduleEntryId' | 'endedAt' | 'startedAt'
  >,
  at?: number,
): Promise<ProgramCoachContext | undefined> {
  const programId = workout.programId;
  if (programId === undefined) return undefined;

  const program = await db.programs.get(programId);
  if (program === undefined || program.deletedAt !== 0) return undefined;

  const livingWeeks = alive(
    await db.programWeeks.where('programId').equals(programId).toArray(),
  );
  const livingRevisions = alive(
    await db.programScheduleRevisions.where('programId').equals(programId).toArray(),
  );
  const revisionIds = livingRevisions.map((revision) => revision.id);
  const livingEntries =
    revisionIds.length === 0
      ? []
      : alive(await db.programScheduleEntries.where('revisionId').anyOf(revisionIds).toArray());

  // Primary path: remaining *unfinished* slots this week, not split order.
  // Finishing Friday first must not jump to next week while Monday is open.
  if (
    workout.programWeekIndex !== undefined &&
    workout.programScheduleEntryId !== undefined
  ) {
    const weekIndex = workout.programWeekIndex;
    const resolvedEntries = resolveSchedule(livingRevisions, livingEntries, weekIndex);
    const currentEntryId = workout.programScheduleEntryId;
    if (resolvedEntries.some((entry) => entry.id === currentEntryId)) {
      const completedThisWeek = new Set(
        alive(await db.workouts.toArray())
          .filter(
            (row) =>
              row.id !== workout.id &&
              row.status === 'completed' &&
              row.programId === programId &&
              row.programWeekIndex === weekIndex &&
              row.programScheduleEntryId !== undefined &&
              row.programScheduleEntryId !== currentEntryId,
          )
          .map((row) => row.programScheduleEntryId as string),
      );
      const stillOpen = resolvedEntries.some(
        (entry) => entry.id !== currentEntryId && !completedThisWeek.has(entry.id),
      );
      if (stillOpen) return contextFromWeek(livingWeeks, weekIndex);
      const nextWeekIndex = weekIndex + 1;
      if (nextWeekIndex < program.durationWeeks) {
        return contextFromWeek(livingWeeks, nextWeekIndex);
      }
      return undefined;
    }
    // Entry missing from the resolved split — fall through to civil pick.
  }

  // Fallback: civil position + pickProgramSession (legacy rows without entry id).
  const clock =
    at ?? (workout.endedAt > 0 ? workout.endedAt : workout.startedAt);
  const position = programPosition(program.startsAt, program.durationWeeks, clock);
  if (position.phase !== 'active') return undefined;

  const resolvedEntries = resolveSchedule(livingRevisions, livingEntries, position.weekIndex);
  const completedWorkouts = alive(
    await db.workouts.where('status').equals('completed').toArray(),
  );
  const completedEntryIds = new Set(
    completedWorkouts
      .filter(
        (row) =>
          row.programId === programId &&
          row.programWeekIndex === position.weekIndex &&
          row.programScheduleEntryId !== undefined,
      )
      .map((row) => row.programScheduleEntryId as string),
  );

  const candidates = resolvedEntries.map((entry) => ({
    entryId: entry.id,
    routineId: entry.routineId,
    weekIndex: position.weekIndex,
    dayOfWeek: entry.dayOfWeek,
    order: entry.order,
    completed: completedEntryIds.has(entry.id),
  }));

  const picked = pickProgramSession(candidates, position, program.durationWeeks);

  let targetWeekIndex: number | undefined;
  if ('session' in picked) {
    targetWeekIndex = picked.session.weekIndex;
  } else if (picked.kind === 'next_week') {
    targetWeekIndex = picked.weekIndex;
  }

  if (targetWeekIndex === undefined) return undefined;
  return contextFromWeek(livingWeeks, targetWeekIndex);
}

/**
 * Build coach history lines for the given exercise ids (completed sets only).
 * Used at end of session so plateau sees prior workouts.
 */
export async function loadCoachHistoryLines(
  exerciseIds: readonly string[],
  options: { excludeWorkoutId?: string } = {},
): Promise<CoachExerciseLine[]> {
  if (exerciseIds.length === 0) return [];

  const uniqueIds = [...new Set(exerciseIds)];
  const sets = alive(
    await db.workoutSets
      .where('exerciseId')
      .anyOf(uniqueIds)
      .filter((set) => set.isCompleted === 1 && set.performedAt > 0)
      .toArray(),
  ).filter((set) => set.workoutId !== (options.excludeWorkoutId ?? ''));

  if (sets.length === 0) return [];

  const workoutIds = [...new Set(sets.map((set) => set.workoutId))];
  const rowIds = [...new Set(sets.map((set) => set.workoutExerciseId))];
  const [workouts, exercises, rows] = await Promise.all([
    db.workouts.bulkGet(workoutIds),
    db.exercises.bulkGet(uniqueIds),
    db.workoutExercises.bulkGet(rowIds),
  ]);

  const workoutById = new Map<string, Workout>();
  for (const workout of workouts) {
    if (workout !== undefined && workout.deletedAt === 0) workoutById.set(workout.id, workout);
  }

  const exerciseById = new Map<string, Exercise>();
  for (const exercise of exercises) {
    if (exercise !== undefined) exerciseById.set(exercise.id, exercise);
  }

  const rowById = new Map<string, WorkoutExercise>();
  for (const row of rows) {
    if (row !== undefined) rowById.set(row.id, row);
  }

  const blocks = new Map<
    string,
    { workout: Workout; exerciseId: string; rowId: string; sets: WorkoutSet[] }
  >();

  for (const set of sets) {
    const workout = workoutById.get(set.workoutId);
    if (workout === undefined) continue;
    const block = blocks.get(set.workoutExerciseId);
    if (block === undefined) {
      blocks.set(set.workoutExerciseId, {
        workout,
        exerciseId: set.exerciseId,
        rowId: set.workoutExerciseId,
        sets: [set],
      });
    } else {
      block.sets.push(set);
    }
  }

  const lines: CoachExerciseLine[] = [];
  for (const block of blocks.values()) {
    const exercise = exerciseById.get(block.exerciseId);
    const row = rowById.get(block.rowId);
    const measurementType =
      exercise?.measurementType ?? row?.exerciseMeasurementType;
    if (measurementType === undefined) continue;

    lines.push(
      coachLineFromSource({
        workout: block.workout,
        exerciseId: block.exerciseId,
        measurementType,
        equipment: exercise?.equipment ?? row?.exerciseEquipment ?? 'other',
        loadIncrementKg: exercise?.loadIncrementKg,
        sets: block.sets.sort((a, b) => a.order - b.order),
      }),
    );
  }

  return lines;
}

/**
 * Performance evaluation + phase ranking for the open finish screen.
 * Signals stay; load proposals follow `selectProgramAction` on the **target** week.
 */
export async function evaluateCoachForWorkout(workoutId: string): Promise<CoachSignal[]> {
  const detail = await getWorkoutDetail(workoutId);
  if (detail === null) return [];

  const formula = await getOneRepMaxFormula();
  const exerciseIds = detail.exercises.map((line) => line.row.exerciseId);

  const history = await loadCoachHistoryLines(exerciseIds, { excludeWorkoutId: workoutId });

  const current: CoachExerciseLine[] = [];
  for (const line of detail.exercises) {
    const identity = workoutExerciseIdentityOf(line);
    if (identity.measurementType === undefined) continue;
    current.push(
      coachLineFromSource({
        workout: detail.workout,
        exerciseId: line.row.exerciseId,
        measurementType: identity.measurementType,
        equipment: identity.equipment ?? line.exercise?.equipment ?? 'other',
        loadIncrementKg: line.exercise?.loadIncrementKg,
        sets: line.sets,
      }),
    );
  }

  const lines = [...history, ...current];
  if (lines.length === 0) return [];

  const target =
    detail.workout.programId === undefined
      ? undefined
      : await resolveTargetProgramContext(detail.workout);

  const merged = mergeLinesForWorkout(lines);
  const byExercise = new Map<string, CoachExerciseLine[]>();
  for (const entry of merged) {
    const list = byExercise.get(entry.exerciseId) ?? [];
    list.push(entry);
    byExercise.set(entry.exerciseId, list);
  }

  const signals: CoachSignal[] = [];
  for (const [, exerciseLines] of byExercise) {
    const newestFirst = exerciseLines
      .slice()
      .sort(
        (a, b) =>
          b.workoutStartedAt - a.workoutStartedAt || b.workoutId.localeCompare(a.workoutId),
      );
    const latest = newestFirst[0];
    if (latest === undefined) continue;

    const evaluation = evaluatePerformance(latest, newestFirst.slice(1), { formula });
    const selected = selectProgramAction(evaluation.allowedActions, target);
    signals.push(...shapeSignalsForSelectedAction(evaluation.signals, selected, target));
  }

  return pickSignals(signals);
}

/**
 * Persist finish-screen signals and mark loads that match pending objectives.
 * Call after `finishWorkout` so abandoned sets are already gone.
 */
export async function finalizeCoachForWorkout(workoutId: string): Promise<CoachSignal[]> {
  const signals = await evaluateCoachForWorkout(workoutId);
  await recordCoachSignals(signals, {
    workoutId,
    recommendedAt: Date.now(),
  });

  const detail = await getWorkoutDetail(workoutId);
  if (detail !== null && detail.workout.programId === undefined) {
    const outcomes = detail.exercises
      .map((line) => {
        const working = line.sets.filter(
          (set) => set.isCompleted === 1 && set.weight !== undefined,
        );
        const last = working[working.length - 1];
        return {
          exerciseId: line.row.exerciseId,
          loadKg: last?.weight ?? Number.NaN,
          workoutId,
        };
      })
      .filter((item) => Number.isFinite(item.loadKg));

    await reconcileFollowedLoads(outcomes);
  }

  return signals;
}
