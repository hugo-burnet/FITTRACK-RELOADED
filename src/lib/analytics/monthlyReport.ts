import type { HistoricalWorkout } from '@/lib/historyProjection';
import { localDateKey, localOffsetMinutes } from '@/lib/timezone';
import { exerciseTotals, workoutTotals } from '@/lib/volumeSource';
import { knownMonthStarts, monthStartOf } from './months';

/**
 * RF-44 — the monthly activity summary, computed rather than configured.
 *
 * "Automatique" is the whole requirement: nothing to set up, no report to
 * generate, no notification to subscribe to. The months exist because sessions
 * exist, and each one answers the same six questions in the same order, so two
 * months can be compared by looking at the same line twice.
 *
 * Pure by construction (architecture §7): stored sessions in, numbers out. The
 * tonnage rule is not restated here — `workoutTotals` is the one the finish
 * screen, the history and the export already use, which is what keeps a month
 * from disagreeing with the sessions it is made of.
 */

/** One exercise's share of a month. */
export interface MonthlyExercise {
  exerciseId: string;
  /** Absent when the exercise was deleted before the snapshot existed. */
  name?: string;
  tonnage: number;
  workingSets: number;
  /** Sessions of the month this exercise appeared in. */
  sessions: number;
}

export interface MonthlyReport {
  /** The first of the month, at local midnight. */
  monthStart: number;
  sessions: number;
  /** Distinct calendar days trained — two sessions in one day is one day. */
  activeDays: number;
  workingSets: number;
  totalReps: number;
  tonnage: number;
  /** Wall-clock time of the sessions, the figure the history shows. */
  durationSeconds: number;
  /** Time actually under load, tempo included. Cf. `workingSecondsOf`. */
  workingSeconds: number;
  exerciseCount: number;
  /** Every exercise of the month, heaviest first. The screen takes the head. */
  exercises: MonthlyExercise[];
}

interface Accumulator {
  sessions: number;
  days: Set<string>;
  workingSets: number;
  totalReps: number;
  tonnage: number;
  durationSeconds: number;
  workingSeconds: number;
  exercises: Map<string, MonthlyExercise & { workouts: Set<string> }>;
}

function emptyAccumulator(): Accumulator {
  return {
    sessions: 0,
    days: new Set(),
    workingSets: 0,
    totalReps: 0,
    tonnage: 0,
    durationSeconds: 0,
    workingSeconds: 0,
    exercises: new Map(),
  };
}

function collect(accumulator: Accumulator, workout: HistoricalWorkout): void {
  const offset = workout.timezoneOffsetMinutes ?? localOffsetMinutes(workout.startedAt);
  const totals = workoutTotals(workout);

  accumulator.sessions += 1;
  accumulator.days.add(localDateKey(workout.startedAt, offset));
  accumulator.workingSets += totals.workingSets;
  accumulator.totalReps += totals.totalReps;
  accumulator.tonnage += totals.tonnage;
  accumulator.durationSeconds += workout.durationSeconds;
  accumulator.workingSeconds += totals.workingSeconds;

  for (const exercise of workout.exercises) {
    const totalsOfExercise = exerciseTotals(workout, exercise);
    const current = accumulator.exercises.get(exercise.exerciseId) ?? {
      exerciseId: exercise.exerciseId,
      ...(exercise.name === undefined ? {} : { name: exercise.name }),
      tonnage: 0,
      workingSets: 0,
      sessions: 0,
      workouts: new Set<string>(),
    };

    current.tonnage += totalsOfExercise.tonnage;
    current.workingSets += totalsOfExercise.workingSets;
    current.workouts.add(workout.workoutId);
    current.sessions = current.workouts.size;
    accumulator.exercises.set(exercise.exerciseId, current);
  }
}

function report(monthStart: number, accumulator: Accumulator): MonthlyReport {
  const exercises = [...accumulator.exercises.values()]
    .map(
      ({ exerciseId, name, tonnage, workingSets, sessions }): MonthlyExercise => ({
        exerciseId,
        ...(name === undefined ? {} : { name }),
        tonnage: Math.round(tonnage * 100) / 100,
        workingSets,
        sessions,
      }),
    )
    .sort(
      (left, right) =>
        right.tonnage - left.tonnage ||
        right.workingSets - left.workingSets ||
        (left.name ?? '').localeCompare(right.name ?? '', 'fr'),
    );

  return {
    monthStart,
    sessions: accumulator.sessions,
    activeDays: accumulator.days.size,
    workingSets: accumulator.workingSets,
    totalReps: accumulator.totalReps,
    // Le tonnage d'un mois est une somme d'arrondis : on referme au centième,
    // comme `sessionTotals` le fait pour une séance.
    tonnage: Math.round(accumulator.tonnage * 100) / 100,
    durationSeconds: accumulator.durationSeconds,
    workingSeconds: accumulator.workingSeconds,
    exerciseCount: accumulator.exercises.size,
    exercises,
  };
}

/**
 * One report per month, from the current month back to the oldest trained one.
 *
 * Newest first, because that is the one being read; blank months kept, because
 * a month off is the reading that matters most in a year of training.
 */
export function monthlyReports(
  workouts: readonly HistoricalWorkout[],
  now: number,
): MonthlyReport[] {
  const byMonth = new Map<number, Accumulator>();

  for (const workout of workouts) {
    const monthStart = monthStartOf(workout.startedAt, workout.timezoneOffsetMinutes);
    const accumulator = byMonth.get(monthStart) ?? emptyAccumulator();
    collect(accumulator, workout);
    byMonth.set(monthStart, accumulator);
  }

  return knownMonthStarts(byMonth.keys(), now).map((monthStart) =>
    report(monthStart, byMonth.get(monthStart) ?? emptyAccumulator()),
  );
}

/** What one month did more — or less — than the month before it. */
export interface MonthlyDelta {
  sessions: number;
  tonnage: number;
  workingSets: number;
  durationSeconds: number;
}

/**
 * `undefined` for the oldest month rather than a delta against zero: the first
 * month of a history has not "gained everything", it simply has nothing before
 * it, and printing +100 % there is the kind of figure people quote.
 */
export function monthlyDelta(
  current: MonthlyReport,
  previous: MonthlyReport | undefined,
): MonthlyDelta | undefined {
  if (previous === undefined) return undefined;

  return {
    sessions: current.sessions - previous.sessions,
    tonnage: Math.round((current.tonnage - previous.tonnage) * 100) / 100,
    workingSets: current.workingSets - previous.workingSets,
    durationSeconds: current.durationSeconds - previous.durationSeconds,
  };
}
