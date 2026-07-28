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

/**
 * The instant moved so that reading it **as UTC** gives the local clock at
 * `offsetMinutes`.
 *
 * This detour exists because `Intl.DateTimeFormat` accepts a zone *name* and
 * never a raw offset: there is no `timeZone: '+02:00'`. A session carries an
 * offset, not a zone — deliberately, cf. the header of this module — so the only
 * way to format it is to shift the instant and then format with `timeZone:
 * 'UTC'`. The result is a lie about *when* it is, told on purpose, and it must
 * never be stored or compared against a real timestamp.
 */
export function shiftToOffset(at: number, offsetMinutes: number): number {
  return at + offsetMinutes * 60_000;
}

/**
 * The civil day a session belongs to, `'2026-07-27'`, in **its own** offset.
 *
 * A session logged at 23:30 must stay on its day when it is read from another
 * time zone. Grouping by the phone's current offset moves it, and therefore
 * moves the week it counted in — the totals of a past week would depend on where
 * you are standing when you look at them.
 */
export function localDateKey(at: number, offsetMinutes: number): string {
  return new Date(shiftToOffset(at, offsetMinutes)).toISOString().slice(0, 10);
}

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * `'2026-07-27T18:20:00+02:00'` — the local clock, then what it was local to.
 *
 * Both halves are needed: the clock alone cannot be placed on a timeline, and a
 * UTC timestamp alone cannot say it was an evening session. An export written
 * for someone else's tooling has to carry both.
 */
export function isoWithOffset(at: number, offsetMinutes: number): string {
  const local = new Date(shiftToOffset(at, offsetMinutes)).toISOString().slice(0, 19);
  if (offsetMinutes === 0) return `${local}Z`;

  // Minutes, not whole hours: +05:30 and +05:45 are real offsets, and an
  // formatter that only divides by 60 drops them without saying so.
  const total = Math.abs(offsetMinutes);

  return `${local}${offsetMinutes > 0 ? '+' : '-'}${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
