import type { HistoricalSet, HistoricalWorkout } from '@/lib/historyProjection';
import type { MetricPoint } from '@/lib/analytics/metrics';
import { isWorkingSet } from '@/lib/records';

/**
 * Ce que la page d'un exercice sait de ses séances, calculé depuis **une seule**
 * lecture : `listHistoricalWorkouts({ kind: 'exercise' })`, les séances terminées.
 *
 * Pourquoi une seule source : la fiche lisait `listSessionsForExercise` (liste),
 * la vue plein écran `listHistoricalWorkouts` (courbe) et la séance en direct
 * `getLastPerformance` (« précédent ») — trois définitions de « les séances de
 * l'exercice » qui ne comptaient pas les mêmes (blocs ou séances, benchmark ou
 * non). Tuile, courbe et liste de la page partent maintenant de la même liste,
 * donc ne se contredisent plus.
 */

export interface ExerciseSessionSummary {
  workoutId: string;
  startedAt: number;
  /** Toutes les séries validées de l'exercice dans la séance, blocs fusionnés, échauffements compris. */
  sets: HistoricalSet[];
}

/**
 * Une ligne par séance, la plus récente d'abord. Un exercice fait deux fois dans
 * la même séance est **une** ligne : on ouvre une séance, pas un bloc.
 */
export function exerciseSessions(workouts: readonly HistoricalWorkout[]): ExerciseSessionSummary[] {
  return workouts
    .map((workout) => ({
      workoutId: workout.workoutId,
      startedAt: workout.startedAt,
      sets: workout.exercises.flatMap((exercise) => exercise.sets),
    }))
    .filter((session) => session.sets.length > 0)
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * La séance que dit « La dernière fois » : la plus récente **hors séances test**.
 *
 * Même règle que la colonne « précédent » de la séance en direct
 * (`getLastPerformance`) : une série menée à l'échec n'est pas ce qu'on a fait
 * « la dernière fois ». La courbe et la liste, elles, gardent les séances test.
 */
export function lastTimeSession(
  sessions: readonly ExerciseSessionSummary[],
  benchmarkIds: ReadonlySet<string>,
): ExerciseSessionSummary | undefined {
  return sessions.find((session) => !benchmarkIds.has(session.workoutId));
}

export interface LastTimeSummary {
  /** Séries de travail (sans échauffement). */
  setCount: number;
  /** La charge quand toutes les séries de travail pèsent pareil ; sinon absente. */
  weight?: number;
  /** Les reps des séries de travail, dans l'ordre, quand `weight` est donnée. */
  reps: number[];
}

/**
 * De quoi écrire « 85 kg — 4 séries : 6 · 5 · 5 · 5 reps ». La charge n'est
 * donnée que si elle est unique : lister des reps sous un chiffre qui n'est la
 * charge que d'une série mentirait sur les autres.
 */
export function lastTimeSummary(sets: readonly HistoricalSet[]): LastTimeSummary {
  const working = sets.filter(isWorkingSet);
  const weights = new Set(working.map((set) => set.weight));
  const [only] = [...weights];
  const uniform = weights.size === 1 && only !== undefined && only > 0;
  const reps = working.map((set) => set.reps);
  const complete = uniform && reps.every((value): value is number => value !== undefined);

  return complete
    ? { setCount: working.length, weight: only, reps: reps as number[] }
    : { setCount: working.length, reps: [] };
}

export interface ProgressTrend {
  /** Les dernières séances, de la plus ancienne à la plus récente. */
  window: MetricPoint[];
  first: MetricPoint;
  last: MetricPoint;
  /** `last − first` ; absent avec un seul point. */
  delta?: number;
  /** Date de la première séance de la fenêtre, d'où part l'écart. */
  since: number;
}

/** La fin d'une courbe, résumée : c'est ce que dit la tuile de progression. */
export function progressTrend(
  points: readonly MetricPoint[],
  size: number,
): ProgressTrend | undefined {
  const window = points.slice(-size);
  const first = window[0];
  const last = window[window.length - 1];
  if (first === undefined || last === undefined) return undefined;

  return {
    window,
    first,
    last,
    // Au centième : un écart de 1RM ne doit pas s'afficher « +0 kg » pour du bruit flottant.
    ...(window.length > 1 ? { delta: Math.round((last.value - first.value) * 100) / 100 } : {}),
    since: first.timestamp,
  };
}

/**
 * Une lecture déjà formatée (« 122,5 kg ») coupée en chiffre et unité, pour une
 * tuile qui les range à part. Seules les unités simples se coupent : « 1 h 12 »
 * ou « 80 kg × 8 » restent entières, car leur dernière espace n'est pas celle
 * d'une unité.
 */
export function splitReading(text: string): { value: string; unit?: string } {
  const match = /^(\d[\d\s,.]*) (kg|reps|séries?|km|m)$/.exec(text);
  return match?.[1] !== undefined && match[2] !== undefined
    ? { value: match[1], unit: match[2] }
    : { value: text };
}
