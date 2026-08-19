import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveWorkout, startWorkout } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { ActionBand, Card, HeaderAction } from '@/ui';
import { SlidersIcon } from '@/ui/icons';
import { HomeBodyCard } from './HomeBodyCard';
import { ProgramHeroCard } from '@/features/programs/ProgramHeroCard';
import { HomeProgramsRow } from './HomeProgramsRow';
import { HomeRecentWorkouts } from './HomeRecentWorkouts';
import { HomeStatsIsland } from './HomeStatsIsland';
import { HomeSuggestionCard } from './HomeSuggestionCard';
import { useHomeDashboard } from './useHomeDashboard';

/**
 * Où une séance commence — RF-17, les deux entrées.
 *
 * **L'ordre a changé, et c'est le sujet de l'écran qui a changé avec lui.**
 * L'accueil posait quatre questions dans l'ordre du tableau de bord : où j'en
 * suis cette semaine, combien je pèse, quoi lancer, ce que j'ai fait, où sont
 * les courbes. Cinq blocs, cinq intertitres, et le dessin du corps tout en bas.
 *
 * Il en pose deux, dans l'ordre de la salle : **qu'est-ce que je travaille** —
 * le corps, en grand, en tête — et **qu'est-ce que je lance**, juste dessous.
 * Le reste descend d'un cran : les deux chiffres personnels tiennent une bande
 * de tuiles, l'historique récent ferme l'écran.
 *
 * Ce qui est parti : la série de semaines d'affilée (un compteur qu'on lit une
 * fois et qu'on perd en se blessant), les ± de la pesée (le téléphone a un
 * clavier), et trois intertitres.
 *
 * Rien n'est calculé ici : tout vient de `useHomeDashboard`, et la seule
 * décision de l'app — quelle routine proposer — est une fonction pure testée à
 * part. Les Réglages sont dans l'en-tête : on les ouvre trois fois par an, et la
 * barre du bas n'a que cinq places (§12.1).
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
      <div className="space-y-6">
        {/* Le corps ne dépend pas du tableau de bord — il lit son propre
            historique — donc il est rendu tout de suite, y compris pendant que
            le reste charge et y compris si la lecture échoue. */}
        <HomeBodyCard />

        {state.status === 'loading' && (
          // Deux blocs de la hauteur de ce qu'ils remplacent : l'écran ne
          // sursaute pas quand les données arrivent.
          <div aria-hidden="true" className="space-y-6">
            <div className="h-44 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
            <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
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
            {state.data.activeProgram !== null ? (
              <ProgramHeroCard program={state.data.activeProgram} disabled={active != null} />
            ) : (
              <HomeSuggestionCard
                suggestion={state.data.suggestedRoutine}
                routineCount={state.data.routineCount}
                disabled={active != null}
              />
            )}
            {/* Sous la carte du jour : ce qu'elle propose vient d'un plan, et
                c'est ici qu'on ouvre le plan. */}
            <HomeProgramsRow program={state.data.activeProgram} />
            <HomeStatsIsland regularity={state.regularity} />
            <HomeRecentWorkouts items={state.data.recentWorkouts} />
          </>
        )}
      </div>
    </Screen>
  );
}
