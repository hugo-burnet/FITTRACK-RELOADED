import { db } from '@/data/db';
import { alive, newEntity } from '@/data/repositories/base';
import type { Routine, RoutineExercise, RoutineSet } from '@/data/types';
import { normalizeSupersets } from '@/lib/routineOrder';

/**
 * RF-15 — routines prêtes à l'emploi.
 *
 * Bundled content, **not a seed**, and the difference is the whole design. The
 * exercise catalogue re-installs itself on every startup; running these the
 * same way would make "Poussée" reappear every time the user deletes it. Lot 2
 * already drew the line and it applies unchanged: the catalogue belongs to the
 * app and always comes back, what the user composes belongs to them and never
 * does.
 *
 * So a template is offered as a *choice*, and produces an ordinary routine —
 * editable, and deletable for good.
 *
 * The French names live here rather than in `i18n/fr.ts`, exactly as the
 * catalogue's exercise names do: this is content, not interface chrome.
 */
export interface RoutineTemplate {
  key: string;
  name: string;
  description: string;
  exercises: {
    /** Catalogue key. A test checks every one of them resolves. */
    slug: string;
    sets: number;
    reps?: number;
    repsMax?: number;
    /** Same number on consecutive entries = one superset (RF-14). */
    superset?: number;
  }[];
}

/**
 * No target load anywhere: nobody can know what you bench, and a made-up figure
 * would be the one thing on the screen that lies. Rep ranges, on the other hand,
 * are what the programme actually prescribes.
 */
export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    key: 'ppl-push',
    name: 'Poussée',
    description: 'Pectoraux, épaules, triceps. Le premier jour d’un Push / Pull / Legs.',
    exercises: [
      { slug: 'barbell-bench-press', sets: 4, reps: 6, repsMax: 8 },
      { slug: 'dumbbell-incline-bench-press', sets: 3, reps: 8, repsMax: 12 },
      { slug: 'barbell-overhead-press', sets: 3, reps: 6, repsMax: 10 },
      { slug: 'machine-chest-press', sets: 3, reps: 10, repsMax: 15 },
      // Épaules et triceps en alternance : deux accessoires qui ne se gênent pas.
      { slug: 'dumbbell-lateral-raise', sets: 3, reps: 12, repsMax: 20, superset: 1 },
      { slug: 'cable-triceps-pushdown-rope', sets: 3, reps: 10, repsMax: 15, superset: 1 },
    ],
  },
  {
    key: 'ppl-pull',
    name: 'Tirage',
    description: 'Dos, arrière d’épaules, biceps. Le deuxième jour d’un Push / Pull / Legs.',
    exercises: [
      { slug: 'pull-up', sets: 4, reps: 5, repsMax: 10 },
      { slug: 'barbell-row', sets: 4, reps: 6, repsMax: 10 },
      { slug: 'seated-cable-row', sets: 3, reps: 8, repsMax: 12 },
      { slug: 'face-pull', sets: 3, reps: 12, repsMax: 20 },
      { slug: 'barbell-curl', sets: 3, reps: 8, repsMax: 12 },
      { slug: 'hammer-curl', sets: 3, reps: 10, repsMax: 15 },
    ],
  },
  {
    key: 'ppl-legs',
    name: 'Jambes',
    description: 'Quadriceps, ischios, fessiers, mollets. Le troisième jour d’un Push / Pull / Legs.',
    exercises: [
      { slug: 'barbell-back-squat', sets: 4, reps: 5, repsMax: 8 },
      { slug: 'romanian-deadlift', sets: 3, reps: 8, repsMax: 12 },
      { slug: 'leg-press', sets: 3, reps: 10, repsMax: 15 },
      { slug: 'lying-leg-curl', sets: 3, reps: 10, repsMax: 15 },
      { slug: 'standing-calf-raise', sets: 4, reps: 12, repsMax: 20 },
      { slug: 'hanging-knee-raise', sets: 3, reps: 10, repsMax: 15 },
    ],
  },
  {
    key: 'full-body',
    name: 'Full-body',
    description: 'Tout le corps en une séance. À répéter trois fois par semaine.',
    exercises: [
      { slug: 'barbell-back-squat', sets: 3, reps: 5, repsMax: 8 },
      { slug: 'barbell-bench-press', sets: 3, reps: 5, repsMax: 8 },
      { slug: 'barbell-row', sets: 3, reps: 6, repsMax: 10 },
      { slug: 'barbell-overhead-press', sets: 3, reps: 8, repsMax: 12 },
      { slug: 'romanian-deadlift', sets: 3, reps: 8, repsMax: 12 },
    ],
  },
  /**
   * The 5×5 ships as a pair. Half a programme is not a starting point: you
   * alternate A and B, and a lone A never gets you under a deadlift.
   */
  {
    key: 'five-by-five-a',
    name: '5×5 — A',
    description: 'Force, séance A. Cinq séries de cinq, à alterner avec la séance B.',
    exercises: [
      { slug: 'barbell-back-squat', sets: 5, reps: 5 },
      { slug: 'barbell-bench-press', sets: 5, reps: 5 },
      { slug: 'barbell-row', sets: 5, reps: 5 },
    ],
  },
  {
    key: 'five-by-five-b',
    name: '5×5 — B',
    description: 'Force, séance B. Le soulevé de terre se fait en une seule série lourde.',
    exercises: [
      { slug: 'barbell-back-squat', sets: 5, reps: 5 },
      { slug: 'barbell-overhead-press', sets: 5, reps: 5 },
      { slug: 'conventional-deadlift', sets: 1, reps: 5 },
    ],
  },
];

/**
 * Turns a template into a real routine the user owns.
 *
 * An exercise the user has deleted from their library is skipped rather than
 * blocking the whole template — and `normalizeSupersets` then dissolves any
 * superset that skip left with a single member.
 */
export async function instantiateTemplate(template: RoutineTemplate): Promise<Routine> {
  return db.transaction(
    'rw',
    db.exercises,
    db.routines,
    db.routineExercises,
    db.routineSets,
    async () => {
      const idBySlug = new Map<string, string>();
      await db.exercises.each((exercise) => {
        if (exercise.slug !== undefined && exercise.deletedAt === 0) {
          idBySlug.set(exercise.slug, exercise.id);
        }
      });

      const order = alive(await db.routines.toArray()).length;
      const routine = newEntity<Routine>({
        name: template.name,
        folderId: '',
        order,
        version: 1,
      });

      const entries = template.exercises.flatMap((entry) => {
        const exerciseId = idBySlug.get(entry.slug);
        return exerciseId === undefined ? [] : [{ ...entry, exerciseId }];
      });

      const rows = normalizeSupersets(
        entries.map((entry, index) =>
          newEntity<RoutineExercise>({
            routineId: routine.id,
            exerciseId: entry.exerciseId,
            order: index,
            supersetGroup: entry.superset ?? 0,
            restSeconds: 0,
          }),
        ),
      );

      const sets = rows.flatMap((row, index) =>
        Array.from({ length: entries[index]?.sets ?? 0 }, (_unused, setIndex) =>
          newEntity<RoutineSet>({
            routineExerciseId: row.id,
            order: setIndex,
            setType: 'normal',
            targetReps: entries[index]?.reps,
            targetRepsMax: entries[index]?.repsMax,
          }),
        ),
      );

      await db.routines.add(routine);
      await db.routineExercises.bulkAdd(rows);
      await db.routineSets.bulkAdd(sets);
      return routine;
    },
  );
}
