import { useEffect } from 'react';
import { announce, primeAnnouncer } from '@/audio/announce';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import { nativeNotifications } from '@/platform/nativeNotifications';
import {
  claimNewRecords,
  recordAnnouncementKey,
  recordAnnouncementKeys,
} from './recordAnnouncements';
import { recordNotificationCopy } from './recordNotificationCopy';
import { claimWorkoutGreeting } from './workoutCues';

/**
 * Everything the session says out loud on its own, and the trace it leaves.
 *
 * Three effects that had nothing to do with the rest of the screen and
 * everything to do with each other: unlocking the audio, the greeting on
 * arrival, and the word for a record — each of them claimed once, outside the
 * component, so that leaving the screen and coming back is not a reason to hear
 * the whole session again.
 *
 * Everything the cue rules decide still lives upstream in `planCue`; what is
 * here is when the screen asks.
 */
export function useWorkoutAnnouncements(input: {
  workoutId: string | undefined;
  /** Sets already validated, and sets available — how the greeting knows it is early. */
  openedSets: number;
  availableSets: number;
  recordEntries: RecordTimelineEntry[] | undefined;
}): void {
  const { workoutId, openedSets, availableSets, recordEntries } = input;

  // Mobile browsers require a user gesture before later timer-driven audio.
  useEffect(() => {
    document.addEventListener('pointerdown', primeAnnouncer);
    return () => document.removeEventListener('pointerdown', primeAnnouncer);
  }, []);

  // Runs again when a first exercise is added or a set is validated. The
  // greeting is claimed once per workout id; an empty shell and a session
  // already under way are both silent.
  useEffect(() => {
    if (workoutId === undefined) return;
    // The tap that started the session happened on another screen, so this one
    // opens with no gesture of its own — but the document has one, and that is
    // what the browser actually requires.
    primeAnnouncer();
    if (claimWorkoutGreeting(workoutId, openedSets, availableSets)) announce('workout-started');
  }, [workoutId, openedSets, availableSets]);

  /**
   * Records arrive from the database a beat after the set that took them, so
   * the announcement watches the list rather than the validation. What has
   * already been said is remembered outside the component — leaving the screen
   * and coming back is not a reason to hear the whole session again; cf.
   * `recordAnnouncements`.
   *
   * One word for a batch, not one per record: three records taken by the same
   * set is one moment, and the announcer's cooldown would swallow the rest
   * anyway.
   */
  useEffect(() => {
    if (workoutId === undefined || recordEntries === undefined) return;
    const fresh = new Set(claimNewRecords(workoutId, recordAnnouncementKeys(recordEntries)));
    if (fresh.size === 0) return;

    announce('record-beaten');
    // And the written trace, on the phone, for later — RF-53. The card and the
    // voice both speak to somebody looking at the screen right now; this one is
    // for the glance at a lock screen two hours later. Silent by channel, so it
    // never becomes a second bell over the first.
    const copy = recordNotificationCopy(
      recordEntries.filter((entry) => {
        const key = recordAnnouncementKey(entry);
        return key !== undefined && fresh.has(key);
      }),
    );
    if (copy !== undefined) void nativeNotifications.notifyRecord(copy);
  }, [workoutId, recordEntries]);
}
