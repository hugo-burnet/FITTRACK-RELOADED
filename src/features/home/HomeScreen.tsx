import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveWorkout, startWorkout } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { ActionBand, EmptyState } from '@/ui';

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
    <Screen
      title={t('home.title')}
      /* « Partir d'une routine » a été retiré : il menait à l'onglet Routines,
         qui est une ligne plus bas et toujours là. Un bouton qui double un
         onglet est un bouton en trop. */
      footer={
        active === null ? (
          <ActionBand label={t('home.startEmpty')} onClick={startEmpty} />
        ) : undefined
      }
    >
      <EmptyState reading="0" unit={t('units.streakDays')} body={t('home.emptyBody')} />
    </Screen>
  );
}
