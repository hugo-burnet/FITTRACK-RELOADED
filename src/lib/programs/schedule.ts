import type { ProgramPosition } from './calendar';

/**
 * Un split peut s'étendre sur plusieurs semaines : c'est un **cycle**, qui se
 * répète sur toute la durée du bloc. Une semaine de split qui se répète est le
 * cas particulier d'un cycle d'une semaine — et c'est ce que lit toute ligne
 * écrite avant l'existence des cycles, sans migration.
 */
export const MAX_CYCLE_WEEKS = 4;

export interface ProgramScheduleRevisionInput {
  id: string;
  effectiveFromWeekIndex: number;
  createdAt: number;
  /** Semaines du cycle ; absent (ou illisible) = 1, la semaine qui se répète. */
  cycleWeeks?: number;
}

export interface ProgramScheduleEntryInput {
  id: string;
  revisionId: string;
  routineId: string;
  dayOfWeek: number;
  order: number;
  /** Semaine du cycle, à partir de 0 ; absent (ou illisible) = la première. */
  cycleWeek?: number;
}

export interface ProgramSessionCandidate {
  entryId: string;
  routineId: string;
  weekIndex: number;
  dayOfWeek: number;
  order: number;
  completed: boolean;
}

export type ProgramSessionPick =
  | { kind: 'today' | 'missed' | 'upcoming'; session: ProgramSessionCandidate }
  | { kind: 'next_week'; weekIndex: number }
  | { kind: 'none' };

/** Nombre de semaines du cycle d'une révision : 1 tant que la ligne n'en dit pas plus. */
export function cycleLength(revision: Pick<ProgramScheduleRevisionInput, 'cycleWeeks'>): number {
  const { cycleWeeks } = revision;
  return cycleWeeks !== undefined && Number.isInteger(cycleWeeks) && cycleWeeks >= 1
    ? cycleWeeks
    : 1;
}

/** Semaine du cycle à laquelle appartient une séance planifiée. */
export function entryCycleWeek(entry: Pick<ProgramScheduleEntryInput, 'cycleWeek'>): number {
  const { cycleWeek } = entry;
  return cycleWeek !== undefined && Number.isInteger(cycleWeek) && cycleWeek >= 0 ? cycleWeek : 0;
}

const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

/**
 * Où tombe une semaine du bloc dans le cycle de sa révision.
 *
 * Le cycle se compte **depuis la semaine où la révision prend effet**, pas
 * depuis le début du bloc : une révision écrite « à partir de la semaine 4 » doit
 * commencer par la première semaine de son cycle, quelle que soit la parité de la
 * semaine 4. C'est ce qui rend la lecture de l'éditeur honnête — la première
 * semaine qu'on y voit est celle qui sera jouée en premier.
 */
export function cyclePosition(
  revision: Pick<ProgramScheduleRevisionInput, 'effectiveFromWeekIndex' | 'cycleWeeks'>,
  weekIndex: number,
): number {
  return modulo(weekIndex - revision.effectiveFromWeekIndex, cycleLength(revision));
}

function compareScheduleEntries(
  left: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id'>,
  right: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id'>,
): number {
  return (
    left.dayOfWeek - right.dayOfWeek || left.order - right.order || left.id.localeCompare(right.id)
  );
}

function compareCycleEntries(
  left: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id' | 'cycleWeek'>,
  right: Pick<ProgramScheduleEntryInput, 'dayOfWeek' | 'order' | 'id' | 'cycleWeek'>,
): number {
  return entryCycleWeek(left) - entryCycleWeek(right) || compareScheduleEntries(left, right);
}

/** La révision en vigueur à une semaine : la plus tardive qui a déjà pris effet. */
function applicableRevision<TRevision extends ProgramScheduleRevisionInput>(
  revisions: readonly TRevision[],
  weekIndex: number,
): TRevision | undefined {
  let applicable: TRevision | undefined;

  for (const revision of revisions) {
    if (revision.effectiveFromWeekIndex > weekIndex) continue;
    if (
      applicable === undefined ||
      revision.effectiveFromWeekIndex > applicable.effectiveFromWeekIndex ||
      (revision.effectiveFromWeekIndex === applicable.effectiveFromWeekIndex &&
        (revision.createdAt > applicable.createdAt ||
          (revision.createdAt === applicable.createdAt &&
            revision.id.localeCompare(applicable.id) > 0)))
    ) {
      applicable = revision;
    }
  }

  return applicable;
}

/**
 * La révision applicable à une semaine, avec **toutes** les semaines de son
 * cycle. C'est la lecture de ce qui est possédé — les routines que le bloc
 * touche, la validité d'une activation — là où `resolveSchedule` ne rend que ce
 * qui se joue cette semaine-là.
 */
