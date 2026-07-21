import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { EmptyState } from '@/ui';

export function HomeScreen() {
  return (
    <Screen title={t('home.title')}>
      <EmptyState reading="0" unit={t('units.streakDays')} body={t('home.emptyBody')} />
    </Screen>
  );
}
