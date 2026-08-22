import { useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@/ui/icons';
import { Screen } from '@/app/Screen';
import { db } from '@/data/db';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { t, type TranslationKey } from '@/i18n/fr';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { shareText, type ShareOutcome } from '@/platform/share';
import { saveTextFile } from '@/platform/saveFile';
import { isOfflineReady, subscribeAppUpdate } from '@/platform/appUpdate';
import {
  isInstallAvailable,
  isInstalled,
  promptInstall,
  subscribeInstall,
  type InstallOutcome,
} from '@/platform/install';
import { buildCsvExport, csvExportFileName } from '@/data/repositories/csvExport';
import { applyTheme, loadTheme } from '@/stores/theme';
import type { Theme } from '@/stores/theme';
import { ListRow, SectionTitle } from '@/ui';
import { AnnouncerSettings } from './AnnouncerSettings';
import { BackupActions } from './BackupActions';
import { EffortPromptSettings } from './EffortPromptSettings';
import { NotificationSettings } from './NotificationSettings';
import { OneRepMaxSettings } from './OneRepMaxSettings';

const THEME_OPTIONS: { value: Theme; labelKey: 'settings.themeDark' | 'settings.themeLight' }[] = [
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'light', labelKey: 'settings.themeLight' },
];

/** Every answer the browser can give to "install this", each with its sentence. */
const INSTALL_MESSAGE = {
  installed: 'settings.installDone',
  dismissed: 'settings.installDismissed',
  unavailable: 'settings.installUnavailable',
  failed: 'settings.installFailed',
} as const satisfies Record<InstallOutcome, TranslationKey>;

export function SettingsScreen() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [historyShareOutcome, setHistoryShareOutcome] = useState<ShareOutcome | null>(null);
  /** Ce que la sauvegarde CSV a donné, dit une fois sous la liste. */
  const [csvMessage, setCsvMessage] = useState<string>();
  const [csvFailed, setCsvFailed] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  /** Ce que l'invite d'installation a donné. */
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome | null>(null);
  const installAvailable = useSyncExternalStore(subscribeInstall, isInstallAvailable, () => false);
  const offlineReady = useSyncExternalStore(subscribeAppUpdate, isOfflineReady, () => false);
  // Lu une fois : le mode d'affichage ne change pas en cours de session, et
  // `matchMedia` n'existe pas sous jsdom.
  const [standalone] = useState(isInstalled);
  const historyMarkdown = useLiveQuery(async () => {
    const scope = { kind: 'all-history' } as const;
    const sources = await listHistoricalWorkouts(scope);
    if (sources.length === 0) return '';

    return serializeMarkdown(
      projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );
  }, []);

  /** Le compte des séances terminées : rien à sauvegarder, rien à cliquer. */
  const workoutCount = useLiveQuery(
    async () =>
      (await db.workouts.where('status').equals('completed').toArray()).filter(
        (workout) => workout.deletedAt === 0,
      ).length,
    [],
    0,
  );

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  /**
   * L'invite d'installation. Le bouton reste cliquable même quand le navigateur
   * n'a rien à proposer : une ligne grisée n'explique pas pourquoi, et la
   * réponse « déjà installée, ou à ajouter depuis le menu » est justement ce que
   * l'utilisateur a besoin de lire à ce moment-là.
   */
  const install = async () => {
    setInstallOutcome(await promptInstall());
  };

  /**
   * Chrome décide seul du moment où il fire `beforeinstallprompt`, et il peut le
   * faire après que l'utilisateur a tapé la ligne. « Déjà installée, ou à
   * ajouter depuis le menu » deviendrait alors faux sous les yeux de quelqu'un
   * qui a maintenant une vraie invite disponible. Le message se retire de
   * lui-même plutôt que de survivre à sa raison d'être.
   */
  const shownOutcome = installOutcome === 'unavailable' && installAvailable ? null : installOutcome;

  /**
   * La sauvegarde réimportable. Le fichier est fabriqué au clic et pas tenu à
   * jour en permanence : un `useLiveQuery` sur tout l'historique reconstruirait
   * le CSV entier à chaque série validée, pour un bouton qu'on touche deux fois
   * par mois.
   */
  const saveCsv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    setCsvMessage(undefined);
    setCsvFailed(false);
    try {
      const csv = await buildCsvExport();
      const outcome = await saveTextFile({
        name: csvExportFileName(Date.now()),
        text: csv,
        type: 'text/csv;charset=utf-8',
        title: t('settings.exportCsvTitle'),
      });
      if (outcome === 'failed') {
        setCsvFailed(true);
        setCsvMessage(t('settings.exportCsvFailed'));
      } else if (outcome === 'downloaded') {
        setCsvMessage(t('settings.exportCsvDownloaded'));
      }
    } catch {
      setCsvFailed(true);
      setCsvMessage(t('settings.exportCsvFailed'));
    } finally {
      setCsvBusy(false);
    }
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
          <SectionTitle>{t('settings.appSection')}</SectionTitle>
          <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
            <ListRow
              title={t('settings.installLink')}
              subtitle={t('settings.installHint')}
              disabled={standalone}
              onClick={() => void install()}
            />
          </div>
          {shownOutcome !== null && (
            <p
              role="status"
              className={`mt-3 px-1 text-sm leading-relaxed ${
                shownOutcome === 'failed' ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
              }`}
            >
              {t(INSTALL_MESSAGE[shownOutcome])}
            </p>
          )}
          {/*
            L'état hors-ligne se lit, il ne se règle pas : c'est la réponse à
            « est-ce que ça marchera au sous-sol ? », la seule question que la
            règle n°2 pose vraiment. Il vit sous la ligne d'installation parce
            que c'est l'installation qui le déclenche.
          */}
          <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
            {t(offlineReady ? 'settings.offlineReady' : 'settings.offlinePending')}
          </p>
        </section>

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

        <AnnouncerSettings />

        <OneRepMaxSettings />

        <EffortPromptSettings />

        <NotificationSettings />

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
              title={t('settings.exportCsvLink')}
              subtitle={t('settings.exportCsvHint')}
              disabled={csvBusy || workoutCount === 0}
              onClick={() => void saveCsv()}
            />
            <ListRow
              title={t('settings.debugLink')}
              subtitle={t('settings.debugHint')}
              trailing={<ChevronRightIcon />}
              onClick={() => void navigate('/settings/debug')}
            />
            <ListRow
              title={t('settings.creditsLink')}
              subtitle={t('settings.creditsHint')}
              trailing={<ChevronRightIcon />}
              onClick={() => void navigate('/settings/about')}
            />
          </div>
          {csvMessage !== undefined && (
            <p
              role="status"
              className={`mt-3 px-1 text-sm leading-relaxed ${
                csvFailed ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
              }`}
            >
              {csvMessage}
            </p>
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

        <BackupActions />
      </div>
    </Screen>
  );
}
