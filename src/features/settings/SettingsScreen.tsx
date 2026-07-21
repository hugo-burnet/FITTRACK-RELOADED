import { useState } from 'react';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { applyTheme, loadTheme } from '@/stores/theme';
import type { Theme } from '@/stores/theme';
import { NumberInput } from '@/ui';

const THEME_OPTIONS: { value: Theme; labelKey: 'settings.themeDark' | 'settings.themeLight' }[] = [
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'light', labelKey: 'settings.themeLight' },
];

function SectionTitle({ children }: { children: string }) {
  return <h2 className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]">{children}</h2>;
}

export function SettingsScreen() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [demoWeight, setDemoWeight] = useState<number | undefined>(100);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <Screen title={t('settings.title')}>
      <div className="flex flex-col gap-9">
        <section>
          <SectionTitle>{t('settings.appearanceSection')}</SectionTitle>
          <div className="rounded-2xl bg-[var(--surface-1)] p-4">
            <div
              role="radiogroup"
              aria-label={t('settings.theme')}
              className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1"
            >
              {THEME_OPTIONS.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => chooseTheme(value)}
                  className={`min-h-12 flex-1 rounded-lg text-base font-semibold
                    transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                    ${
                      theme === value
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                        : 'text-[var(--text-2)]'
                    }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
              {t('settings.themeHint')}
            </p>
          </div>
        </section>

        <section>
          <SectionTitle>{t('settings.inputSection')}</SectionTitle>
          <div className="rounded-2xl bg-[var(--surface-1)] p-4">
            <p className="text-base text-[var(--text-1)]">{t('settings.demoTitle')}</p>
            <p className="mt-1 mb-4 text-sm leading-relaxed text-[var(--text-2)]">
              {t('settings.demoHint')}
            </p>

            <NumberInput
              value={demoWeight}
              onChange={setDemoWeight}
              step={2.5}
              suffix={t('units.kg')}
              aria-label={t('settings.demoLabel')}
            />

            <div className="mt-4 flex items-baseline justify-between border-t border-[var(--border)] pt-4">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('settings.demoReadingLabel')}
              </span>
              <span className="metric text-3xl leading-none font-semibold text-[var(--text-1)]">
                {demoWeight === undefined
                  ? t('settings.demoEmpty')
                  : `${demoWeight.toLocaleString('fr-FR')} ${t('units.kg')}`}
              </span>
            </div>
          </div>
          <p className="mt-3 px-1 text-sm text-[var(--text-2)]">{t('settings.demoNote')}</p>
        </section>
      </div>
    </Screen>
  );
}
