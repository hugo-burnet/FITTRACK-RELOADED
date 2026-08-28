import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import {
  listCompletedWorkoutTimestamps,
  listHistoryExerciseOptions,
} from '@/data/repositories/history';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import type { TutorialAnalyticsView } from '@/features/tutorial/tutorialTypes';
import { t } from '@/i18n/fr';
import { Card, ListRow, SectionTitle } from '@/ui';

/**
 * What to look at — the whole of this screen.
 *
 * Two sections since milestone G2: the readings that span the whole history,
 * then the exercises. The exercise list is the ones **actually performed**, the
 * same source the history filter reads, so there is no empty chart to design a
 * state for. The weekly row obeys the same rule: with no completed session ever,
 * it is not offered rather than opening on twelve bars at zero.
 */
export function AnalyticsScreen() {
  const navigate = useAppNavigate();
  const options = useLiveQuery(listHistoryExerciseOptions, []);
  const completed = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);

  const tutorial = useTutorialControls();

  /*
   * Les cinq lignes ouvrent la même sorte d'écran : c'est `view` qui dit
   * laquelle. Sans elle, ouvrir « Volume d'entraînement » validait l'étape du
   * tutoriel qui demande « Séances par semaine ».
   */
  const openView = (view: TutorialAnalyticsView, path: string) => {
    tutorial?.report({ type: 'analytics-view-opened', view });
    void navigate(path);
  };

  const hasHistory = completed !== undefined && completed.length > 0;
  const hasExercises = options !== undefined && options.length > 0;

  return (
    // Plus de flèche de retour : cet écran est devenu la racine d'un onglet, et
    // une flèche sur une racine d'onglet promet un ailleurs qui n'existe pas.
    // L'Historique, d'où on entrait, est l'onglet juste à gauche.
    <Screen title={t('analytics.title')}>
      <div className="space-y-7">
        <section>
          <SectionTitle>{t('analytics.overviewSection')}</SectionTitle>
          <Card>
            <ListRow
              title={t('records.link')}
              subtitle={t('records.subtitle')}
              onClick={() => openView('records', '/analytics/records')}
            />
            {hasHistory && (
              <>
              <ListRow
                title={t('weekly.link')}
                subtitle={t('weekly.subtitle')}
                tutorialId="analytics-weekly"
                onClick={() => openView('weekly', '/analytics/weekly')}
              />
              <ListRow
                title={t('volume.link')}
                subtitle={t('volume.subtitle')}
                onClick={() => openView('volume', '/analytics/volume')}
              />
              <ListRow
                title={t('muscles.link')}
                subtitle={t('muscles.subtitle')}
                onClick={() => openView('muscles', '/analytics/muscles')}
              />
              <ListRow
                title={t('monthly.link')}
                subtitle={t('monthly.subtitle')}
                onClick={() => openView('monthly', '/analytics/months')}
              />
              </>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>{t('analytics.exercisesSection')}</SectionTitle>
          {options !== undefined && !hasExercises ? (
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('analytics.empty')}</p>
            </Card>
          ) : (
            <Card>
              {(options ?? []).map((option) => (
                <ListRow
                  key={option.id}
                  title={option.name}
                  onClick={() => void navigate(`/analytics/exercises/${option.id}`)}
                />
              ))}
            </Card>
          )}
        </section>
      </div>
    </Screen>
  );
}
