import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Tabs } from '@/ui';

/**
 * La navigation partagée de Planifier.
 *
 * Les trois routes restent canoniques — `/routines`, `/programs` et
 * `/knowledge/programmation` — pour ne pas migrer les liens existants. Ce
 * composant ne fait que les rendre visibles ensemble : il ne fusionne aucune
 * donnée, et Routine, Programme et Guide gardent chacun son sens.
 */
const SPACES: { to: string; labelKey: TranslationKey }[] = [
  { to: '/routines', labelKey: 'planning.routines' },
  { to: '/programs', labelKey: 'planning.programs' },
  { to: '/knowledge/programmation', labelKey: 'planning.guide' },
];

export function PlanningTabs() {
  return (
    <div className="-mt-2">
      <Tabs
        label={t('planning.tabsLabel')}
        items={SPACES.map(({ to, labelKey }) => ({ to, label: t(labelKey) }))}
      />
    </div>
  );
}
