import type { ProgramPosition } from './calendar';
import {
  resolveSchedule,
  type ProgramScheduleEntryInput,
  type ProgramScheduleRevisionInput,
} from './schedule';

export interface ProgramAdherenceInput {
  revisions: readonly ProgramScheduleRevisionInput[];
  entries: readonly ProgramScheduleEntryInput[];
  durationWeeks: number;
  position: ProgramPosition;
  /** Les créneaux joués : une séance terminée du programme, sa semaine et son créneau. */
  done: readonly { weekIndex: number; entryId: string }[];
}

export interface ProgramAdherence {
  /** Créneaux joués parmi ceux échus (`plannedToDate`). */
  doneToDate: number;
  /** Créneaux des semaines passées et des jours d'avant aujourd'hui, plus ceux déjà joués. */
  plannedToDate: number;
  doneTotal: number;
  /** Tous les créneaux du programme, de la première à la dernière semaine. */
  plannedTotal: number;
}

/**
 * Assiduité : créneaux joués sur créneaux prévus.
 *
 * **Pourquoi le jour ne compte pas pour « joué ».** Une séance du lundi faite le
 * mardi est une séance faite : l'assiduité mesure si on s'entraîne comme prévu,
 * pas si on est à l'heure. Seule la part « prévue à ce jour » regarde le jour,
 * et aujourd'hui n'y est pas encore dû : un créneau de ce soir n'est pas un
 * oubli. S'il est déjà joué (ou joué en avance), il entre des deux côtés, de
 * sorte que le numérateur ne dépasse jamais le dénominateur.
 *
 * Un créneau joué deux fois ne compte qu'une fois, et une séance qui renvoie à
 * un créneau que le programme ne prévoit plus cette semaine-là est ignorée.
 */
export function programAdherence(input: ProgramAdherenceInput): ProgramAdherence {
  const { revisions, entries, durationWeeks, position, done } = input;
  const doneKeys = new Set(done.map(({ weekIndex, entryId }) => `${weekIndex}:${entryId}`));

  let doneToDate = 0;
  let plannedToDate = 0;
  let doneTotal = 0;
  let plannedTotal = 0;

  for (let weekIndex = 0; weekIndex < durationWeeks; weekIndex += 1) {
    for (const entry of resolveSchedule(revisions, entries, weekIndex)) {
      const played = doneKeys.has(`${weekIndex}:${entry.id}`);
      const due =
        position.phase === 'after' ||
        (position.phase === 'active' &&
          (weekIndex < position.weekIndex ||
            (weekIndex === position.weekIndex && entry.dayOfWeek < position.dayOfWeek)));

      plannedTotal += 1;
      if (played) doneTotal += 1;
      if (due || played) {
        plannedToDate += 1;
        if (played) doneToDate += 1;
      }
    }
  }

  return { doneToDate, plannedToDate, doneTotal, plannedTotal };
}

/**
 * Le tonnage de chaque semaine du programme, de la première à la dernière : zéro
 * quand rien n'y a été joué. Le tonnage d'une séance vient de `workoutTotals`
 * (`lib/volumeSource.ts`), pas d'ici : une seule définition du tonnage dans l'app.
 */
export function programWeeklyTonnage(
  durationWeeks: number,
  sessions: readonly { weekIndex: number; tonnage: number }[],
): number[] {
  const weeks = Array.from({ length: durationWeeks }, () => 0);
  for (const { weekIndex, tonnage } of sessions) {
    if (weekIndex >= 0 && weekIndex < durationWeeks) weeks[weekIndex]! += tonnage;
  }
  return weeks.map((value) => Math.round(value * 100) / 100);
}
