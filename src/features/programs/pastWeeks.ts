import type { ProgramWorkoutReading } from '@/data/repositories/programHistory';
import type { ProgramWeek } from '@/data/types';
import {
  isoDayOfWeek,
  resolveSchedule,
  shiftLocalDate,
  type ProgramScheduleEntryInput,
  type ProgramScheduleRevisionInput,
} from '@/lib/programs';

export interface PastWeekRow {
  key: string;
  dayOfWeek: number;
  /** Le nom de la séance faite, ou celui de la routine prévue ; `null` : routine supprimée. */
  name: string | null;
  /** Le jour où elle a été faite, ou le jour où elle était prévue. */
  date: number;
  state: 'completed' | 'missed';
  /** Présents quand la séance a été faite : la fiche d'historique est `/history/:workoutId`. */
  workoutId?: string;
  tonnage?: number;
}

export interface PastWeek {
  week: ProgramWeek;
  /** Créneaux joués, sur créneaux prévus cette semaine-là. */
  done: number;
  planned: number;
  rows: PastWeekRow[];
}

interface Input {
  startsAt: number;
  weeks: readonly ProgramWeek[];
  revisions: readonly ProgramScheduleRevisionInput[];
  entries: readonly ProgramScheduleEntryInput[];
  workouts: readonly ProgramWorkoutReading[];
  routineNames: ReadonlyMap<string, string | null>;
  /** Les semaines d'avant celle-ci : celle qu'on affiche en grand n'est pas « passée ». */
  beforeWeekIndex: number;
}

/**
 * La frise des semaines écoulées, de la plus récente à la plus ancienne.
 *
 * Chaque créneau prévu devient une ligne : joué (il mène à sa séance), ou
 * manqué. Une séance qui ne répond à aucun créneau — le split a changé depuis,
 * ou un créneau a été lancé deux fois — reste une ligne jouée : la frise ne doit
 * jamais cacher une séance faite. Elle ne compte pas dans « 3 / 3 », qui mesure
 * le programme tenu, comme l'assiduité (`programAdherence`).
 */
export function buildPastWeeks(input: Input): PastWeek[] {
  const { startsAt, weeks, revisions, entries, workouts, routineNames, beforeWeekIndex } = input;

  return weeks
    .filter((week) => week.weekIndex < beforeWeekIndex)
    .sort((left, right) => right.weekIndex - left.weekIndex)
    .map((week) => {
      const planned = resolveSchedule(revisions, entries, week.weekIndex);
      const sessions = workouts.filter((workout) => workout.weekIndex === week.weekIndex);
      const unused = new Set(sessions);
      const rows: PastWeekRow[] = [];
      let done = 0;

      for (const entry of planned) {
        const played = sessions.find(
          (workout) => unused.has(workout) && workout.entryId === entry.id,
        );
        if (played === undefined) {
          rows.push({
            key: entry.id,
            dayOfWeek: entry.dayOfWeek,
            name: routineNames.get(entry.routineId) ?? null,
            date: shiftLocalDate(startsAt, week.weekIndex * 7 + entry.dayOfWeek - 1),
            state: 'missed',
          });
          continue;
        }
        unused.delete(played);
        done += 1;
        rows.push(completedRow(played));
      }
      for (const workout of unused) rows.push(completedRow(workout));

      return {
        week,
        done,
        planned: planned.length,
        // Jour, puis moment : le tri est stable, les créneaux gardent leur ordre au sein d'un jour.
        rows: rows.sort(
          (left, right) => left.dayOfWeek - right.dayOfWeek || left.date - right.date,
        ),
      };
    });
}

function completedRow(workout: ProgramWorkoutReading): PastWeekRow {
  return {
    key: workout.workoutId,
    dayOfWeek: isoDayOfWeek(workout.startedAt),
    name: workout.name,
    date: workout.startedAt,
    state: 'completed',
    workoutId: workout.workoutId,
    tonnage: workout.tonnage,
  };
}