export function resolveRevision<
  TRevision extends ProgramScheduleRevisionInput,
  TEntry extends ProgramScheduleEntryInput,
>(
  revisions: readonly TRevision[],
  entries: readonly TEntry[],
  weekIndex: number,
): { revision: TRevision; entries: TEntry[] } | null {
  const revision = applicableRevision(revisions, weekIndex);
  if (revision === undefined) return null;

  return {
    revision,
    entries: entries
      .filter((entry) => entry.revisionId === revision.id)
      .slice()
      .sort(compareCycleEntries),
  };
}

/** Returns the sessions the applicable split plays during one program week. */
export function resolveSchedule<
  TRevision extends ProgramScheduleRevisionInput,
  TEntry extends ProgramScheduleEntryInput,
>(revisions: readonly TRevision[], entries: readonly TEntry[], weekIndex: number): TEntry[] {
  const resolved = resolveRevision(revisions, entries, weekIndex);
  if (resolved === null) return [];

  const position = cyclePosition(resolved.revision, weekIndex);
  return resolved.entries
    .filter((entry) => entryCycleWeek(entry) === position)
    .sort(compareScheduleEntries);
}

/**
 * Le split applicable à une semaine, **relu à partir d'elle** : le cycle est
 * tourné pour que cette semaine en soit la première.
 *
 * Une révision commence toujours par la première semaine de son cycle. Pour
 * écrire une révision « à partir de la semaine N » qui joue exactement ce que
 * jouait l'ancienne — la réparation d'une routine manquante n'a pas le droit de
 * décaler le cycle d'une semaine — il faut donc la réécrire tournée. L'éditeur
 * s'en sert pour la même raison : ce qu'on y voit est ce qui sera écrit.
 */
export function resolveSplitFrom<
  TRevision extends ProgramScheduleRevisionInput,
  TEntry extends ProgramScheduleEntryInput,
>(
  revisions: readonly TRevision[],
  entries: readonly TEntry[],
  weekIndex: number,
): { cycleWeeks: number; entries: Array<TEntry & { cycleWeek: number }> } {
  const resolved = resolveRevision(revisions, entries, weekIndex);
  if (resolved === null) return { cycleWeeks: 1, entries: [] };

  const length = cycleLength(resolved.revision);
  const position = cyclePosition(resolved.revision, weekIndex);

  return {
    cycleWeeks: length,
    entries: resolved.entries
      // Une séance rangée sous une semaine que le cycle n'a pas n'est jamais
      // jouée : la tourner la ferait réapparaître au mauvais endroit.
      .filter((entry) => entryCycleWeek(entry) < length)
      .map((entry) => ({ ...entry, cycleWeek: modulo(entryCycleWeek(entry) - position, length) }))
      .sort(compareCycleEntries),
  };
}

function compareCandidates(left: ProgramSessionCandidate, right: ProgramSessionCandidate): number {
  return compareScheduleEntries(
    { dayOfWeek: left.dayOfWeek, order: left.order, id: left.entryId },
    { dayOfWeek: right.dayOfWeek, order: right.order, id: right.entryId },
  );
}

function firstCandidate(
  candidates: readonly ProgramSessionCandidate[],
  predicate: (candidate: ProgramSessionCandidate) => boolean,
): ProgramSessionCandidate | undefined {
  return candidates.filter(predicate).slice().sort(compareCandidates)[0];
}

/**
 * Picks one suggested program session from a position calculated by
 * `programPosition`. The returned `next_week` sentinel leaves date resolution
 * to the caller, which owns the program's civil start date.
 */
export function pickProgramSession(
  candidates: readonly ProgramSessionCandidate[],
  position: ProgramPosition,
  durationWeeks: number,
): ProgramSessionPick {
  if (position.phase !== 'active') return { kind: 'none' };

  const unfinishedThisWeek = candidates.filter(
    (candidate) => candidate.weekIndex === position.weekIndex && !candidate.completed,
  );

  const today = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek === position.dayOfWeek,
  );
  if (today !== undefined) return { kind: 'today', session: today };

  const missed = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek < position.dayOfWeek,
  );
  if (missed !== undefined) return { kind: 'missed', session: missed };

  const upcoming = firstCandidate(
    unfinishedThisWeek,
    (candidate) => candidate.dayOfWeek > position.dayOfWeek,
  );
  if (upcoming !== undefined) return { kind: 'upcoming', session: upcoming };

  const nextWeekIndex = position.weekIndex + 1;
  if (nextWeekIndex < durationWeeks) return { kind: 'next_week', weekIndex: nextWeekIndex };

  return { kind: 'none' };
}
