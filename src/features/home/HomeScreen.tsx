import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveWorkout, startWorkout } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { ActionBand, Card, HeaderAction } from '@/ui';
import { SlidersIcon } from '@/ui/icons';
import { HomeProgressLinks } from './HomeProgressLinks';
import { HomeRecentWorkouts } from './HomeRecentWorkouts';
import { HomeSuggestionCard } from './HomeSuggestionCard';
import { HomeWeekCard } from './HomeWeekCard';
import { useHomeDashboard } from './useHomeDashboard';

/**
 * Où une séance commence — RF-17, les deux entrées.
 *
 * L'écran répond à quatre questions dans cet ordre : où j'en suis cette semaine,
 * quoi lancer, ce que j'ai fait dernièrement, où sont les courbes. Rien n'est
 * calculé ici : tout vient de `useHomeDashboard`, et la seule décision de l'app
 * — quelle routine proposer — est une fonction pure testée à part.
 *
 * Les Réglages sont passés de la barre du bas à l'en-tête : on les ouvre trois
 * fois par an, on regarde ses courbes toutes les semaines, et la barre n'a que
 * cinq places (§12.1).
 */
export function HomeScreen() {
  const navigate = useNavigate();
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
  const state = useHomeDashboard();

  const startEmpty = () => {
    void startWorkout('', t('workout.emptyName')).then(() => navigate('/workout'));
  };

  return (
    <Screen
      title={t('home.title')}
      action={
        <HeaderAction label={t('nav.settings')} onClick={() => void navigate('/settings')}>
          <SlidersIcon />
        </HeaderAction>
      }
      /* Rien n'est proposé pendant qu'une séance tourne : deux séances à la fois
         n'est pas un état de l'app, et la barre de reprise au-dessus des onglets
         porte déjà le chemin du retour, sur tous les écrans. */
      footer={
        active === null ? (
          <ActionBand label={t('home.startEmpty')} tone="quiet" onClick={startEmpty} />
        ) : undefined
      }
    >
      <div className="space-y-7">
        {state.status === 'loading' && (
          // Trois blocs de la hauteur de ce qu'ils remplacent : l'écran ne
          // sursaute pas quand les données arrivent.
          <div aria-hidden="true" className="space-y-7">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
            <div className="h-44 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
            <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
          </div>
        )}

        {state.status === 'error' && (
          <div role="status">
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--text-1)]">{t('home.readError')}</p>
            </Card>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <HomeWeekCard regularity={state.regularity} />
            <HomeSuggestionCard
              suggestion={state.data.suggestedRoutine}
              routineCount={state.data.routineCount}
              disabled={active != null}
            />
            <HomeRecentWorkouts items={state.data.recentWorkouts} />
          </>
        )}

        {/* Toujours là : ces trois liens ne dépendent d'aucune lecture, et une
            erreur de base ne doit pas fermer la porte des analyses. */}
        <HomeProgressLinks />
      </div>
    </Screen>
  );
}
