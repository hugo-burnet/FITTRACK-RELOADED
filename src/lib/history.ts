export interface WeeklyTrainingGoal {
  effectiveFromWeek: number;
  sessions: number;
}

export interface WeeklyRegularity {
  currentCompleted: number;
  currentGoal: number | null;
  streak: number;
}

/** Monday 00:00 in the device's local calendar. */
export function startOfLocalWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - mondayOffset);
  return date.getTime();
}

/**
 * Moves between local calendar weeks without assuming they all last 168 hours.
 * The assumption breaks twice a year in timezones with daylight-saving time.
 */
export function addLocalWeeks(weekStart: number, amount: number): number {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + amount * 7);
  return date.getTime();
}

export function resolveWeeklyGoal(
  history: readonly WeeklyTrainingGoal[],
  weekStart: number,
): number | null {
  let resolved: WeeklyTrainingGoal | undefined;

  for (const goal of history) {
    if (goal.effectiveFromWeek > weekStart) continue;
    if (resolved === undefined || goal.effectiveFromWeek >= resolved.effectiveFromWeek) {
      resolved = goal;
    }
  }

  return resolved?.sessions ?? null;
}

export function calculateWeeklyRegularity(
  completedWorkoutTimestamps: readonly number[],
  history: readonly WeeklyTrainingGoal[],
  now: number,
): WeeklyRegularity {
  const currentWeek = startOfLocalWeek(now);
  const completedPerWeek = new Map<number, number>();

  for (const timestamp of completedWorkoutTimestamps) {
    const week = startOfLocalWeek(timestamp);
    completedPerWeek.set(week, (completedPerWeek.get(week) ?? 0) + 1);
  }

  const currentCompleted = completedPerWeek.get(currentWeek) ?? 0;
  const currentGoal = resolveWeeklyGoal(history, currentWeek);

  if (currentGoal === null) {
    return { currentCompleted, currentGoal, streak: 0 };
  }

  let week =
    currentCompleted >= currentGoal ? currentWeek : addLocalWeeks(currentWeek, -1);
  let streak = 0;

  while (true) {
    const goal = resolveWeeklyGoal(history, week);
    if (goal === null || (completedPerWeek.get(week) ?? 0) < goal) break;
    streak += 1;
    week = addLocalWeeks(week, -1);
  }

  return { currentCompleted, currentGoal, streak };
}
