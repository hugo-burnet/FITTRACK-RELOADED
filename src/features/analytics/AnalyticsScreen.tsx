import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { listHistoryExerciseOptions } from '@/data/repositories/history';
import { t } from '@/i18n/fr';
import { Card, ListRow } from '@/ui';

/**
 * Which exercise to look at — nothing more, in this version.
 *
 * The list is the exercises **actually performed**, the same source the history
 * filter reads: an exercise never done has no progression to show, so there is
 * no empty chart to design a state for.
 */
export function AnalyticsScreen() {
  const navigate = useNavigate();
  const options = useLiveQuery(listHistoryExerciseOptions, []);

  return (
    <Screen title={t('analytics.title')} onBack={() => void navigate('/history')}>
      <div className="space-y-4">
        <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">
          {t('analytics.pickExercise')}
        </p>

        {options !== undefined && options.length === 0 ? (
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
      </div>
    </Screen>
  );
}
