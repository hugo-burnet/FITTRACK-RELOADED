import { Link, useLocation } from 'react-router-dom';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';

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
  const { pathname } = useLocation();

  return (
    <nav aria-label={t('planning.tabsLabel')} className="-mt-2">
      <ul className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
        {SPACES.map(({ to, labelKey }) => {
          const isActive = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
              <Link
                to={to}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-12 items-center justify-center rounded-lg px-2 text-sm
                  font-semibold transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                  ${
                    isActive
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'text-[var(--text-2)]'
                  }`}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
