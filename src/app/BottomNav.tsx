import { NavLink } from 'react-router-dom';
import type { ComponentType, SVGProps } from 'react';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { BarbellIcon, CalendarIcon, PlateIcon, ProgramIcon, SlidersIcon } from './NavIcons';

type Tab = {
  to: string;
  end?: boolean;
  labelKey: TranslationKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const TABS: Tab[] = [
  { to: '/', end: true, labelKey: 'nav.home', Icon: BarbellIcon },
  { to: '/routines', labelKey: 'nav.routines', Icon: ProgramIcon },
  { to: '/history', labelKey: 'nav.history', Icon: CalendarIcon },
  { to: '/exercises', labelKey: 'nav.exercises', Icon: PlateIcon },
  { to: '/settings', labelKey: 'nav.settings', Icon: SlidersIcon },
];

export function BottomNav() {
  return (
    <nav
      aria-label={t('nav.label')}
      className="safe-bottom shrink-0 border-t border-[var(--border)] bg-[var(--surface-1)]"
    >
      <ul className="mx-auto flex max-w-[36rem]">
        {TABS.map(({ to, end, labelKey, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-col items-center justify-center gap-1 pt-1
                 ${isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--text-2)]'}`
              }
            >
              {({ isActive }) => (
                <>
                  {/* The engaged mark: the same atom that will tick a completed set. */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 h-[3px] w-5 rounded-b-full bg-[var(--accent-ink)]
                      transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)]
                      ${isActive ? 'scale-x-100' : 'scale-x-0'}`}
                  />
                  <Icon />
                  <span className="text-[11px] leading-none font-medium">{t(labelKey)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
