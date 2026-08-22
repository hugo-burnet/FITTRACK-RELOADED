import type { HomeDashboardData } from '@/data/repositories/home';
import { t } from '@/i18n/fr';

type RoutineContext = HomeDashboardData['routineContext'];

export function routineContextOptionLabel(option: RoutineContext['options'][number]): string {
  return option.value === 'root' ? t('home.rootRoutineFolder') : option.label;
}
