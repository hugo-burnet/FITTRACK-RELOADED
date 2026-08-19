/**
 * How much rest a set has just earned, read from the effort it cost.
 *
 * The rest a routine prescribes is written for a set that goes to plan. A set
 * that goes to failure at rep six is not that set, and asking for the same
 * ninety seconds afterwards is asking the next one to fail too. The RPE is the
 * only honest signal the app has about that — and it is one tap away, on the
 * strip that follows a validated set.
 *
 * **In fixed steps, never as a percentage.** Fifteen seconds is fifteen seconds
 * whether the rest was sixty or three minutes; a percentage would hand the
 * hardest sets of a short-rest routine the smallest bonus. Same reasoning as
 * the program's load increments.
 *
 * **It only ever adds.** Nothing here shortens a rest: an app that takes rest
 * away because you called a set easy is an app you stop answering honestly.
 */
export function restBonusSecondsFor(rpe: number | undefined): number {
  if (rpe === undefined || Number.isNaN(rpe)) return 0;
  if (rpe < 7.5) return 0;
  if (rpe < 9) return 15;
  if (rpe < 10) return 30;
  return 45;
}
