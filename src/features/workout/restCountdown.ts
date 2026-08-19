import { announce } from '@/audio/announce';
import type { CueId } from '@/audio/cues';
import { nativeNotifications } from '@/platform/nativeNotifications';

/**
 * The last three seconds of a rest, counted out loud.
 *
 * **Why a countdown and not just an end.** A bell tells you the rest is over;
 * three ticks tell you it is *about to be*, which is the difference between
 * standing up when the timer rings and being under the bar when it does. The
 * cadence is the feature — the sentence at zero is the punctuation.
 *
 * **Scheduled together, on the audio clock.** The three ticks are queued in one
 * pass with `when` offsets rather than by three chained `setTimeout`s: a
 * countdown whose beats drift is heard as sloppy long before it is heard as
 * wrong, and the browser makes no promise about a timer's precision — least of
 * all a browser deciding whether to throttle the tab.
 */
const LEAD_MS = 3_000;

/** A tick left to play, with its offset in seconds from now. */
export interface CountdownTick {
  cue: CueId;
  when: number;
}

/**
 * The ticks still ahead of `now`. A rest armed with less than three seconds
 * left keeps the ticks it can honour rather than dropping the whole countdown:
 * "deux, un" is a countdown, silence is not.
 *
 * The 150 ms of slack absorbs a timer that fires a hair late — without it the
 * first tick is the one the countdown loses, every single time.
 */
export function countdownTicks(endsAt: number, now: number): CountdownTick[] {
  const ticks: CountdownTick[] = [];
  for (const second of [3, 2, 1] as const) {
    const at = endsAt - second * 1_000;
    if (at < now - 150) continue;
    ticks.push({ cue: `rest-${second}`, when: Math.max(0, (at - now) / 1_000) });
  }
  return ticks;
}

/**
 * Plays what is left of the countdown. Returns whether anything came out —
 * which is the app's proof that it is awake, audible, and holding the phone's
 * attention.
 */
export function fireCountdown(endsAt: number, now = Date.now()): boolean {
  let played = false;
  for (const tick of countdownTicks(endsAt, now)) {
    played = announce(tick.cue, tick.when) || played;
  }
  return played;
}

/**
 * Arms the countdown for a rest, and returns the cancel.
 *
 * **The stand-down.** A tick that actually sounded proves three things at once:
 * the audio context is running, the app is in the foreground, and the user has
 * the announcer on. In that state the scheduled Android notification is not a
 * safety net any more — it is a second alert one second behind the first, and
 * on Android a notification ducks the music where Web Audio mixes with it. So
 * the countdown takes the rest over and cancels it.
 *
 * It does so at T−3 s and not at the start of the rest: if the phone goes into
 * a pocket right after, three seconds is all that can be lost — against the
 * two minutes that standing the notification down early would have risked.
 */
export function armRestCountdown(endsAt: number, now = Date.now()): () => void {
  const id = setTimeout(
    () => {
      if (!fireCountdown(endsAt)) return;
      void nativeNotifications.standDownRest(endsAt);
    },
    Math.max(0, endsAt - LEAD_MS - now),
  );

  return () => clearTimeout(id);
}
