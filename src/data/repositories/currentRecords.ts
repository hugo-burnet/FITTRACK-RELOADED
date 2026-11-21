import type { PersonalRecordType } from '@/data/types';
import type { RecordTimelineEntry } from './recordTimeline';

/** Les records en cours d'un exercice, dans l'ordre où on les cherche. */
export interface ExerciseCurrentRecords {
  exerciseId: string;
  exerciseName: string;
  isUnilateral?: 0 | 1;
  entries: RecordTimelineEntry[];
}

/**
 * « C'est quoi mon max ? » demande l'ordre de lecture d'un athlète : la charge,
 * puis ce qu'elle vaut en 1RM, puis la série. Les types sans charge suivent.
 */
const TYPE_ORDER: readonly PersonalRecordType[] = [
  'max_weight',
  'max_added_weight',
  'min_assistance',
  'best_1rm',
  'max_volume_set',
  'max_reps',
  'max_volume_session',
  'max_duration',
  'max_distance',
];

const rank = (type: PersonalRecordType): number => {
  const index = TYPE_ORDER.indexOf(type);
  return index === -1 ? TYPE_ORDER.length : index;
};

/**
 * Les records en cours, exercice par exercice : le plus récent de chaque type.
 *
 * Fonction pure sur la chronologie (du plus récent au plus ancien) plutôt
 * qu'une seconde requête : l'écran a déjà cette liste, filtres compris, et un
 * second calcul pourrait la contredire. Un record n'est inscrit que s'il bat le
 * précédent, donc le plus récent d'un type est toujours son record en cours —
 * c'est ce que fait déjà `listCurrentRecordsForExercise`, étendu à tous les
 * exercices.
 */
export function currentRecordsByExercise(
  timeline: readonly RecordTimelineEntry[],
): ExerciseCurrentRecords[] {
  const groups = new Map<string, ExerciseCurrentRecords>();
  const seen = new Set<string>();

  for (const entry of timeline) {
    const { exerciseId, type } = entry.record;
    const key = `${exerciseId}\u0000${type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const group = groups.get(exerciseId);
    if (group === undefined) {
      groups.set(exerciseId, {
        exerciseId,
        exerciseName: entry.exerciseName,
        ...(entry.isUnilateral === undefined ? {} : { isUnilateral: entry.isUnilateral }),
        entries: [entry],
      });
    } else {
      group.entries.push(entry);
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort(
        (left, right) => rank(left.record.type) - rank(right.record.type),
      ),
    }))
    .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName, 'fr'));
}
