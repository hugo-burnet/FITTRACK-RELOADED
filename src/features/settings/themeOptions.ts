import type { TranslationKey } from '@/i18n/fr';
import type { Theme } from '@/stores/theme';

/** Les quatre thèmes et leur libellé : lus par la page Apparence et par la ligne du sommaire. */
export const THEME_OPTIONS: {
  value: Theme;
  labelKey: 'settings.themeDark' | 'settings.themeLight' | 'settings.themeTty1' | 'settings.themeCyber';
}[] = [
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'tty1', labelKey: 'settings.themeTty1' },
  { value: 'cyber', labelKey: 'settings.themeCyber' },
];

export const THEME_HINT = {
  dark: 'settings.themeHint',
  light: 'settings.themeHint',
  tty1: 'settings.themeTty1Hint',
  cyber: 'settings.themeCyberHint',
} as const satisfies Record<Theme, TranslationKey>;
