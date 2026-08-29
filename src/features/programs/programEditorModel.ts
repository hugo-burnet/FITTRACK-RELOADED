import type { ProgramDetail } from '@/data/repositories/programs';
import { PROGRAM_PHASES } from '@/data/types';
import type { TranslationKey } from '@/i18n/fr';
import {
  MAX_LOAD_INDEX,
  MIN_LOAD_INDEX,
  applyProgramRecipe,
  programPosition,
  resolveSchedule,
} from '@/lib/programs';
import { ProgramRepositoryError } from '@/data/repositories/programs';
import type { ProgramBasicsDraft } from './ProgramBasicsStep';
import type { ProgramSplitDraftEntry } from './ProgramSplitStep';
import type { ProgramWeekDraft } from './ProgramWeeksStep';

const MIN_DURATION_WEEKS = 4;
const MAX_DURATION_WEEKS = 12;

export const emptySplit = (): ProgramSplitDraftEntry[] => [
  { routineId: '', dayOfWeek: 1, order: 0 },
];

/**
 * Le trajet de départ : une recette, pas une ligne plate.
 *
 * Huit semaines identiques à 100 %, c'était l'absence de périodisation proposée
 * par défaut dans l'écran qui n'existe que pour ça — ne rien toucher revenait à
 * répéter la même semaine jusqu'au bout. Hypertrophie pose
 * construction / progression / surcharge / décharge ; les trois boutons de
 * recette échangent le trajet et chaque semaine reste modifiable en dessous.
 */
export const defaultWeeks = (durationWeeks: number): ProgramWeekDraft[] =>
  applyProgramRecipe('hypertrophy', durationWeeks);

/** Keeps the week list as long as the block: extra weeks fall off, new ones start neutral. */
export function resizeWeeks(
  weeks: readonly ProgramWeekDraft[],
  durationWeeks: number,
): ProgramWeekDraft[] {
  const filler = defaultWeeks(durationWeeks);
  return filler.map((week, weekIndex) => weeks[weekIndex] ?? week);
}

export function formatLocalDate(timestamp: number): string {
  if (timestamp <= 0) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return 0;
  return date.getTime();
}

/** Renumbers `order` per weekday so two sessions on the same day never collide. */
export function orderedSplit(entries: readonly ProgramSplitDraftEntry[]): ProgramSplitDraftEntry[] {
  const orders = new Map<number, number>();
  return entries.map((entry) => {
    const order = orders.get(entry.dayOfWeek) ?? 0;
    orders.set(entry.dayOfWeek, order + 1);
    return { ...entry, order };
  });
}

export function splitForWeek(detail: ProgramDetail, weekIndex: number): ProgramSplitDraftEntry[] {
  const entries = resolveSchedule(
    detail.revisions.map(({ revision }) => revision),
    detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries),
    weekIndex,
  );
  return entries.length === 0
    ? emptySplit()
    : entries.map(({ routineId, dayOfWeek, order }) => ({ routineId, dayOfWeek, order }));
}

export function weeksForBlock(detail: ProgramDetail): ProgramWeekDraft[] {
  return detail.weeks.length === detail.program.durationWeeks
    ? detail.weeks.map(({ weekIndex, loadIndex, phase }) => ({ weekIndex, loadIndex, phase }))
    : defaultWeeks(detail.program.durationWeeks);
}

/**
 * Weeks a revision may take effect from: never before the latest revision,
 * never before the civil week, and not the current week once a session of the
 * block is recorded in it. The stacked editor seals the week list with the very
 * same boundary — one rule, read twice, rather than two rules that drift.
 */
export function effectiveWeekOptions(
  detail: ProgramDetail,
  programWorkoutWeekIndexes: readonly number[],
  at: number,
): number[] {
  const latestRevisionWeek = detail.revisions.reduce(
    (latest, { revision }) => Math.max(latest, revision.effectiveFromWeekIndex),
    -1,
  );
  const position = programPosition(detail.program.startsAt, detail.program.durationWeeks, at);
  if (position.phase === 'after') return [];
  const workoutWeeks = new Set(programWorkoutWeekIndexes);

  return Array.from({ length: detail.program.durationWeeks }, (_, weekIndex) => weekIndex).filter(
    (weekIndex) => {
      if (weekIndex < latestRevisionWeek) return false;
      if (position.phase !== 'active') return true;
      if (weekIndex < position.weekIndex) return false;
      return weekIndex !== position.weekIndex || !workoutWeeks.has(weekIndex);
    },
  );
}

/**
 * Ce qui manque, et rien d'autre.
 *
 * Un seul message couvrait six conditions : une date au mercredi redemandait le
 * nom et la durée, tous deux corrects, et ne disait nulle part que le départ
 * devait tomber un lundi. Le bouton restait vivant, on appuyait, et l'écran
 * répondait à côté.
 */
export function basicsIssue(basics: ProgramBasicsDraft): TranslationKey | null {
  if (basics.name.trim().length === 0) return 'program.errorBasicsName';
  if (basics.startsAt <= 0) return 'program.errorBasicsDate';
  if (new Date(basics.startsAt).getDay() !== 1) return 'program.errorBasicsMonday';
  if (
    !Number.isInteger(basics.durationWeeks) ||
    basics.durationWeeks < MIN_DURATION_WEEKS ||
    basics.durationWeeks > MAX_DURATION_WEEKS
  ) {
    return 'program.errorBasicsDuration';
  }
  return null;
}

export function splitIssue(split: readonly ProgramSplitDraftEntry[]): TranslationKey | null {
  const invalid =
    split.length === 0 ||
    split.some((entry) => entry.routineId === '' || entry.dayOfWeek < 1 || entry.dayOfWeek > 7);
  return invalid ? 'program.errorSplit' : null;
}

export function weeksIssue(
  weeks: readonly ProgramWeekDraft[],
  durationWeeks: number,
): TranslationKey | null {
  const phaseSet = new Set<string>(PROGRAM_PHASES);
  const invalidWeek = weeks.some(
    (week) =>
      !Number.isFinite(week.loadIndex) ||
      !Number.isInteger(week.loadIndex) ||
      week.loadIndex < MIN_LOAD_INDEX ||
      week.loadIndex > MAX_LOAD_INDEX ||
      !phaseSet.has(week.phase),
  );
  return weeks.length !== durationWeeks || invalidWeek ? 'program.errorWeeks' : null;
}

export function repositoryErrorKey(error: unknown): TranslationKey {
  if (error instanceof ProgramRepositoryError) {
    if (error.code === 'another_program_active') return 'program.errorAnotherActive';
    if (error.code === 'routine_missing') return 'program.errorRoutineMissing';
  }
  return 'program.errorSave';
}
