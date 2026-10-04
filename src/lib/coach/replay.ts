import { evaluatePerformance, mergeLinesForWorkout, pickSignals } from './evaluate';
import type {
  CoachAction,
  CoachEvaluateOptions,
  CoachExerciseLine,
  CoachSignal,
} from './types';

/** What the engine said about one exercise at the end of one session. */
export interface ReplayStep {
  exerciseId: string;
  workoutId: string;
  workoutStartedAt: number;
  /** Every signal the rules produced, before the one-per-exercise comparator. */
  signals: CoachSignal[];
  /** The one the card would show (`pickSignals`). */
  shown: CoachSignal | undefined;
  allowedActions: CoachAction[];
}

function oldestFirst(a: CoachExerciseLine, b: CoachExerciseLine): number {
  return a.workoutStartedAt - b.workoutStartedAt || a.workoutId.localeCompare(b.workoutId);
}

/**
 * Replay the engine session by session (spec coach v2 § 7).
 *
 * Each session is judged with **only the sessions before it**. The app does
 * the same thing for free, at the end of each workout, because the future does
 * not exist yet; a replay over a finished history has to enforce it, or every
 * session is judged as if it were the last. Phase shaping (`coachEvaluate`)
 * is left out: it needs the block calendar, and the bench measures the
 * performance rules, which are what the coach v2 changes.
 */
export function replayCoach(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): ReplayStep[] {
  const byExercise = new Map<string, CoachExerciseLine[]>();
  for (const line of mergeLinesForWorkout(lines)) {
    const list = byExercise.get(line.exerciseId) ?? [];
    list.push(line);
    byExercise.set(line.exerciseId, list);
  }

  const steps: ReplayStep[] = [];
  for (const list of byExercise.values()) {
    const history = list.slice().sort(oldestFirst);
    history.forEach((line, index) => {
      const evaluation = evaluatePerformance(line, history.slice(0, index), options);
      steps.push({
        exerciseId: line.exerciseId,
        workoutId: line.workoutId,
        workoutStartedAt: line.workoutStartedAt,
        signals: evaluation.signals,
        shown: pickSignals(evaluation.signals)[0],
        allowedActions: evaluation.allowedActions,
      });
    });
  }
  return steps;
}

function describeSignal(signal: CoachSignal): string {
  return signal.nextLoadKg === undefined ? signal.code : `${signal.code}→${signal.nextLoadKg}`;
}

/**
 * Plain text, one line per step, grouped by exercise and sorted by date: made
 * to be diffed between two versions of the engine. Developer output, never
 * shown in the app — hence no `fr.ts`.
 */
export function formatReplay(
  steps: readonly ReplayStep[],
  names: ReadonlyMap<string, string>,
): string {
  const byExercise = new Map<string, ReplayStep[]>();
  for (const step of steps) {
    const list = byExercise.get(step.exerciseId) ?? [];
    list.push(step);
    byExercise.set(step.exerciseId, list);
  }

  const nameOf = (id: string): string => names.get(id) ?? id;
  const out: string[] = [];
  for (const id of [...byExercise.keys()].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) {
    out.push(`## ${nameOf(id)}`);
    const list = byExercise.get(id)!.slice().sort((a, b) => a.workoutStartedAt - b.workoutStartedAt);
    for (const step of list) {
      const date = new Date(step.workoutStartedAt).toISOString().slice(0, 10);
      const signals = step.signals.map(describeSignal).join(' · ') || '—';
      const shown = step.shown === undefined ? '—' : describeSignal(step.shown);
      out.push(`${date}  ${signals}  | shown: ${shown}  | actions: ${step.allowedActions.join(', ')}`);
    }
    out.push('');
  }
  return out.join('\n');
}
