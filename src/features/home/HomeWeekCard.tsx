import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/fr';
import type { WeeklyRegularity } from '@/lib/history';
import { Card, SectionTitle } from '@/ui';

/**
 * La semaine en cours, en une carte — le même calcul et la même forme que la
 * carte Régularité de l'Historique, dont c'est le résumé.
 *
 * **Sans objectif défini, une seule colonne.** La série hebdomadaire vaut zéro
 * tant qu'il n'y a pas d'objectif à tenir (`calculateWeeklyRegularity`), et
 * afficher « 0 semaines d'affilée » à quelqu'un qui s'entraîne trois fois par
 * semaine serait un reproche fabriqué. Pas de `2 / 4` inventé non plus : la
 * lecture est alors simplement le nombre de séances.
 */
export function HomeWeekCard({ regularity }: { regularity: WeeklyRegularity }) {
  const navigate = useNavigate();
  const { currentCompleted, currentGoal, streak } = regularity;

  return (
    <section>
      <SectionTitle>{t('home.weekSection')}</SectionTitle>

      <Card>
        <button
          type="button"
          aria-label={t('home.weekLink')}
          onClick={() => void navigate('/analytics/weekly')}
          className={`grid w-full text-left transition-colors duration-[var(--dur-1)]
            active:bg-[var(--surface-2)] ${currentGoal === null ? '' : 'grid-cols-2'}`}
        >
          <span className="flex min-h-24 flex-col justify-between p-4">
            <span className="metric text-4xl leading-none font-semibold text-[var(--text-1)]">
              {currentGoal === null ? currentCompleted : `${currentCompleted} / ${currentGoal}`}
            </span>
            <span className="mt-3 text-sm font-medium text-[var(--text-2)]">
              {/* Avec un objectif, le mot de l'Historique — « 2 / 2 séances cette
                  semaine » repassait à la ligne à côté de la série. */}
              {currentGoal !== null
                ? t('history.weeklyGoal')
                : t(currentCompleted === 1 ? 'home.weekSessionsOne' : 'home.weekSessions')}
            </span>
          </span>

          {currentGoal !== null && (
            <span
              className="flex min-h-24 flex-col justify-between border-l border-[var(--border)] p-4"
            >
              <span className="metric text-4xl leading-none font-semibold text-[var(--text-1)]">
                {streak}
              </span>
              <span className="mt-3 text-sm font-medium text-[var(--text-2)]">
                {t(streak === 1 ? 'home.streakLabelOne' : 'home.streakLabel')}
              </span>
            </span>
          )}
        </button>
      </Card>
    </section>
  );
}
