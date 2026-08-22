import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { discardWorkout, getActiveWorkout, getWorkoutDetail } from '@/data/repositories/workouts';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { ElapsedTime } from '@/features/workout/ElapsedTime';
import { t } from '@/i18n/fr';
import { ChevronRightIcon } from '@/ui/icons';
import { ActiveWorkoutRecoverySheet } from './ActiveWorkoutRecoverySheet';
import { isWorkoutStale } from './staleWorkout';

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
  const navigate = useNavigate();
  const tutorial = useTutorialControls();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const detail = useLiveQuery(
    async () => (active == null ? null : await getWorkoutDetail(active.id)),
    [active?.id],
  );

  if (active == null || pathname.startsWith('/workout')) return null;

  const name = active.name === '' ? t('workout.emptyName') : active.name;
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="label-xs font-semibold opacity-80">{t('home.resumeTitle')}</span>
        <span className="truncate text-base font-semibold">{name}</span>
      </span>
      <ElapsedTime startedAt={active.startedAt} className="shrink-0 text-lg font-semibold" />
      <ChevronRightIcon />
    </>
  );

  if (!isWorkoutStale(active.startedAt)) {
    return (
      <Link
        to="/workout"
        className="animate-rise flex min-h-14 shrink-0 items-center gap-3 border-t border-[var(--border)]
          bg-[var(--color-accent)] px-4 text-[var(--color-accent-fg)]
          transition-[filter] duration-[var(--dur-1)] active:brightness-95"
      >
        {content}
      </Link>
    );
  }

  const validatedSetCount =
    detail == null
      ? null
      : detail.exercises.reduce(
          (count, line) =>
            count + line.sets.filter((set) => set.isCompleted === 1 && set.deletedAt === 0).length,
          0,
        );

  const choose = (choice: 'resume' | 'finish') => {
    tutorial?.report({ type: 'stale-workout-choice', workoutId: active.id, choice });
    setRecoveryOpen(false);
    void navigate(choice === 'resume' ? '/workout' : '/workout/finish');
  };

  const discard = () => {
    void discardWorkout(active.id)
      .then(() => {
        tutorial?.report({
          type: 'stale-workout-choice',
          workoutId: active.id,
          choice: 'discard',
        });
        setRecoveryOpen(false);
        void navigate('/', { replace: true });
      })
      .catch(() => undefined);
  };

  return (
    <>
      <button
        type="button"
        data-tutorial-id="active-workout-bar"
        onClick={() => {
          tutorial?.offerMission('TUT-REC-01');
          setRecoveryOpen(true);
        }}
        className="animate-rise flex min-h-14 shrink-0 items-center gap-3 border-t border-[var(--border)]
          bg-[var(--color-accent)] px-4 text-[var(--color-accent-fg)]
          transition-[filter] duration-[var(--dur-1)] active:brightness-95"
      >
        {content}
      </button>
      <ActiveWorkoutRecoverySheet
        open={recoveryOpen}
        workoutName={name}
        validatedSetCount={validatedSetCount}
        onClose={() => setRecoveryOpen(false)}
        onResume={() => choose('resume')}
        onFinish={() => choose('finish')}
        onDiscard={discard}
      />
    </>
  );
}
