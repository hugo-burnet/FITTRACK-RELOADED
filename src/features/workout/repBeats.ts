import { announce } from '@/audio/announce';
import type { CueId } from '@/audio/cues';
import type { RepPacer } from '@/stores/repPacer';

/**
 * The beats of a paced set: one per repetition, plus the one that closes it.
 *
 * **The words land on the rep they name.** "Trois" is said as you start the
 * third rep from the end, not after finishing it — a countdown that reports
 * what just happened is a scoreboard, and a scoreboard does not help you push.
 *
 * **Derived from an absolute start, never accumulated.** Every beat is
 * `startedAt + n × repSeconds`, so a timer that fires late costs that one beat
 * and not the whole set's alignment. Same rule as the rest bar.
 */
export interface RepBeat {
  cue: CueId;
  /** Wall clock of the beat. */
  at: number;
}

export function repBeats(
  pacer: Pick<RepPacer, 'reps' | 'repSeconds' | 'startedAt'>,
  /**
   * Ce qui ferme la cadence. `set-done` par défaut — mais ses clips disent
   * « Validé. » et « Série terminée. », faux au milieu d'une série unilatérale
   * dont le premier côté se ferme par le changement de côté.
   */
  endCue: CueId = 'set-done',
): RepBeat[] {
  if (pacer.reps <= 0 || pacer.repSeconds <= 0) return [];

  const beats: RepBeat[] = [];
  for (let rep = 1; rep <= pacer.reps; rep += 1) {
    const remaining = pacer.reps - rep + 1;
    beats.push({
      cue: remaining <= 3 ? (`rep-${remaining}` as CueId) : 'rep-tick',
      at: pacer.startedAt + (rep - 1) * pacer.repSeconds * 1_000,
    });
  }
  beats.push({
    cue: endCue,
    at: pacer.startedAt + pacer.reps * pacer.repSeconds * 1_000,
  });
  return beats;
}

/** The beats still ahead. A pace armed late keeps the ones it can honour. */
export function pendingBeats(beats: readonly RepBeat[], now: number): RepBeat[] {
  return beats.filter((beat) => beat.at >= now - 150);
}

/**
 * Arms every remaining beat and returns the cancel.
 *
 * One timer per beat rather than one interval: an interval that drifts by
 * 20 ms a tick is 200 ms out by the tenth rep, which on a three-second tempo is
 * audible. Cancelling clears them all at once — racking the bar early must not
 * leave a "une… validé" hanging in the air.
 */
export function armRepPacer(
  pacer: Pick<RepPacer, 'reps' | 'repSeconds' | 'startedAt'>,
  onFinished: () => void,
  now = Date.now(),
  endCue: CueId = 'set-done',
): () => void {
  const timers = pendingBeats(repBeats(pacer, endCue), now).map((beat) =>
    setTimeout(
      () => {
        announce(beat.cue);
        if (beat.cue === endCue) onFinished();
      },
      Math.max(0, beat.at - now),
    ),
  );

  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
