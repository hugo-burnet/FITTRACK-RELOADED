import type { HevyParsedWorkout } from './hevyCsv';
import { normalizeHevyExerciseTitle } from './hevyExerciseMatch';
import { normalizeRoutineName } from './routineName';

export interface HevyRoutineSource {
  name: string;
  workout: HevyParsedWorkout;
  /** La séance la plus récente du groupe — ce qui décide si la routine dort. */
  lastPerformedAt: number;
  /**
   * Toutes les séances du groupe, par leur clé d'import.
   *
   * C'est ce qui permet à l'import de **rattacher** ces séances à la routine
   * qu'il reconstruit à partir d'elles : sans ça, l'import fabrique une routine
   * et un historique qui ne se connaissent pas — la routine s'affiche « jamais
   * réalisée » alors qu'elle est née de ces séances-là.
   */
  importKeys: string[];
}

/** Le regroupement de l'import et le rattachement de l'accueil, même règle. */
const normalizeHevyRoutineName = normalizeRoutineName;

function displayName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function distinctExerciseCount(workout: HevyParsedWorkout): number {
  return new Set(
    workout.exercises.map((exercise) =>
      normalizeHevyExerciseTitle(exercise.sourceTitle),
    ),
  ).size;
}

/**
 * Le nom de routine à retenir pour une séance, et rien si elle n'en a pas.
 *
 * Un fichier écrit par FitTrack porte la colonne `fittrack_routine` : la séance
 * dit elle-même de quelle routine elle vient, ce qui vaut mieux que son titre
 * (renommer une séance ne la détache plus de sa routine) et laisse les séances
 * libres **en dehors** de la reconstruction — elles n'ont jamais été des
 * routines.
 *
 * Un export Hevy authentique n'a pas cette colonne : on retombe sur le titre,
 * seul lien disponible, comme avant.
 */
function routineNameOf(
  workout: HevyParsedWorkout,
  declared: boolean,
): string | undefined {
  if (!declared) return workout.title;
  return workout.routineName;
}

/**
 * Une routine qu'on ne fait plus : sa dernière séance a plus d'un mois.
 *
 * Un import ramène **toutes** les routines que l'historique contient, y compris
 * la full body de l'hiver dernier et celle qu'on avait supprimée. Les ranger
 * dans un dossier à part vaut mieux que de les refuser (on ne sait pas ce que
 * l'utilisateur compte reprendre) et mieux que de tout mélanger (la liste des
 * routines actives est ce qu'on regarde avant chaque séance).
 */
const ROUTINE_DORMANT_AFTER_DAYS = 30;

export function isDormantRoutine(
  source: HevyRoutineSource,
  at: number,
): boolean {
  return at - source.lastPerformedAt > ROUTINE_DORMANT_AFTER_DAYS * 86_400_000;
}

export function selectHevyRoutineSources(
  workouts: readonly HevyParsedWorkout[],
): HevyRoutineSource[] {
  // Une seule séance qui déclare sa routine suffit à faire foi pour le fichier :
  // les autres sont alors des séances libres, pas des séances sans information.
  const declared = workouts.some(
    (workout) => workout.routineName !== undefined && workout.routineName.trim() !== '',
  );

  const groups = new Map<string, HevyParsedWorkout[]>();
  for (const workout of workouts) {
    const name = routineNameOf(workout, declared);
    if (name === undefined || name.trim() === '') continue;
    const key = normalizeHevyRoutineName(name);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [workout]);
    else group.push(workout);
  }

  const selected = [...groups.values()].map((group) => {
    const winner = [...group]
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, 5)
      .sort(
        (left, right) =>
          distinctExerciseCount(right) -
            distinctExerciseCount(left) ||
          right.startedAt - left.startedAt,
      )[0]!;

    return {
      name: displayName(routineNameOf(winner, declared) ?? winner.title),
      workout: winner,
      lastPerformedAt: group.reduce(
        (latest, candidate) => Math.max(latest, candidate.startedAt),
        0,
      ),
      importKeys: group.map((candidate) => candidate.importKey),
    };
  });

  return selected.sort(
    (left, right) =>
      left.workout.startedAt - right.workout.startedAt,
  );
}
