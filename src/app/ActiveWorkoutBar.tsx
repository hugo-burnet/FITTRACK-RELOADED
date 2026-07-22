import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { ElapsedTime } from '@/features/workout/ElapsedTime';
import { t } from '@/i18n/fr';
import { ChevronRightIcon } from '@/ui/icons';

/**
 * RF-25 — the way back into a session in progress.
 *
 * A permanent bar rather than a redirect on startup. Reopening the app in the
 * middle of a session is not proof that you want the workout screen: looking up
 * a machine setting on an exercise sheet is exactly the reason to leave it. A
 * redirect would hijack that; a bar answers both needs at once — *resume after a
 * kill*, and *come back after going to look at something*.
 *
 * Hidden on the workout screens themselves, where it would point at the page it
 * sits on.
 */
export function ActiveWorkoutBar() {
  const { pathname } = useLocation();
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);

  if (active == null || pathname.startsWith('/workout')) return null;

  return (
    <Link
      to="/workout"
      className="flex min-h-14 shrink-0 items-center gap-3 border-t border-[var(--border)]
        bg-[var(--color-accent)] px-4 text-[var(--color-accent-fg)]
        transition-[filter] duration-[var(--dur-1)] active:brightness-95"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="label-xs font-semibold opacity-80">{t('home.resumeTitle')}</span>
        <span className="truncate text-base font-semibold">
          {active.name === '' ? t('workout.emptyName') : active.name}
        </span>
      </span>
      <ElapsedTime startedAt={active.startedAt} className="shrink-0 text-lg font-semibold" />
      <ChevronRightIcon />
    </Link>
  );
}
