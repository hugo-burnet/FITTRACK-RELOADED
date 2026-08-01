import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@/ui/icons';
import { Screen } from '@/app/Screen';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { t } from '@/i18n/fr';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { shareText, type ShareOutcome } from '@/platform/share';
import { applyTheme, loadTheme } from '@/stores/theme';
import type { Theme } from '@/stores/theme';
import { resnapshotHistory } from '@/data/repositories/historyRepair';
import { ConfirmSheet, ListRow, NumberInput, SectionTitle } from '@/ui';

const THEME_OPTIONS: { value: Theme; labelKey: 'settings.themeDark' | 'settings.themeLight' }[] = [
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'light', labelKey: 'settings.themeLight' },
];

export function SettingsScreen() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [demoWeight, setDemoWeight] = useState<number | undefined>(100);
  const [repairOpen, setRepairOpen] = useState(false);
  const [historyShareOutcome, setHistoryShareOutcome] = useState<ShareOutcome | null>(null);
  /** Ce que la réparation a fait, dit une fois et sans fenêtre à fermer. */
  const [repairReport, setRepairReport] = useState<string>();
  const historyMarkdown = useLiveQuery(async () => {
    const scope = { kind: 'all-history' } as const;
    const sources = await listHistoricalWorkouts(scope);
    if (sources.length === 0) return '';

    return serializeMarkdown(
      projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );
  }, []);

  const repair = () => {
    void resnapshotHistory().then(({ repaired }) => {
      setRepairReport(
        repaired === 0
          ? t('settings.repairDoneNone')
          : t(repaired === 1 ? 'settings.repairDoneOne' : 'settings.repairDone', { repaired }),
      );
    });
  };

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const shareHistory = () => {
    setHistoryShareOutcome(null);
    void shareText({
      title: t('settings.exportHistoryTitle'),
      text: historyMarkdown ?? '',
    }).then((outcome) => {
      setHistoryShareOutcome(outcome === 'copied' || outcome === 'failed' ? outcome : null);
    });
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

        <section>
          <SectionTitle>{t('settings.dataSection')}</SectionTitle>
          <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
            <ListRow
              title={t('settings.exportHistoryLink')}
              subtitle={t('settings.exportHistoryHint')}
              disabled={historyMarkdown === undefined || historyMarkdown === ''}
              onClick={shareHistory}
            />
            <ListRow
              title={t('settings.repairLink')}
              subtitle={t('settings.repairHint')}
              onClick={() => setRepairOpen(true)}
            />
            <ListRow
              title={t('settings.debugLink')}
              subtitle={t('settings.debugHint')}
              trailing={<ChevronRightIcon />}
              onClick={() => void navigate('/settings/debug')}
            />
          </div>
          {repairReport !== undefined && (
            <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">{repairReport}</p>
          )}
          {historyShareOutcome !== null && (
            <p
              role="status"
              className={`mt-3 px-1 text-sm leading-relaxed ${
                historyShareOutcome === 'failed'
                  ? 'text-[var(--danger-ink)]'
                  : 'text-[var(--text-2)]'
              }`}
            >
              {t(
                historyShareOutcome === 'failed'
                  ? 'settings.exportHistoryFailed'
                  : 'settings.exportHistoryCopied',
              )}
            </p>
          )}
        </section>
      </div>

      <ConfirmSheet
        open={repairOpen}
        onClose={() => setRepairOpen(false)}
        title={t('settings.repairConfirmTitle')}
        body={t('settings.repairConfirmBody')}
        confirmLabel={t('settings.repairConfirmAction')}
        onConfirm={repair}
      />
    </Screen>
  );
}
