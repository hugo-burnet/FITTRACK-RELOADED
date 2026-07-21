import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { EmptyState } from '@/ui';

export function HistoryScreen() {
  return (
    <Screen title={t('history.title')}>
      <EmptyState reading="0" unit={t('units.workouts')} body={t('history.emptyBody')} />
    </Screen>
  );
}
