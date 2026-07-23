import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest } from '@/lib/rest';
import { ElapsedTime } from './ElapsedTime';
import { RestRail } from './RestRail';
import { workoutProgressLine } from './summary';

type Props = {
  startedAt: number;
  completedSets: number;
  totalSets: number;
  /**
   * The rest in progress, or `null`. The bar that used to sit on the ticked set's
   * row lives here now, so this is also what fires the chime — hence `onDone`.
   */
  rest: { setId: string; startedAt: number; endsAt: number; onDone: () => void } | null;
};

/**
 * The live session's instruments, pinned in the header so they never scroll away.
 *
 * These two readings — how long you have trained, how much rest is left — are the
 * ones you look up between sets, out of breath, and they were the first things to
 * disappear the moment you scrolled to the next exercise, because they sat at the
 * top of the scrolling list. They leave it here for the fixed band under the title.
 *
 * A **band of its own, never a word beside the title.** `workoutProgressLine`
 * records the Lot 4 lesson that a reading set next to a user-chosen name makes two
 * texts fight for one 375 px line; that holds here because the meters get their
 * own row and the title above keeps its full width.
 *
 * The rest bar is the same `RestRail` that used to live on the row — moved whole,
 * not copied. Two bars armed off one deadline would each fire the chime; there is
 * exactly one, and it is the one you can always see.
 */
export function WorkoutMeter({ startedAt, completedSets, totalSets, rest }: Props) {
  return (
    <div className="relative shrink-0 border-b border-[var(--border)] px-4 pt-1 pb-2">
      <div className="flex items-baseline gap-2">
        <ElapsedTime startedAt={startedAt} className="text-base text-[var(--text-1)]" />
        <span className="label-xs font-semibold text-[var(--text-2)]">
          {workoutProgressLine(completedSets, totalSets)}
        </span>
        {/* Poussé à droite, en accent : c'est le relevé qu'on cherche en repos.
            Il bat désormais — il décompte le temps qui reste, là où l'ancien
            relevé disait une fois la durée réglée. Isolé dans son propre
            composant pour que sa seconde ne fasse pas re-rendre la barre. */}
        {rest !== null && <RestReading endsAt={rest.endsAt} />}
      </div>

      {rest !== null && (
        <RestRail
          // A fresh bar per rest: keyed on the set so a new countdown never
          // animates from where the last one left off.
          key={rest.setId}
          startedAt={rest.startedAt}
          endsAt={rest.endsAt}
          onDone={rest.onDone}
        />
      )}
    </div>
  );
}

/**
 * The rest reading, counting down once a second. Its own component so only it
 * re-renders on the tick — the sibling `RestRail` is driven by the compositor and
 * must not be re-rendered every second (cf. its own note).
 */
function RestReading({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <span className="label-xs tabular ml-auto shrink-0 font-semibold text-[var(--accent-ink)]">
      {t('workout.restLabel', { duration: formatRest(remaining) })}
    </span>
  );
}
