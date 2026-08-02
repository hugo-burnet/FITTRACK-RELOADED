import type { HevyCsvIssue, HevyParsedExercise, HevyParsedWorkout } from './hevyCsv';
import { externalExerciseIdentityKey } from './externalExerciseIdentity';
import type { ValidHevyRow } from './hevyCsvValues';

interface ExerciseBuilder {
  sourceTitle: string;
  rows: ValidHevyRow[];
}

interface WorkoutBuilder {
  row: ValidHevyRow;
  exercisesByIdentityKey: Map<string, ExerciseBuilder>;
}

function normalizeImportTitle(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export function makeHevyImportKey(title: string, startedAt: number, endedAt: number): string {
  return `hevy_csv:${startedAt}:${endedAt}:${normalizeImportTitle(title)}`;
}

export function buildHevyWorkouts(rows: readonly ValidHevyRow[]): {
  workouts?: HevyParsedWorkout[];
  issues: HevyCsvIssue[];
} {
  const groups = new Map<string, WorkoutBuilder>();
  for (const row of rows) {
    const key = `${row.title}\u0000${row.startedAt}\u0000${row.endedAt}`;
    const workout = groups.get(key);
    if (workout === undefined) {
      const identityKey = externalExerciseIdentityKey(row.exerciseTitle);
      groups.set(key, {
        row,
        exercisesByIdentityKey: new Map([
          [identityKey, { sourceTitle: row.exerciseTitle, rows: [row] }],
        ]),
      });
      continue;
    }
    const identityKey = externalExerciseIdentityKey(row.exerciseTitle);
    const exercise = workout.exercisesByIdentityKey.get(identityKey);
    if (exercise === undefined) {
      workout.exercisesByIdentityKey.set(identityKey, {
        sourceTitle: row.exerciseTitle,
        rows: [row],
      });
    } else {
      exercise.rows.push(row);
    }
  }

  const issues: HevyCsvIssue[] = [];
  const workouts = [...groups.values()].map(({ row, exercisesByIdentityKey }) => {
    const supersetGroups = new Map<string, number>();
    const exercises = [...exercisesByIdentityKey.values()].map(
      ({ sourceTitle, rows: sourceRows }, exerciseIndex): HevyParsedExercise => {
        const indexes = new Set<number>();
        for (const sourceRow of sourceRows) {
          if (indexes.has(sourceRow.set.order)) {
            issues.push({
              line: sourceRow.sourceLine,
              code: 'duplicate_set_index',
              field: 'set_index',
              value: String(sourceRow.set.order),
            });
          }
          indexes.add(sourceRow.set.order);
        }

        const first = sourceRows[0];
        if (first === undefined) {
          throw new Error('Hevy exercise group cannot be empty');
        }
        let supersetGroup = 0;
        if (first.sourceSupersetId !== undefined) {
          const existing = supersetGroups.get(first.sourceSupersetId);
          if (existing === undefined) {
            supersetGroup = supersetGroups.size + 1;
            supersetGroups.set(first.sourceSupersetId, supersetGroup);
          } else {
            supersetGroup = existing;
          }
        }

        const sets = sourceRows
          .map((sourceRow) => sourceRow.set)
          .sort((left, right) => left.order - right.order)
          .map((set, order) => ({ ...set, order }));
        return {
          sourceTitle,
          order: exerciseIndex,
          ...(first.sourceSupersetId === undefined
            ? {}
            : { sourceSupersetId: first.sourceSupersetId }),
          supersetGroup,
          ...(first.exerciseNotes === undefined ? {} : { notes: first.exerciseNotes }),
          // Les colonnes `fittrack_*` sont écrites sur chaque ligne de série ;
          // celles-ci décrivent l'exercice, donc la première ligne du groupe
          // fait foi — comme les notes et l'identifiant de superset au-dessus.
          ...(first.restSeconds === undefined ? {} : { restSeconds: first.restSeconds }),
          ...(first.measurementType === undefined
            ? {}
            : { measurementType: first.measurementType }),
          ...(first.equipment === undefined ? {} : { equipment: first.equipment }),
          sets,
        };
      },
    );

    return {
      title: row.title,
      ...(row.routineName === undefined ? {} : { routineName: row.routineName }),
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: Math.floor((row.endedAt - row.startedAt) / 1000),
      ...(row.description === undefined ? {} : { notes: row.description }),
      importKey: makeHevyImportKey(row.title, row.startedAt, row.endedAt),
      exercises,
    };
  });

  return issues.length === 0 ? { workouts, issues } : { issues };
}
