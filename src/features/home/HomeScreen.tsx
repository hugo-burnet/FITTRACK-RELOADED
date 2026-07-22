import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveWorkout, startWorkout } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { Button, EmptyState } from '@/ui';

/**
 * Where a session starts — RF-17, both ways in.
 *
 * Nothing is offered while a session is running: two sessions at once is not a
 * state the app has, and the resume bar above the tabs already carries the way
 * back, on every screen. A start button that cannot start anything is worse than
 * no button (the Lot 4 rule about "Démarrer", applied to itself).
 */
export function HomeScreen() {
  const navigate = useNavigate();
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);

  const startEmpty = () => {
    void startWorkout('', t('workout.emptyName')).then(() => navigate('/workout'));
  };

  return (
    <Screen title={t('home.title')}>
      <EmptyState reading="0" unit={t('units.streakDays')} body={t('home.emptyBody')} />

      {active === null && (
        <div
          className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-9 flex flex-col gap-2 border-t
            border-[var(--border)] bg-[var(--surface-0)] px-4 pt-3 pb-3"
        >
          <Button variant="primary" size="lg" fullWidth onClick={startEmpty}>
            {t('home.startEmpty')}
          </Button>
          <Button size="lg" fullWidth onClick={() => void navigate('/routines')}>
            {t('home.startFromRoutine')}
          </Button>
        </div>
      )}
    </Screen>
  );
}
