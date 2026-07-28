/**
 * The one thing the app needs to know about time zones, and deliberately the
 * only thing: a full IANA library is 30 kB of JavaScript for a single-user app
 * whose sessions all happen where its owner is standing.
 */

/**
 * Minutes to ADD to UTC to reach the local clock at `at` — `+120` for Paris in
 * summer.
 *
 * The sign is inverted from `Date.prototype.getTimezoneOffset()`, which reports
 * minutes to add to *local* to reach UTC and therefore reads backwards from
 * every ISO offset ever printed (`+02:00`). Inverting it once, here, is cheaper
 * than remembering to invert it at each call site.
 *
 * Read at the given instant, not at call time: the platform's zone database
 * knows that 15 January and 15 July do not share an offset, so a session
 * recorded last winter reports last winter's offset.
 */
export function localOffsetMinutes(at: number): number {
  return -new Date(at).getTimezoneOffset();
}
