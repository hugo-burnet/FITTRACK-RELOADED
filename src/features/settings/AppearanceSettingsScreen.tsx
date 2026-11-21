import { useState } from 'react';
import { getBootStorage } from '@/app/bootEasterEgg';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { isTty1Unlocked } from '@/stores/skinUnlock';
import { applyTheme, loadTheme } from '@/stores/theme';
import type { Theme } from '@/stores/theme';
import { Card } from '@/ui';
import { LockIcon } from '@/ui/icons';
import { THEME_HINT, THEME_OPTIONS } from './themeOptions';

/** La phrase sous le sélecteur : ce qui décrit l'option TTY1 tant qu'elle est verrouillée. */
const TTY1_LOCKED_ID = 'theme-tty1-locked';

/** Réglages › Apparence : le sélecteur de thème et sa phrase. */
export function AppearanceSettingsScreen() {
  const navigate = useAppNavigate();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  // Lu une fois : TTY1 ne se débloque qu'au démarrage (console rare, ancienneté), jamais pendant
  // qu'on regarde Réglages.
  const [tty1Unlocked] = useState(() => isTty1Unlocked(getBootStorage()));

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <Screen title={t('settings.appearanceSection')} onBack={() => void navigate('/settings')}>
      <Card padded>
        <div
          role="radiogroup"
          aria-label={t('settings.theme')}
          data-part="segmented"
          // Deux lignes de deux : quatre boutons sur une ligne débordent à 200 % de taille de police.
          className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1"
        >
          {THEME_OPTIONS.map(({ value, labelKey }) => {
            const locked = value === 'tty1' && !tty1Unlocked;

            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                // `aria-disabled` et non `disabled` : le bouton garde le focus, et sa phrase
                // (`aria-describedby`) est lue à qui le touche au lieu de se taire.
                aria-disabled={locked || undefined}
                aria-describedby={locked ? TTY1_LOCKED_ID : undefined}
                onClick={() => {
                  if (!locked) chooseTheme(value);
                }}
                className={`min-h-12 min-w-0 rounded-lg text-base font-semibold [overflow-wrap:anywhere]
                  transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                  ${
                    theme === value
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'text-[var(--text-2)]'
                  }
                  ${locked ? 'flex items-center justify-center gap-1.5 opacity-60' : ''}`}
              >
                {locked && <LockIcon width={16} height={16} />}
                {t(labelKey)}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">{t(THEME_HINT[theme])}</p>
        {!tty1Unlocked && (
          <p id={TTY1_LOCKED_ID} className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
            {t('settings.themeTty1Locked')}
          </p>
        )}
      </Card>
    </Screen>
  );
}
