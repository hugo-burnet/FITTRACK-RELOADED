import { db } from '@/data/db';
import type { RoutineSet, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  benchmarkLine,
  type BenchmarkLine,
  type BenchmarkProposal,
  type BenchmarkRoutineRow,
} from '@/lib/benchmark';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import { isWorkingSet } from '@/lib/records';
import { alive, newEntity } from './base';
import { supersedePendingLoadRecommendations } from './coachRecommendations';
import { applyRoutineTargetProposals } from './routineTargetReview';
import { getOneRepMaxFormula } from './settings';
import {
  assertNoActiveWorkout,
  buildWorkoutEntities,
  insertWorkoutEntities,
  readWorkoutRoutineSource,
  type WorkoutEntityGraph,
} from './workoutLifecycle';

/**
 * Le benchmark : sa séance, son bilan, et l'écriture qui en découle (spec
 * benchmark). La logique — du maximum à la charge — est dans `lib/benchmark` ;
 * ce module lui apporte les enregistrements et ne décide de rien.
 *
 * Aucune table, aucun index, aucune version de schéma : une séance ordinaire
 * marquée `kind: 'benchmark'`.
 */

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

/**
 * Réduit le graphe d'une routine à une série par exercice, menée à l'échec.
 *
 * La série qui reste est la première de travail — celle dont la charge est la
 * charge de la routine —, sans rien à viser que la charge : pas de répétitions
 * (on va au bout), pas de RPE, pas de durée ni de distance. Un exercice sans
 * série de travail — échauffement seul, ou rien du tout — en reçoit une vierge,
 * sans charge : le benchmark ne perd jamais une ligne, et ne prête pas à l'essai
 * la charge d'un échauffement.
 */
function reduceToBenchmark(graph: WorkoutEntityGraph): WorkoutEntityGraph {
  const sets = graph.exercises.map((row) => {
    const planned = graph.sets
      .filter((set) => set.workoutExerciseId === row.id)
      .sort(byOrder);
    // Jamais l'échauffement : sa charge n'est pas celle d'un essai à fond.
    const stand = planned.find(isWorkingSet);

    // Construite champ par champ et non copiée de `stand` : une copie emporterait
    // avec elle ce qu'on veut laisser — une cible de répétitions, un RPE —, et
    // c'est la liste des champs gardés, pas celle des champs retirés, qui doit
    // se lire d'un coup d'œil.
    return newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: row.exerciseId,
      workoutId: graph.workout.id,
      order: 0,
      setType: 'failure',
      side: 'both',
      ...(stand?.targetWeight === undefined ? {} : { targetWeight: stand.targetWeight }),
      isCompleted: 0,
      performedAt: 0,
    });
  });

  return { workout: graph.workout, exercises: graph.exercises, sets };
}

/**
 * Lance un benchmark depuis une routine. Refuse quand une séance est déjà
 * ouverte (comme « Démarrer ») et quand la routine n'a aucun exercice.
 */
export async function startBenchmarkFromRoutine(
  routineId: string,
  name: string,
): Promise<Workout> {
  const source = await readWorkoutRoutineSource(routineId);
  if (source === null) throw new Error(`Routine introuvable : ${routineId}`);
  if (source.rows.length === 0) throw new Error(`Routine sans exercice : ${routineId}`);

  const built = buildWorkoutEntities({ source, startedAt: Date.now() });
  const reduced = reduceToBenchmark(built);
  const graph: WorkoutEntityGraph = {
    ...reduced,
    workout: { ...reduced.workout, name, kind: 'benchmark' },
  };

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await assertNoActiveWorkout();
    await insertWorkoutEntities(graph);
  });

  return graph.workout;
}

export interface BenchmarkReport {
  workout: Workout;
  /** Absent quand la routine d'où est parti le benchmark n'existe plus. */
  routineName?: string;
  lines: BenchmarkLine[];
}

/**
 * La ligne de la routine qui correspond à un exercice de la séance : même
 * exercice, **même rang**. Rapprocher par exercice seul confondrait un exercice
 * présent deux fois ; si la routine a été modifiée depuis, rien ne correspond et
 * il n'y a rien à écrire — mieux vaut ne rien écrire que l'écrire à côté.
 */
function routineRowFor(
  row: WorkoutExercise,
  routineRows: readonly { id: string; exerciseId: string; order: number }[],
  setsByRow: ReadonlyMap<string, readonly RoutineSet[]>,
): BenchmarkRoutineRow | undefined {
  const match = routineRows.find(
    (candidate) => candidate.exerciseId === row.exerciseId && candidate.order === row.order,
  );
  if (match === undefined) return undefined;
  return {
    routineExerciseId: match.id,
    sets: (setsByRow.get(match.id) ?? []).map((set) => ({
      id: set.id,
      setType: set.setType,
      ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
      ...(set.targetRepsMax === undefined ? {} : { targetRepsMax: set.targetRepsMax }),
      ...(set.targetWeight === undefined ? {} : { targetWeight: set.targetWeight }),
    })),
  };
}

/**
 * Le bilan d'un benchmark. `null` pour une séance qui n'en est pas un ou qui
 * n'existe plus — jamais `undefined`, que `useLiveQuery` réserve à « pas encore
 * répondu ».
 */
