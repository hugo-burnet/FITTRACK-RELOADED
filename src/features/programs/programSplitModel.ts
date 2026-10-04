import type { ProgramDetail } from '@/data/repositories/programs';
import type { TranslationKey } from '@/i18n/fr';
import { resolveSplitFrom } from '@/lib/programs';
import type { ProgramSplitDraft, ProgramSplitDraftEntry } from './ProgramSplitStep';

/**
 * The draft of a block's split, as the editor holds it: a cycle of one to four
 * weeks and its sessions. Pure functions the editor screen and its split step
 * share — kept apart from the rest of the editor model (basics, weeks, errors)
 * because the split is the part that grew a shape of its own.
 */

export const emptySplit = (): ProgramSplitDraft => ({
  cycleWeeks: 1,
  entries: [{ routineId: '', dayOfWeek: 1, order: 0, cycleWeek: 0 }],
});


/**
 * Renumbers `order` per weekday **inside each week of the cycle**, so two
 * sessions on the same day never collide — and Monday of week 1 never collides
 * with Monday of week 2, which is another Monday.
 */
export function orderedSplit(entries: readonly ProgramSplitDraftEntry[]): ProgramSplitDraftEntry[] {
  const orders = new Map<string, number>();
  return entries.map((entry) => {
    const slot = `${entry.cycleWeek}:${entry.dayOfWeek}`;
    const order = orders.get(slot) ?? 0;
    orders.set(slot, order + 1);
    return { ...entry, order };
  });
}

/**
 * Changes the length of the cycle without losing a session.
 *
 * Shortening folds the sessions of the weeks that disappear into the last one
 * that remains: a tap on a chip must not silently delete what took a dozen
 * taps to place. The list stays sorted by week — the editor numbers sessions
 * by position, and position has to follow what is on screen.
 */
export function resizeCycle(split: ProgramSplitDraft, cycleWeeks: number): ProgramSplitDraft {
  const lastWeek = cycleWeeks - 1;
  const entries = split.entries
    .map((entry) => (entry.cycleWeek > lastWeek ? { ...entry, cycleWeek: lastWeek } : entry))
    // `sort` is stable: inside a week, sessions keep the order they were listed in.
    .sort((left, right) => left.cycleWeek - right.cycleWeek);
  return { cycleWeeks, entries };
}

/** Adds an empty session at the end of one week of the cycle, the list staying sorted by week. */
export function addSplitSession(split: ProgramSplitDraft, cycleWeek: number): ProgramSplitDraft {
  let insertAt = 0;
  split.entries.forEach((entry, index) => {
    if (entry.cycleWeek <= cycleWeek) insertAt = index + 1;
  });

  return {
    ...split,
    entries: [
      ...split.entries.slice(0, insertAt),
      { routineId: '', dayOfWeek: 1, order: 0, cycleWeek },
      ...split.entries.slice(insertAt),
    ],
  };
}

/**
 * Adds a whole folder to one week of the cycle: one session per routine, in the
 * folder's order, on consecutive days.
 *
 * Placing ten sessions one by one is a dozen taps each — a day, a routine, a
 * week. A folder is usually *already* the shape of a week (the "UL" folder is
 * the upper/lower week), so one tap lays it down and the days are adjusted
 * afterwards, where the plan differs from a Monday-to-Friday run.
 *
 * - Sessions of that week that still have no routine are placeholders, not
 *   choices: the folder takes their place. Otherwise the very first use would
 *   leave an empty "Séance 1" behind it, which "Continuer" then refuses.
 * - The days start the day after the last one the week already uses, and come
 *   back to Monday after Sunday — two sessions on one day is a legitimate plan.
 */
export function addFolderSessions(
  split: ProgramSplitDraft,
  cycleWeek: number,
  routineIds: readonly string[],
): ProgramSplitDraft {
  if (routineIds.length === 0) return split;

  const kept = split.entries.filter(
    (entry) => entry.cycleWeek !== cycleWeek || entry.routineId !== '',
  );
  const usedDays = kept.filter((entry) => entry.cycleWeek === cycleWeek).map((entry) => entry.dayOfWeek);
  const firstDay = usedDays.length === 0 ? 1 : (Math.max(...usedDays) % 7) + 1;

  let insertAt = 0;
  kept.forEach((entry, index) => {
    if (entry.cycleWeek <= cycleWeek) insertAt = index + 1;
  });

  const added = routineIds.map((routineId, index) => ({
    routineId,
    dayOfWeek: ((firstDay - 1 + index) % 7) + 1,
    order: 0,
    cycleWeek,
  }));

  return { ...split, entries: [...kept.slice(0, insertAt), ...added, ...kept.slice(insertAt)] };
}

/** One line of the "add a folder" sheet. `name: null` is the root, « Sans dossier ». */
export interface SplitFolderChoice {
  folderId: string;
  name: string | null;
  routineIds: string[];
}

/**
 * The folders worth offering: those that hold a routine, in library order, each
 * with its routines in their own order. The routines without folder come last —
 * and only once folders exist: with none, "without folder" is simply every
 * routine, and the single-session picker already is the way to choose one.
 */
export function splitFolderChoices(
  folders: readonly { id: string; name: string }[],
  routines: readonly { routine: { id: string; folderId: string; order: number } }[],
): SplitFolderChoice[] {
  if (folders.length === 0) return [];

  const routineIdsIn = (folderId: string): string[] =>
    routines
      .filter(({ routine }) => routine.folderId === folderId)
      .sort((left, right) => left.routine.order - right.routine.order)
      .map(({ routine }) => routine.id);

  const choices: SplitFolderChoice[] = folders
    .map((folder) => ({ folderId: folder.id, name: folder.name, routineIds: routineIdsIn(folder.id) }))
    .filter((choice) => choice.routineIds.length > 0);

  const loose = routineIdsIn('');
  return loose.length > 0 ? [...choices, { folderId: '', name: null, routineIds: loose }] : choices;
}

/**
 * The split as it will play **from** a week: the cycle turned so that week comes
 * first. A revision always starts at its own first week, so what the editor
 * shows has to be what that week plays — or saving would shift the cycle.
 */
export function splitForWeek(detail: ProgramDetail, weekIndex: number): ProgramSplitDraft {
  const split = resolveSplitFrom(
    detail.revisions.map(({ revision }) => revision),
    detail.revisions.flatMap(({ entries: revisionEntries }) => revisionEntries),
    weekIndex,
  );
  return split.entries.length === 0
    ? emptySplit()
    : {
        cycleWeeks: split.cycleWeeks,
        entries: split.entries.map(({ routineId, dayOfWeek, order, cycleWeek }) => ({
          routineId,
          dayOfWeek,
          order,
          cycleWeek,
        })),
      };
}

export function splitIssue(split: ProgramSplitDraft): TranslationKey | null {
  const invalid =
    split.entries.length === 0 ||
    split.entries.some(
      (entry) =>
        entry.routineId === '' ||
        entry.dayOfWeek < 1 ||
        entry.dayOfWeek > 7 ||
        // Une semaine du cycle peut rester vide — un repos complet —, mais une
        // séance ne peut pas être rangée sous une semaine qui n'existe pas.
        entry.cycleWeek < 0 ||
        entry.cycleWeek >= split.cycleWeeks,
    );
  return invalid ? 'program.errorSplit' : null;
}
