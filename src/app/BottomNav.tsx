import { Link, useLocation } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { BarbellIcon, CalendarIcon, PlateIcon, ProgramIcon, TrendIcon } from '@/ui/icons';
import { isPlanningPath } from './planningPaths';

type Tab = {
  to: string;
  end?: boolean;
  labelKey: TranslationKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Remplace la règle par défaut quand un onglet couvre plusieurs racines. */
  isActive?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  { to: '/', end: true, labelKey: 'nav.home', Icon: BarbellIcon },
  { to: '/routines', labelKey: 'nav.planning', Icon: ProgramIcon, isActive: isPlanningPath },
  { to: '/history', labelKey: 'nav.history', Icon: CalendarIcon },
  // Progression a pris la place des Réglages : on regarde ses courbes toutes les
  // semaines, on change une préférence trois fois par an. Les Réglages vivent
  // désormais dans l'en-tête de l'accueil, à une icône d'ici.
  { to: '/analytics', labelKey: 'nav.progress', Icon: TrendIcon },
  { to: '/exercises', labelKey: 'nav.exercises', Icon: PlateIcon },
];

// La règle par défaut de `NavLink`, réécrite parce qu'un onglet a désormais
// besoin de la sienne : exacte pour l'accueil, préfixe de segment ailleurs.
const matchesTab = (tab: Tab, pathname: string): boolean => {
  if (tab.isActive) return tab.isActive(pathname);
  if (tab.end) return pathname === tab.to;
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
};

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label={t('nav.label')}
      className="bottom-nav safe-bottom shrink-0 border-t border-[var(--border)]
        bg-[var(--surface-1)]"
    >
      <ul className="mx-auto flex max-w-[36rem]">
        {TABS.map((tab) => {
          const { to, labelKey, Icon } = tab;
          const isActive = matchesTab(tab, pathname);
          return (
            <li key={to} className="flex-1">
              <Link
                viewTransition
                to={to}
                data-tutorial-nav={to}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 pt-1
                 ${isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--text-2)]'}`}
              >
                {/* The engaged mark: the same atom that will tick a completed set. */}
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[3px] w-5 rounded-b-full bg-[var(--accent-ink)]
                      transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)]
                      ${isActive ? 'scale-x-100' : 'scale-x-0'}`}
                />
                <Icon />
                <span className="text-[11px] leading-none font-medium">{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
