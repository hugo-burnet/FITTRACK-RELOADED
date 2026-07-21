import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { EmptyState } from '@/ui';

export function RoutinesScreen() {
  return (
    <Screen title={t('routines.title')}>
      <EmptyState reading="0" unit={t('units.routines')} body={t('routines.emptyBody')} />
    </Screen>
  );
}
