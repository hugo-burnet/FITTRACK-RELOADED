import type { Equipment, MeasurementType, SetType, Side } from '@/data/types';
import { serializeCsv } from './csvWriter';
import {
  FITTRACK_HEADERS,
  FRENCH_MONTH_LABELS,
  HEVY_HEADERS,
} from './hevyCsvValues';
import { shiftToOffset } from './timezone';

/**
 * Écrire le fichier que `hevyCsv` relit.
 *
 * Les 14 colonnes de Hevy, dans leur ordre, plus les colonnes `fittrack_*` que
 * ce format ne sait pas transporter (repos, côté, mesure, routine d'origine).
 * Un outil qui lit du Hevy lit ce fichier ; FitTrack, lui, y retrouve ce que
 * Hevy aurait perdu.
 *
 * Fonction pure : elle ne lit pas la base, elle reçoit ce qu'il faut écrire.
 * C'est ce qui rend l'aller-retour testable sans IndexedDB.
 */

export interface CsvExportSet {
  order: number;
  setType: SetType;
  side: Side;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}

export interface CsvExportExercise {
  title: string;
  /** 0 = pas de superset ; sinon le numéro de groupe dans la séance. */
  supersetGroup: number;
  notes?: string;
  restSeconds: number;
  measurementType: MeasurementType;
  equipment: Equipment;
  sets: CsvExportSet[];
}

export interface CsvExportWorkout {
  title: string;
  /** La routine dont la séance est issue. Absente pour une séance libre. */
  routineName?: string;
  startedAt: number;
  endedAt: number;
  /** Le fuseau où la séance a eu lieu, pour réécrire l'heure qu'il était. */
  timezoneOffsetMinutes?: number;
  notes?: string;
  exercises: CsvExportExercise[];
}

const MINUTE = 60_000;

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * `24 juil. 2026, 15:05` — le format que `parseLocalDate` relit, à la minute.
 *
 * L'heure est celle du fuseau où la séance a eu lieu, pas celle d'aujourd'hui :
 * c'est l'heure que l'app affiche partout ailleurs, et celle qu'un export Hevy
 * aurait contenue.
 */
export function formatHevyDate(at: number, offsetMinutes: number): string {
  const local = new Date(shiftToOffset(at, offsetMinutes));
  const month = FRENCH_MONTH_LABELS[local.getUTCMonth()];
  return (
    `${local.getUTCDate()} ${month} ${local.getUTCFullYear()}, ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
}

const number = (value: number): string => String(value);

/**
 * Le RPE que le format accepte : 6 à 10, par demi-points. Une valeur en dehors
 * est laissée vide plutôt qu'écrite — un fichier que l'app refuse de relire
 * serait un plus mauvais service rendu que la perte d'un chiffre aberrant.
 */
function rpeCell(rpe: number | undefined): string {
  if (rpe === undefined || rpe < 6 || rpe > 10 || !Number.isInteger(rpe * 2)) return '';
  return number(rpe);
}

/**
 * Le début et la fin, tronqués à la minute — la seule précision du format.
 *
 * La fin est forcée après le début : sans ça, une séance de moins d'une minute
 * s'écrit avec deux fois la même heure et l'import la rejette
 * (`invalid_workout_range`).
 */
function boundsOf(workout: CsvExportWorkout): { startedAt: number; endedAt: number } {
  const startedAt = Math.floor(workout.startedAt / MINUTE) * MINUTE;
  const endedAt = Math.max(
    Math.floor(workout.endedAt / MINUTE) * MINUTE,
    startedAt + MINUTE,
  );
  return { startedAt, endedAt };
}

export function serializeWorkoutsCsv(
  workouts: readonly CsvExportWorkout[],
): string {
  const rows: string[][] = [[...HEVY_HEADERS, ...FITTRACK_HEADERS]];

  for (const workout of workouts) {
    const offset = workout.timezoneOffsetMinutes ?? 0;
    const bounds = boundsOf(workout);
    const startTime = formatHevyDate(bounds.startedAt, offset);
    const endTime = formatHevyDate(bounds.endedAt, offset);

    for (const exercise of workout.exercises) {
      // `set_index` est renuméroté à partir de 0 : l'import refuse deux séries
      // du même rang dans un exercice, et l'ordre stocké peut avoir des trous
      // après des suppressions.
      exercise.sets.forEach((set, index) => {
        const distanceKm =
          set.distanceMeters === undefined ? undefined : set.distanceMeters / 1000;
        rows.push([
          workout.title,
          startTime,
          endTime,
          workout.notes ?? '',
          exercise.title,
          exercise.supersetGroup > 0 ? number(exercise.supersetGroup) : '',
          exercise.notes ?? '',
          number(index),
          set.setType,
          set.weight === undefined ? '' : number(set.weight),
          set.reps === undefined ? '' : number(set.reps),
          distanceKm === undefined ? '' : number(distanceKm),
          // Une distance sans durée est refusée à la relecture ; `0` la rend
          // lisible sans inventer un temps qui n'a pas été mesuré.
          set.durationSeconds === undefined
            ? distanceKm === undefined
              ? ''
              : '0'
            : number(set.durationSeconds),
          rpeCell(set.rpe),
          workout.routineName ?? '',
          number(exercise.restSeconds),
          exercise.measurementType,
          exercise.equipment,
          set.side,
        ]);
      });
    }
  }

  return serializeCsv(rows);
}