export async function loadBenchmarkReport(workoutId: string): Promise<BenchmarkReport | null> {
  const workout = await db.workouts.get(workoutId);
  if (workout === undefined || workout.deletedAt !== 0 || workout.kind !== 'benchmark') {
    return null;
  }

  const rows = alive(await db.workoutExercises.where('workoutId').equals(workoutId).toArray()).sort(
    byOrder,
  );
  const [sets, exercises, routine, formula] = await Promise.all([
    rows.length === 0
      ? []
      : db.workoutSets
          .where('workoutExerciseId')
          .anyOf(rows.map((row) => row.id))
          .toArray(),
    db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]),
    workout.routineId === '' ? undefined : db.routines.get(workout.routineId),
    getOneRepMaxFormula(),
  ]);

  const livingRoutine = routine !== undefined && routine.deletedAt === 0 ? routine : undefined;
  const routineRows =
    livingRoutine === undefined
      ? []
      : alive(await db.routineExercises.where('routineId').equals(livingRoutine.id).toArray());
  const routineSets =
    routineRows.length === 0
      ? []
      : alive(
          await db.routineSets
            .where('routineExerciseId')
            .anyOf(routineRows.map((row) => row.id))
            .toArray(),
        ).sort(byOrder);
  const setsByRow = new Map<string, RoutineSet[]>();
  for (const set of routineSets) {
    const list = setsByRow.get(set.routineExerciseId);
    if (list === undefined) setsByRow.set(set.routineExerciseId, [set]);
    else list.push(set);
  }

  const library = new Map(
    exercises.flatMap((exercise) => (exercise === undefined ? [] : [[exercise.id, exercise] as const])),
  );
  const completed = alive(sets).filter((set) => set.isCompleted === 1);

  const lines = rows.flatMap((row) => {
    const performed = completed.filter((set) => set.workoutExerciseId === row.id);
    const exercise = library.get(row.exerciseId);
    const identity = resolveExerciseIdentity(row, exercise);
    // Sans mesure ni nom, ni la ligne ne se lit ni la charge ne se dimensionne.
    if (identity.measurementType === undefined || identity.name === undefined) return [];

    return [
      benchmarkLine({
        exerciseId: row.exerciseId,
        exerciseName: identity.name,
        measurementType: identity.measurementType,
        equipment: identity.equipment ?? 'other',
        ...(exercise?.loadIncrementKg === undefined
          ? {}
          : { loadIncrementKg: exercise.loadIncrementKg }),
        formula,
        sets: performed.map((set) => ({
          ...(set.weight === undefined ? {} : { weight: set.weight }),
          ...(set.reps === undefined ? {} : { reps: set.reps }),
          ...(set.durationSeconds === undefined ? {} : { durationSeconds: set.durationSeconds }),
          ...(set.distanceMeters === undefined ? {} : { distanceMeters: set.distanceMeters }),
        })),
        ...(() => {
          const routineRow = routineRowFor(row, routineRows, setsByRow);
          return routineRow === undefined ? {} : { routine: routineRow };
        })(),
      }),
    ];
  });

  return {
    workout,
    ...(livingRoutine === undefined ? {} : { routineName: livingRoutine.name }),
    lines,
  };
}

/**
 * Écrit les charges acceptées dans la routine — par le chemin d'écriture de la
 * revue des cibles, qui décale chaque série de travail du même écart (une
 * pyramide garde sa forme) et relit les séries en base plutôt que de les croire.
 *
 * Une proposition n'est écrite que si sa série de référence porte encore la
 * charge que le bilan a lue : un décalage rejoué (double appui sur « Appliquer »
 * avant que l'écran ne se rafraîchisse) ou posé sur une routine modifiée entre
 * temps ne déplace pas deux fois, il ne fait rien.
 *
 * Renvoie le nombre d'**exercices** réécrits, pas de séries.
 *
 * **Une charge, une seule source.** Un objectif de charge que le coach avait posé sur l'exercice
 * (« la prochaine fois, 102,5 kg ») reste affiché sur sa carte pendant la séance tant qu'aucune
 * séance ne l'a résolu : à côté de la cible que le benchmark vient d'écrire, la personne lirait deux
 * chiffres pour le même exercice. Il est donc **remplacé** (`superseded`, qui n'est pas un refus : le
 * coach ne le tient pas pour tel) — dans la même transaction que l'écriture, et seulement pour les
 * exercices réellement réécrits. Les observations sans charge restent : le benchmark ne les contredit pas.
 */
export async function applyBenchmarkProposals(
  proposals: readonly BenchmarkProposal[],
): Promise<number> {
  if (proposals.length === 0) return 0;

  return db.transaction('rw', db.routineSets, db.coachRecommendations, async () => {
    const anchors = await db.routineSets.bulkGet(proposals.map((proposal) => proposal.anchorSetId));
    const current = proposals.filter((proposal, index) => {
      const anchor = anchors[index];
      return (
        anchor !== undefined && anchor.deletedAt === 0 && anchor.targetWeight === proposal.fromWeight
      );
    });
    await applyRoutineTargetProposals(current);
    await supersedePendingLoadRecommendations(current.map((proposal) => proposal.exerciseId));
    // Des exercices, pas des séries : c'est ce que l'écran annonce. La série de
    // référence change toujours (une proposition alignée n'existe pas), donc
    // chaque proposition retenue est bien une ligne réécrite.
    return current.length;
  });
}
