import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { getActiveWorkout } from '@/data/repositories/workouts';
import { t } from '@/i18n/fr';
import { Card, HeaderAction } from '@/ui';
import { SlidersIcon } from '@/ui/icons';
import { HomeBodyCard } from './HomeBodyCard';
import { ProgramHeroCard } from '@/features/programs/ProgramHeroCard';
import { HomeProgramsRow } from './HomeProgramsRow';
import { HomeRecentWorkouts } from './HomeRecentWorkouts';
import { HomeStatsIsland } from './HomeStatsIsland';
import { HomeSuggestionCard } from './HomeSuggestionCard';
import { useHomeDashboard } from './useHomeDashboard';

/**
 * Où une séance préparée commence.
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

  return (
    <Screen
      title={t('home.title')}
      action={
        <HeaderAction label={t('nav.settings')} onClick={() => void navigate('/settings')}>
          <SlidersIcon />
        </HeaderAction>
      }
    >
      <div className="space-y-6">
        {state.status === 'loading' && (
          // Deux blocs de la hauteur de ce qu'ils remplacent — la carte du jour
          // et la ligne des blocs : l'écran ne sursaute pas quand les données
          // arrivent, et le corps en dessous ne descend pas d'un cran.
          <div aria-hidden="true" className="space-y-6">
            <div className="h-44 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
            <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
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
          </>
        )}

        {/* Le corps ne dépend pas du tableau de bord — il lit son propre
            historique — donc il est rendu quoi qu'il arrive, y compris pendant
            que le reste charge et y compris si la lecture échoue. Il ne dessine
            rien du tout quand rien n'a été travaillé sur douze semaines, et il
            emporte alors ses trois liens avec lui. */}
        <HomeBodyCard />

        {state.status === 'ready' && (
          <>
            <HomeStatsIsland regularity={state.regularity} />
            <HomeRecentWorkouts items={state.data.recentWorkouts} />
          </>
        )}
      </div>
    </Screen>
  );
}
