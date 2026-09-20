import Dexie from 'dexie';
import { db } from '@/data/db';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import {
  computeRoutineUpdates,
  type PerformedSessionInput,
  type RoutineTargetLineInput,
  type RoutineTargetProposal,
  type RoutineUpdateReview,
} from '@/lib/routineTargets';
import { alive, touch } from './base';
import { getRoutineDetail } from './routineLifecycle';

/**
 * La collecte de la revue des cibles — et sa seule écriture.
 *
 * Même découpage que le Coach du Lot 18 : le moteur (`lib/routineTargets`) est
 * pur et ne connaît pas Dexie, ce module lui apporte les enregistrements. Un
 * `routineId` seul ne peut pas être pur — il faut bien lire la base — et cette
 * frontière est ce qui rend les quatre règles vérifiables sans elle.
 *
 * Aucune table, aucun index, donc aucune version de schéma : tout ce que la
 * revue lit existe déjà.
 */

const DEFAULT_REFERENCE_SESSIONS = 3;

/**
 * Combien de séries récentes d'un exercice on remonte pour y trouver ses
 * dernières séances.
 *
 * L'index `[exerciseId+performedAt]` est parcouru à l'envers, comme
 * `getLastPerformance`, mais il faut ici **trois** séances et non une : sans
 * borne, ouvrir la revue relirait dix ans d'historique par exercice. Quarante
 * séries d'un même exercice dans une séance est déjà hors de portée du réel ;
 * le bloc retenu, lui, est ensuite relu en entier par son `workoutExerciseId`,
 * donc aucune série d'une séance choisie n'est perdue.
 */
const SETS_PER_REFERENCE_SESSION = 40;

export interface RoutineTargetReviewOptions {
  referenceSessionCount?: number;
}

/** Les blocs de séance, dédupliqués par `workoutExerciseId`. */
type BlockMap = Map<string, PerformedSessionInput>;

function toPerformedSession(
  row: WorkoutExercise,
  sets: readonly WorkoutSet[],
  exercise: Exercise | undefined,
  workout: Workout | undefined,
): PerformedSessionInput {
  const identity = resolveExerciseIdentity(row, exercise);
  const performedAt = sets.reduce(
    (earliest, set) => Math.min(earliest, set.performedAt),
    Number.POSITIVE_INFINITY,
  );

  return {
    workoutId: row.workoutId,
    workoutExerciseId: row.id,
    exerciseId: row.exerciseId,
    performedAt: Number.isFinite(performedAt) ? performedAt : 0,
    exerciseName: identity.name,
    isUnilateral: identity.isUnilateral,
    measurementType: identity.measurementType,
    fromRoutineId: workout?.routineId,
    sets: sets
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((set) => ({
        setType: set.setType,
        order: set.order,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
      })),
  };
}

/** Les séries validées d'un bloc, relues en entier par son identifiant de ligne. */
async function setsOfBlocks(blockIds: readonly string[]): Promise<Map<string, WorkoutSet[]>> {
  const byBlock = new Map<string, WorkoutSet[]>();
  if (blockIds.length === 0) return byBlock;

  const sets = alive(
    await db.workoutSets
      .where('workoutExerciseId')
      .anyOf([...blockIds])
      .filter((set) => set.isCompleted === 1 && set.performedAt > 0)
      .toArray(),
  );

  for (const set of sets) {
    const list = byBlock.get(set.workoutExerciseId);
    if (list === undefined) byBlock.set(set.workoutExerciseId, [set]);
    else list.push(set);
  }
  return byBlock;
}

/**
 * Les `count` dernières séances contenant chacun de ces exercices.
 *
 * Par exercice et non par routine : la règle 2 parle des séances **contenant
 * l'exercice**, où qu'il ait été fait. Un rowing poussé pendant une séance
 * libre compte autant qu'un rowing de la routine.
 */
async function recentBlockIdsByExercise(
  exerciseIds: readonly string[],
  count: number,
): Promise<string[]> {
  const limit = count * SETS_PER_REFERENCE_SESSION;
  const blockIds: string[] = [];

  for (const exerciseId of exerciseIds) {
    const recent = await db.workoutSets
      .where('[exerciseId+performedAt]')
      .between([exerciseId, 1], [exerciseId, Dexie.maxKey])
      .reverse()
      .filter((set) => set.deletedAt === 0 && set.isCompleted === 1)
      .limit(limit)
      .toArray();

    const seenWorkouts = new Set<string>();
    const seenBlocks = new Set<string>();
    for (const set of recent) {
      if (!seenWorkouts.has(set.workoutId)) {
        if (seenWorkouts.size >= count) break;
        seenWorkouts.add(set.workoutId);
      }
      if (seenBlocks.has(set.workoutExerciseId)) continue;
      seenBlocks.add(set.workoutExerciseId);
      blockIds.push(set.workoutExerciseId);
    }
  }

  return blockIds;
}

/**
 * Les blocs des dernières séances **parties de cette routine**.
 *
 * C'est la seule fenêtre où la règle 6 a un sens : sans elle, tout exercice
 * jamais pratiqué se présenterait comme « manquant » de cette routine-là.
 */
async function recentRoutineBlockIds(routineId: string, count: number): Promise<string[]> {
  const workouts = alive(await db.workouts.where('routineId').equals(routineId).toArray())
    .filter((workout) => workout.status === 'completed')
    .sort((a, b) => b.startedAt - a.startedAt || b.id.localeCompare(a.id))
    .slice(0, count);

  if (workouts.length === 0) return [];

  const rows = alive(
    await db.workoutExercises
      .where('workoutId')
      .anyOf(workouts.map((workout) => workout.id))
      .toArray(),
  );

  return rows.map((row) => row.id);
}

