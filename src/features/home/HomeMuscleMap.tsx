import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { toMuscleRows } from '@/lib/analytics/muscles';
import { periodBounds } from '@/lib/analytics/periods';
import { BodyMap, balanceHighlight } from '@/ui/bodyMap';

/**
 * The body at the top of the home screen's Progression section.
 *
 * **This reopens a decision of Lot 12, deliberately and at the user's request.**
 * `HomeProgressLinks` said no chart is drawn here, so that opening the app never
 * pays for the analysis screens' JavaScript. The complaint that overturned it is
 * a fair one: nothing on the home screen suggested a body map existed at all, so
 * the feature was invisible to the only person using the app.
 *
 * The cost is paid down rather than accepted, in two ways:
 *
 * - **The chunk is deferred.** This module is `lazy`-loaded, so the 23 kB of
 *   geometry stay out of the startup bundle and arrive after the first paint.
 *   The rule's *reason* is honoured even though its letter is not.
 * - **One read, not two.** `useHistoricalPeriod` also fetches every completed
 *   timestamp to know whether earlier history exists — a second pass this
 *   screen has no use for, since it shows no "before this window" notice.
 *
 * Twelve weeks, fixed: the user chose it over all-history. It is the same
 * default the detail screen opens on, so tapping through changes the depth of
 * the reading and never the reading itself.
 */
const PERIOD = '12w';

export function HomeMuscleMap() {
  // Frozen on open, like every other historical window in the app: the bounds
  // must not slide under the reader at midnight.
  const [openedAt] = useState(() => Date.now());
  const { from, to } = periodBounds(PERIOD, openedAt);

  const workouts = useLiveQuery(
    async () =>
      from === undefined
        ? await listHistoricalWorkouts({ kind: 'all-history' })
        : await listHistoricalWorkouts({ kind: 'period', from, to }),
    [from, to],
  );

  // Not answered yet: hold the drawing's own height, so the three buttons do not
  // jump under the thumb when it fills in.
  if (workouts === undefined) return <div className="h-64" aria-hidden />;

  const highlight = balanceHighlight(muscleInvolvement(toMuscleRows(workouts)));

  // Answered, and there is nothing to draw — a fresh install, or twelve quiet
  // weeks. **No body at all rather than a dark one.** An all-unlit silhouette
  // says "you have trained nothing", which is both bleak and a claim the app has
  // no business making on its home screen; and reserving 256 px of emptiness for
  // it is worse than the missing drawing. Same rule as the records section on
  // the exercise sheet: nothing to report, so no section.
  if (Object.keys(highlight).length === 0) return null;

  // The separator belongs to the drawing, not to the buttons below it: hung on
  // the button row instead, it would still be drawn on a card that has no body
  // — a stray line across the top of an otherwise plain row of links.
  return (
    <div className="border-b border-[var(--border)] px-4 pt-4 pb-2">
      <BodyMap highlight={highlight} />
    </div>
  );
}
