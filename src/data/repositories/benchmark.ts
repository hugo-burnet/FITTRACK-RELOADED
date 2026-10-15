import { db } from '@/data/db';
import type { BenchmarkGoal, RoutineSet, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  benchmarkLine,
  benchmarkSignal,
  type BenchmarkLine,
  type BenchmarkProposal,
  type BenchmarkRoutineRow,
} from '@/lib/benchmark';
import type { RepZone } from '@/lib/benchmarkModel';
import type { CoachSignal } from '@/lib/coach/types';
import { exerciseClass } from '@/lib/exerciseClass';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import { isWorkingSet } from '@/lib/records';
import { alive, newEntity, touch } from './base';
import { recordCoachSignals } from './coachRecommendations';
import { applyRoutineTargetProposals } from './routineTargetReview';
import {
  assertNoActiveWorkout,
  buildWorkoutEntities,
  insertWorkoutEntities,
  readWorkoutRoutineSource,
  type WorkoutEntityGraph,
  type WorkoutRoutineSource,
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
 * Pose sur chaque ligne de séance l'identifiant de la ligne de routine d'où elle part.
 *
 * `buildWorkoutEntities` fait une ligne de séance par ligne de routine, dans le même ordre : c'est ce qui
 * permet de les apparier par leur position dans ces deux listes, une seule fois, ici. Le bilan retrouve
 * ensuite sa ligne par cet identifiant, et non par un rang que la séance renumérote.
 */
function linkToRoutine(graph: WorkoutEntityGraph, source: WorkoutRoutineSource): WorkoutEntityGraph {
  return {
    ...graph,
    exercises: graph.exercises.map((row, index) => {
      const routineRow = source.rows[index];
      return routineRow === undefined ? row : { ...row, routineExerciseId: routineRow.id };
    }),
  };
}

/**
 * Lance un benchmark depuis une routine. Refuse quand une séance est déjà
 * ouverte (comme « Démarrer ») et quand la routine n'a aucun exercice.
 *
 * `goal` est le style choisi au lancement — léger, classique, force : la fourchette qu'on y vise. Sans lui, le
 * bilan lit la fourchette que la routine écrit sur chaque exercice.
 */
export async function startBenchmarkFromRoutine(
  routineId: string,
  name: string,
  goal?: BenchmarkGoal,
): Promise<Workout> {
  const source = await readWorkoutRoutineSource(routineId);
  if (source === null) throw new Error(`Routine introuvable : ${routineId}`);
  if (source.rows.length === 0) throw new Error(`Routine sans exercice : ${routineId}`);

  const built = buildWorkoutEntities({ source, startedAt: Date.now() });
  const reduced = reduceToBenchmark(linkToRoutine(built, source));
  const graph: WorkoutEntityGraph = {
    ...reduced,
    workout: {
      ...reduced.workout,
      name,
      kind: 'benchmark',
      ...(goal === undefined ? {} : { benchmarkGoal: goal }),
    },
  };

  await db.transaction('rw', db.workouts, db.workoutExercises, db.workoutSets, async () => {
    await assertNoActiveWorkout();
    await insertWorkoutEntities(graph);
  });

  return graph.workout;
}

export interface BenchmarkReport {
  workout: Workout;
  /** Le style choisi au lancement. Absent : la fourchette de la routine, exercice par exercice. */
  goal?: BenchmarkGoal;
  /** Absent quand la routine d'où est parti le benchmark n'existe plus. */
  routineName?: string;
  lines: BenchmarkLine[];
}

/**
 * La ligne de la routine qui correspond à un exercice de la séance.
 *
 * **Par l'identifiant posé au lancement**, et pour le même exercice : la séance renumérote ses rangs dès
 * qu'on retire, déplace ou remplace un exercice (et l'édition de l'historique aussi), donc un rang ne dit
 * plus quelle ligne de la routine on a devant soi. Rapprocher par exercice seul confondrait un exercice
 * présent deux fois. Si la routine a été modifiée depuis — la ligne supprimée, l'exercice changé —, rien
 * ne correspond et il n'y a rien à écrire : mieux vaut ne rien écrire que l'écrire à côté.
 *
 * Un benchmark lancé avant ce lien n'en porte pas : il retombe sur le rang, comme avant.
 */
function routineRowFor(
  row: WorkoutExercise,
  routineRows: readonly { id: string; exerciseId: string; order: number }[],
  setsByRow: ReadonlyMap<string, readonly RoutineSet[]>,
): BenchmarkRoutineRow | undefined {
  const match =
    row.routineExerciseId === undefined
      ? routineRows.find(
          (candidate) => candidate.exerciseId === row.exerciseId && candidate.order === row.order,
        )
      : routineRows.find(
          (candidate) =>
            candidate.id === row.routineExerciseId && candidate.exerciseId === row.exerciseId,
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
  const [sets, exercises, routine] = await Promise.all([
    rows.length === 0
      ? []
      : db.workoutSets
          .where('workoutExerciseId')
          .anyOf(rows.map((row) => row.id))
          .toArray(),
    db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]),
    workout.routineId === '' ? undefined : db.routines.get(workout.routineId),
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
  // Jamais un échauffement : sa charge n'est pas celle d'une série menée à l'échec, et l'offre
  // « Ton échauffement de la dernière fois » en met dans la séance. Un échauffement seul validé (la série
  // à l'échec jamais faite, supprimée à l'enregistrement) ne fait pas un essai : l'exercice est « non fait ».
  const completed = alive(sets).filter((set) => set.isCompleted === 1 && isWorkingSet(set));

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
        // Ce qui fatigue d'une série à l'autre : le repos prévu pour l'exercice (résolu à l'entrée en séance,
        // celui de la routine puis celui de l'exercice) et sa nature. Le benchmark n'a qu'une série par
        // exercice : il n'a aucun repos réel à mesurer, c'est celui des séries de travail qu'on dimensionne.
        restSeconds: row.restSeconds,
        ...(workout.benchmarkGoal === undefined ? {} : { goal: workout.benchmarkGoal }),
        exerciseClass: exerciseClass({
          ...(exercise?.movementPattern === undefined ? {} : { movementPattern: exercise.movementPattern }),
          ...(identity.primaryMuscle === undefined ? {} : { primaryMuscle: identity.primaryMuscle }),
          ...(identity.secondaryMuscles === undefined ? {} : { secondaryMuscles: identity.secondaryMuscles }),
        }),
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
    ...(workout.benchmarkGoal === undefined ? {} : { goal: workout.benchmarkGoal }),
    ...(livingRoutine === undefined ? {} : { routineName: livingRoutine.name }),
    lines,
  };
}

/**
 * Le coach lit le benchmark : pour chaque exercice dont la charge de la fourchette est fiable, il pose un
 * objectif de charge (`benchmark_calibrated`) — celui que la carte de l'exercice affichera à la prochaine
 * séance, et qu'un geste écrit sur les séries restantes.
 *
 * C'est le chemin des objectifs du coach, pas un autre : `recordCoachSignals` remplace l'objectif en attente
 * de l'exercice (« un objectif vivant à la fois »), et c'est lui qui le dit `superseded`, jamais refusé. Une
 * estimation approximative n'en pose pas (cf. `benchmarkSignal`) : l'objectif d'avant reste.
 *
 * Appelée à l'enregistrement de la séance, après sa clôture. N'écrit rien dans la routine : cela reste
 * l'acceptation du bilan.
 */
export async function recordBenchmarkObjectives(workoutId: string): Promise<CoachSignal[]> {
  const report = await loadBenchmarkReport(workoutId);
  if (report === null) return [];

  const signals = report.lines.flatMap((line) => benchmarkSignal(line) ?? []);
  await recordCoachSignals(signals, {
    workoutId,
    recommendedAt: report.workout.endedAt > 0 ? report.workout.endedAt : Date.now(),
  });
  return signals;
}

/** La série avec la fourchette de `zone` : `targetRepsMax` n'existe que sous une vraie fourchette. */
function withZone(set: RoutineSet, zone: RepZone): RoutineSet | undefined {
  const already =
    set.targetReps === zone.low && (set.targetRepsMax ?? set.targetReps) === zone.high;
  if (already) return undefined;

  const next: RoutineSet = { ...set, targetReps: zone.low };
  if (zone.high > zone.low) next.targetRepsMax = zone.high;
  else delete next.targetRepsMax;
  return touch(next, {});
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
 * Renvoie le nombre d'**exercices** réécrits, pas de séries. Quand le benchmark avait un style, les séries de
 * travail reçoivent aussi sa fourchette de répétitions (« 15 – 20 ») : la routine dit alors ce que la
 * personne a choisi de travailler, pas ce qu'elle disait avant.
 *
 * **Une charge, une seule source.** Un objectif de charge du coach resté en attente sur l'exercice
 * s'afficherait à côté de la cible que le benchmark vient d'écrire : deux chiffres pour un exercice. Il est
 * donc résolu, dans la même transaction que l'écriture et pour les seuls exercices réellement réécrits :
 * l'objectif que **ce** benchmark avait posé est `followed` — l'accepter, c'est le suivre —, tout autre est
 * `superseded`, qui n'est pas un refus. Les observations sans charge restent : le benchmark ne les contredit pas.
 */
export async function applyBenchmarkProposals(
  proposals: readonly BenchmarkProposal[],
  workoutId: string,
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

    // La fourchette du style choisi, avec la charge et sous la même garde : une proposition dont la série de
    // référence a changé n'est pas dans `current`, elle n'écrit donc pas non plus de répétitions.
    const zones = new Map<string, RepZone>();
    for (const proposal of current) {
      if (proposal.zone === undefined) continue;
      const { setIds, ...zone } = proposal.zone;
      for (const id of setIds) zones.set(id, zone);
    }
    if (zones.size > 0) {
      const rows = alive(
        (await db.routineSets.bulkGet([...zones.keys()])).flatMap((row) => (row === undefined ? [] : [row])),
      );
      const written = rows.flatMap((row) => {
        const next = withZone(row, zones.get(row.id)!);
        return next === undefined ? [] : [next];
      });
      if (written.length > 0) await db.routineSets.bulkPut(written);
    }

    if (current.length > 0) {
      const writtenKg = new Map(current.map((proposal) => [proposal.exerciseId, proposal.proposedWeight]));
      const now = Date.now();
      const pending = alive(
        await db.coachRecommendations.where('exerciseId').anyOf([...writtenKg.keys()]).toArray(),
      ).filter((row) => row.status === 'pending' && row.nextLoadKg !== undefined);
      if (pending.length > 0) {
        await db.coachRecommendations.bulkPut(
          pending.map((row) =>
            row.sourceWorkoutId === workoutId
              ? touch(row, {
                  status: 'followed',
                  resolvedAt: now,
                  outcomeWorkoutId: workoutId,
                  outcomeLoadKg: writtenKg.get(row.exerciseId),
                })
              : touch(row, { status: 'superseded', resolvedAt: now }),
          ),
        );
      }
    }

    // Des exercices, pas des séries : c'est ce que l'écran annonce. La série de
    // référence change toujours (une proposition alignée n'existe pas), donc
    // chaque proposition retenue est bien une ligne réécrite.
    return current.length;
  });
}
