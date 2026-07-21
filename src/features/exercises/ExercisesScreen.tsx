import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { EmptyState } from '@/ui';

export function ExercisesScreen() {
  return (
    <Screen title={t('exercises.title')}>
      <EmptyState reading="0" unit={t('units.exercises')} body={t('exercises.emptyBody')} />
    </Screen>
  );
}
