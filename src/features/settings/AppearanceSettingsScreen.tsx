import { useState } from 'react';
import { getBootStorage } from '@/app/bootEasterEgg';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { isTty1Unlocked } from '@/stores/skinUnlock';
import { applyTheme, loadTheme } from '@/stores/theme';
import type { Theme } from '@/stores/theme';
import { Card, Segmented } from '@/ui';
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
        <Segmented
          label={t('settings.theme')}
          value={theme}
          onChange={chooseTheme}
          options={THEME_OPTIONS.map(({ value, labelKey }) => ({
            value,
            label: t(labelKey),
            // TTY1 se débloque au démarrage : tant qu'il ne l'est pas, l'option se montre et dit pourquoi.
            locked:
              value === 'tty1' && !tty1Unlocked
                ? { describedBy: TTY1_LOCKED_ID, icon: <LockIcon width={16} height={16} /> }
                : undefined,
          }))}
        />
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
