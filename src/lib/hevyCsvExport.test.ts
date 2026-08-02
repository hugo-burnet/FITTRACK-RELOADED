import { describe, expect, it } from 'vitest';
import { parseHevyCsv } from './hevyCsv';
import { readCsvRows } from './hevyCsvRows';
import { FITTRACK_HEADERS, HEVY_HEADERS } from './hevyCsvValues';
import { serializeWorkoutsCsv, type CsvExportWorkout } from './hevyCsvExport';

/** 24 juillet 2026, 15:05 à Paris (UTC+2). */
const STARTED = Date.UTC(2026, 6, 24, 13, 5);
const PARIS = 120;

const workout = (overrides: Partial<CsvExportWorkout> = {}): CsvExportWorkout => ({
  title: 'LOWER A',
  routineName: 'LOWER A',
  startedAt: STARTED,
  endedAt: STARTED + 3_600_000,
  timezoneOffsetMinutes: PARIS,
  exercises: [
    {
      title: 'Presse à cuisses',
      supersetGroup: 0,
      restSeconds: 90,
      measurementType: 'weight_reps',
      equipment: 'machine',
      sets: [
        { order: 0, setType: 'normal', side: 'both', weight: 47.5, reps: 12 },
      ],
    },
  ],
  ...overrides,
});

const cellsOf = (csv: string): string[][] => {
  const read = readCsvRows(csv);
  if (!read.ok) throw new Error('CSV illisible');
  return read.rows.map((row) => row.cells);
};

const columnOf = (csv: string, header: string): string[] => {
  const [headers, ...rows] = cellsOf(csv);
  const index = headers!.indexOf(header);
  return rows.map((row) => row[index]!);
};

describe('serializeWorkoutsCsv', () => {
  it('écrit les 14 colonnes de Hevy puis les colonnes fittrack', () => {
    expect(cellsOf(serializeWorkoutsCsv([workout()]))[0]).toEqual([
      ...HEVY_HEADERS,
      ...FITTRACK_HEADERS,
    ]);
  });

  it('écrit les dates dans le fuseau de la séance, au format de Hevy', () => {
    const csv = serializeWorkoutsCsv([workout()]);

    expect(columnOf(csv, 'start_time')).toEqual(['24 juil. 2026, 15:05']);
    expect(columnOf(csv, 'end_time')).toEqual(['24 juil. 2026, 16:05']);
  });

  it('écrit une ligne par série, avec les valeurs de la série', () => {
    const csv = serializeWorkoutsCsv([
      workout({
        exercises: [
          {
            title: 'Presse à cuisses',
            supersetGroup: 2,
            notes: 'Siège en 4',
            restSeconds: 90,
            measurementType: 'weight_reps',
            equipment: 'machine',
            sets: [
              { order: 0, setType: 'warmup', side: 'both', weight: 40, reps: 10 },
              { order: 1, setType: 'normal', side: 'left', weight: 47.5, reps: 12, rpe: 8.5 },
            ],
          },
        ],
      }),
    ]);

    expect(columnOf(csv, 'set_index')).toEqual(['0', '1']);
    expect(columnOf(csv, 'set_type')).toEqual(['warmup', 'normal']);
    expect(columnOf(csv, 'weight_kg')).toEqual(['40', '47.5']);
    expect(columnOf(csv, 'rpe')).toEqual(['', '8.5']);
    expect(columnOf(csv, 'superset_id')).toEqual(['2', '2']);
    expect(columnOf(csv, 'exercise_notes')).toEqual(['Siège en 4', 'Siège en 4']);
    expect(columnOf(csv, 'fittrack_side')).toEqual(['both', 'left']);
    expect(columnOf(csv, 'fittrack_rest_seconds')).toEqual(['90', '90']);
  });

  it('convertit les mètres en kilomètres', () => {
    const csv = serializeWorkoutsCsv([
      workout({
        exercises: [
          {
            title: 'Rameur',
            supersetGroup: 0,
            restSeconds: 60,
            measurementType: 'distance_time',
            equipment: 'machine',
            sets: [
              { order: 0, setType: 'normal', side: 'both', distanceMeters: 2500, durationSeconds: 600 },
            ],
          },
        ],
      }),
    ]);

    expect(columnOf(csv, 'distance_km')).toEqual(['2.5']);
    expect(columnOf(csv, 'duration_seconds')).toEqual(['600']);
  });

  it('laisse vide la routine d’une séance libre', () => {
    const csv = serializeWorkoutsCsv([workout({ routineName: undefined })]);

    expect(columnOf(csv, 'fittrack_routine')).toEqual(['']);
  });

  it('n’écrit rien pour un exercice sans série, ni pour une séance sans ligne', () => {
    const csv = serializeWorkoutsCsv([
      workout({
        exercises: [
          {
            title: 'Presse à cuisses',
            supersetGroup: 0,
            restSeconds: 90,
            measurementType: 'weight_reps',
            equipment: 'machine',
            sets: [],
          },
        ],
      }),
    ]);

    // L'en-tête et rien d'autre : le format de Hevy n'a pas de ligne pour un
    // exercice vide, et une séance sans série validée n'a rien à dire.
    expect(cellsOf(csv)).toHaveLength(1);
  });

  /**
   * Le format de Hevy n'a pas de secondes : une séance de 40 s se relit comme
   * une séance qui finit avant d'avoir commencé, et l'import la refuse. La
   * dernière minute est arrondie vers le haut pour que le fichier reste lisible.
   */
  it('garde une fin après le début même pour une séance très courte', () => {
    const csv = serializeWorkoutsCsv([
      workout({ startedAt: STARTED, endedAt: STARTED + 40_000 }),
    ]);

    expect(columnOf(csv, 'start_time')).toEqual(['24 juil. 2026, 15:05']);
    expect(columnOf(csv, 'end_time')).toEqual(['24 juil. 2026, 15:06']);
  });

  it('se relit par l’import, avec ce que les colonnes fittrack transportent', () => {
    const result = parseHevyCsv(serializeWorkoutsCsv([workout()]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [parsed] = result.data.workouts;
    expect(parsed).toMatchObject({ title: 'LOWER A', routineName: 'LOWER A' });
    expect(parsed?.exercises[0]).toMatchObject({
      sourceTitle: 'Presse à cuisses',
      restSeconds: 90,
      measurementType: 'weight_reps',
      equipment: 'machine',
    });
    expect(parsed?.exercises[0]?.sets[0]).toMatchObject({
      side: 'both',
      weight: 47.5,
      reps: 12,
    });
    expect(result.data.sourceExercises[0]).toMatchObject({
      measurementType: 'weight_reps',
      equipment: 'machine',
    });
  });

  it('reste lisible quand les textes portent virgules, guillemets et sauts de ligne', () => {
    const result = parseHevyCsv(
      serializeWorkoutsCsv([
        workout({
          title: 'Jambes, lourd',
          notes: 'Genou "gauche"\nà surveiller',
        }),
      ]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workouts[0]).toMatchObject({
      title: 'Jambes, lourd',
      notes: 'Genou "gauche"\nà surveiller',
    });
  });
});
