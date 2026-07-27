import type {
  HevyCsvIssue,
  HevyParsedExercise,
  HevyParsedWorkout,
} from './hevyCsv';
import type { ValidHevyRow } from './hevyCsvValues';

interface WorkoutBuilder {
  row: ValidHevyRow;
  exerciseRows: Map<string, ValidHevyRow[]>;
}

function normalizeImportTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function makeHevyImportKey(
  title: string,
  startedAt: number,
  endedAt: number,
): string {
  return `hevy_csv:${startedAt}:${endedAt}:${normalizeImportTitle(title)}`;
}

export function buildHevyWorkouts(
  rows: readonly ValidHevyRow[],
): { workouts?: HevyParsedWorkout[]; issues: HevyCsvIssue[] } {
  const groups = new Map<string, WorkoutBuilder>();
  for (const row of rows) {
    const key = `${row.title}\u0000${row.startedAt}\u0000${row.endedAt}`;
    const workout = groups.get(key);
    if (workout === undefined) {
      groups.set(key, {
        row,
        exerciseRows: new Map([[row.exerciseTitle, [row]]]),
      });
      continue;
    }
    const exercise = workout.exerciseRows.get(row.exerciseTitle);
    if (exercise === undefined) {
      workout.exerciseRows.set(row.exerciseTitle, [row]);
    } else {
      exercise.push(row);
    }
  }

  const issues: HevyCsvIssue[] = [];
  const workouts = [...groups.values()].map(({ row, exerciseRows }) => {
    const supersetGroups = new Map<string, number>();
    const exercises = [...exerciseRows.entries()].map(
      ([sourceTitle, sourceRows], exerciseIndex): HevyParsedExercise => {
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
          ...(first.exerciseNotes === undefined
            ? {}
            : { notes: first.exerciseNotes }),
          sets,
        };
      },
    );

    return {
      title: row.title,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSeconds: Math.floor((row.endedAt - row.startedAt) / 1000),
      ...(row.description === undefined ? {} : { notes: row.description }),
      importKey: makeHevyImportKey(
        row.title,
        row.startedAt,
        row.endedAt,
      ),
      exercises,
    };
  });

  return issues.length === 0 ? { workouts, issues } : { issues };
}
