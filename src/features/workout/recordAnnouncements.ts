import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';

/**
 * What the voice has already said about the records of a session.
 *
 * Records arrive from the database a beat after the set that took them, so the
 * announcement watches the list rather than the validation. That works while
 * the screen stays mounted — and the screen does not stay mounted: adding an
 * exercise, opening a chart, glancing at the history all leave the workout and
 * come back to a component with no memory. The reference then had to be built
 * again from the list, and everything already on it read as new: the whole
 * session's records announced in a row, out of a screen change.
 *
 * So the memory is module-level, like `claimWorkoutGreeting`, and dies with the
 * page: a session resumed after a kill is greeted again, which is right for the
 * one case where the app could not have said anything at all.
 *
 * **The key is the record, not its row.** `exerciseId:type:value` survives the
 * reconciliation that rewrites a projected record in place, where the row id
 * would not. Two records with the same value on the same exercise are the same
 * record — announcing it once is the point.
 */
const announced = new Map<string, Set<string>>();

/** `undefined` for a first record: it beats nothing, so it announces nothing. */
export function recordAnnouncementKey(entry: RecordTimelineEntry): string | undefined {
  if (entry.previousValue === undefined) return undefined;
  return `${entry.record.exerciseId}:${entry.record.type}:${String(entry.record.value)}`;
}

export function recordAnnouncementKeys(
  entries: readonly RecordTimelineEntry[],
): string[] {
  return entries
    .map(recordAnnouncementKey)
    .filter((key): key is string => key !== undefined);
}

/**
 * Claims the records that deserve a word, and remembers them.
 *
 * The **first** reading of a workout is its past, and is never announced:
 * reopening a session that already broke three records is not breaking them
 * again. Every later reading answers with the records it adds.
 *
 * The keys come back rather than their count: the voice only needs to know that
 * *something* fell, but the notification has to name it, and claiming twice —
 * once per audience — would leave the second one empty.
 */
export function claimNewRecords(workoutId: string, keys: readonly string[]): string[] {
  const known = announced.get(workoutId);
  if (known === undefined) {
    // Only ever one workout is active, and the memory is not a cache: dropping
    // the others keeps it from growing across a day of sessions.
    announced.clear();
    announced.set(workoutId, new Set(keys));
    return [];
  }

  const fresh: string[] = [];
  for (const key of keys) {
    if (known.has(key)) continue;
    known.add(key);
    fresh.push(key);
  }
  return fresh;
}

/** Only for the tests: the memory is a module singleton by design. */
export function forgetRecordAnnouncements(): void {
  announced.clear();
}