async function loadBlocks(blockIds: readonly string[]): Promise<BlockMap> {
  const unique = [...new Set(blockIds)];
  const [rows, setsByBlock] = await Promise.all([
    db.workoutExercises.bulkGet(unique),
    setsOfBlocks(unique),
  ]);

  const living = rows.filter(
    (row): row is WorkoutExercise => row !== undefined && row.deletedAt === 0,
  );
  const [workouts, exercises] = await Promise.all([
    db.workouts.bulkGet([...new Set(living.map((row) => row.workoutId))]),
    // `bulkGet` et non `alive` : un exercice supprimé de la bibliothèque reste
    // celui qui a été fait, et son instantané répond encore de son nom.
    db.exercises.bulkGet([...new Set(living.map((row) => row.exerciseId))]),
  ]);

  const workoutById = new Map<string, Workout>();
  for (const workout of workouts) {
    if (workout !== undefined && workout.deletedAt === 0) workoutById.set(workout.id, workout);
  }
  const exerciseById = new Map<string, Exercise>();
  for (const exercise of exercises) {
    if (exercise !== undefined) exerciseById.set(exercise.id, exercise);
  }

  const blocks: BlockMap = new Map();
  for (const row of living) {
    const workout = workoutById.get(row.workoutId);
    // Une séance en cours ou abandonnée n'est pas de l'historique.
    if (workout === undefined || workout.status !== 'completed') continue;

    const sets = setsByBlock.get(row.id);
    if (sets === undefined || sets.length === 0) continue;

    blocks.set(row.id, toPerformedSession(row, sets, exerciseById.get(row.exerciseId), workout));
  }

  return blocks;
}

/**
 * La revue d'une routine, prête à l'écran. `null` quand la routine n'existe
 * plus — jamais `undefined`, que `useLiveQuery` réserve à « pas encore
 * répondu ».
 */
export async function loadRoutineTargetReview(
  routineId: string,
  options: RoutineTargetReviewOptions = {},
): Promise<RoutineUpdateReview | null> {
  const detail = await getRoutineDetail(routineId);
  if (detail === null) return null;

  const referenceSessionCount = Math.max(
    1,
    options.referenceSessionCount ?? DEFAULT_REFERENCE_SESSIONS,
  );

  const lines: RoutineTargetLineInput[] = [];
  for (const line of detail.exercises) {
    const exercise = line.exercise;
    // Sans exercice en bibliothèque, ni mesure ni pas de charge : il n'y a rien
    // à comparer, et inventer `weight_reps` ici écrirait des kilos sur une
    // planche. La ligne reste telle quelle, en silence.
    if (exercise === undefined) continue;
    lines.push({
      routineExerciseId: line.row.id,
      exerciseId: line.row.exerciseId,
      order: line.row.order,
      exerciseName: exercise.name,
      isUnilateral: exercise.isUnilateral,
      measurementType: exercise.measurementType,
      equipment: exercise.equipment,
      loadIncrementKg: exercise.loadIncrementKg,
      sets: line.sets.map((set) => ({
        id: set.id,
        order: set.order,
        setType: set.setType,
        targetReps: set.targetReps,
        targetRepsMax: set.targetRepsMax,
        targetWeight: set.targetWeight,
      })),
    });
  }

  const [historyIds, routineIds] = await Promise.all([
    recentBlockIdsByExercise(
      [...new Set(lines.map((line) => line.exerciseId))],
      referenceSessionCount,
    ),
    recentRoutineBlockIds(routineId, referenceSessionCount),
  ]);

  // Dédupliqué par `workoutExerciseId` : les deux fenêtres se recouvrent, et un
  // bloc compté deux fois doublerait son nombre de séries de travail — donc
  // ferait passer pour « tenue en entier » une séance qui ne l'était pas.
  const blocks = await loadBlocks([...historyIds, ...routineIds]);

  return computeRoutineUpdates({
    routineId,
    lines,
    sessions: [...blocks.values()],
    referenceSessionCount,
  });
}

/**
 * Écrit les propositions acceptées — **le seul chemin d'écriture de la revue**.
 *
 * Chaque proposition porte les identifiants de séries qu'elle réécrit et son
 * `deltaKg` : la pyramide 60/70/80 se décale entière au lieu d'être aplatie sur
 * un chiffre. Une ligne qui ne portait aucune charge reçoit `proposedWeight`
 * tel quel — c'est le seul cas où la revue écrit un nombre plutôt qu'un écart.
 *
 * Les identifiants sont relus en base et non crus sur parole : la revue a pu
 * rester ouverte pendant qu'une série était supprimée ailleurs.
 */
export async function applyRoutineTargetProposals(
  proposals: readonly RoutineTargetProposal[],
): Promise<number> {
  if (proposals.length === 0) return 0;

  return db.transaction('rw', db.routineSets, async () => {
    const byId = new Map<string, RoutineTargetProposal>();
    for (const proposal of proposals) {
      for (const setId of proposal.targetSetIds) byId.set(setId, proposal);
    }

    const sets = alive(await db.routineSets.bulkGet([...byId.keys()]).then((rows) =>
      rows.filter((row): row is NonNullable<typeof row> => row !== undefined),
    ));

    const updated = sets.flatMap((set) => {
      const proposal = byId.get(set.id);
      if (proposal === undefined) return [];

      const targetWeight =
        proposal.deltaKg === undefined || set.targetWeight === undefined
          ? proposal.proposedWeight
          : Math.max(0, Math.round((set.targetWeight + proposal.deltaKg) * 1000) / 1000);

      if (targetWeight === set.targetWeight) return [];
      return [touch(set, { targetWeight })];
    });

    if (updated.length > 0) await db.routineSets.bulkPut(updated);
    return updated.length;
  });
}
