import type { HomeDashboardData } from '@/data/repositories/home';
import { t } from '@/i18n/fr';

type RoutineContext = HomeDashboardData['routineContext'];
type RoutineContextOption = RoutineContext['options'][number];

export function routineContextOptionLabel(option: RoutineContextOption): string {
  return option.value === 'root' ? t('home.rootRoutineFolder') : option.label;
}

/** Les lignes cochées, dans l'ordre de la bibliothèque. */
export function selectedRoutineContextOptions(context: RoutineContext): RoutineContextOption[] {
  return context.options.filter((option) => context.selected.includes(option.value));
}

/** « UL + PPL 45' » : l'ensemble dont la suggestion est tirée, lu d'un coup d'œil. */
export function routineContextLabel(options: readonly RoutineContextOption[]): string {
  return options.map(routineContextOptionLabel).join(' + ');
}
