import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import type { RepPacer } from '@/stores/repPacer';
import { formatNumber } from '@/ui/numberField';
import { armRepPacer } from './repBeats';

/**
 * The metronome of the set under way: it arms the beats, says where you are
 * while they run, and stops them when tapped.
 *
 * Mounted keyed by the set, like the rest bar — the component's lifetime *is*
 * the pace's, so nothing has to be cancelled by hand when the set ends, is
 * validated, or is abandoned.
 *
 * The reading names the tempo as well as the rep, and that is not decoration:
 * "3,5 s" is how the fatigue rule shows its work. A beat that stretches without
 * saying so reads as an app that has lost count.
 *
 * A reading, not a control: it renders inside the header's expand button, and a
 * button nested in a button is invalid. Stopping is the square next to it —
 * see `WorkoutExerciseCard`.
 */
export function RepPaceRail({
  pacer,
  onFinished,
}: {
  pacer: RepPacer & { setId: string };
  onFinished: () => void;
}) {
  useEffect(
    () => armRepPacer(pacer, onFinished),
    // Re-arming on the identity of the pace, never on the callback's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pacer.setId, pacer.startedAt, pacer.reps, pacer.repSeconds],
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - pacer.startedAt);
  const current = Math.min(pacer.reps, Math.floor(elapsed / (pacer.repSeconds * 1_000)) + 1);

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--accent-ink)]" />
      <span className="tabular truncate">
        {t('workout.paceStatus', {
          current,
          total: pacer.reps,
          tempo: formatNumber(pacer.repSeconds),
        })}
      </span>
    </span>
  );
}
