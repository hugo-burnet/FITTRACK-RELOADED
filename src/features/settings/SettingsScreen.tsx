import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { getDefaultLoadStepKg } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { isOfflineReady, subscribeAppUpdate } from '@/platform/appUpdate';
import { loadAnnouncerMode } from '@/stores/announcer';
import { loadTheme } from '@/stores/theme';
import { Card, ListRow } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';
import { ANNOUNCER_MODES } from './announcerModes';
import { backupAgoLabel } from './backupText';
import { THEME_OPTIONS } from './themeOptions';
import { useBackupStatus } from './useBackupStatus';

/**
 * Le sommaire des Réglages : le bandeau de sauvegarde, puis cinq lignes qui disent leur état et
 * ouvrent chacune leur page. Rien ne se règle ici.
 *
 * Des lignes et non des tuiles (`DESIGN.md`) : un état fait de mots tient en sous-titre.
 */
export function SettingsScreen() {
  const navigate = useAppNavigate();
  const { lastBackupAt, now } = useBackupStatus();
  const offlineReady = useSyncExternalStore(subscribeAppUpdate, isOfflineReady, () => false);
  // `null` : aucun pas posé ; `undefined` : pas encore lu.
  const step = useLiveQuery(async () => (await getDefaultLoadStepKg()) ?? null, []);
  // Lus au montage : le sommaire est remonté à chaque retour d'une page, et c'est là qu'un
  // changement de thème ou d'annonce doit se voir.
  const theme = loadTheme();
  const announcer = loadAnnouncerMode();

  const noBackup = lastBackupAt === undefined;
  const ago = noBackup ? '' : backupAgoLabel(lastBackupAt, now);
  const go = (page: string) => () => void navigate(`/settings/${page}`);

  const themeLabel = THEME_OPTIONS.find(({ value }) => value === theme)?.labelKey;
  const announcerLabel = ANNOUNCER_MODES.find(({ value }) => value === announcer)?.labelKey;

  return (
    <Screen title={t('settings.title')}>
      <div className="flex flex-col gap-7">
        <Card>
          <button
            type="button"
            onClick={go('backup')}
            data-part="row"
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
          >
            <span
              className={`min-w-0 flex-1 text-base font-semibold ${
                noBackup ? 'text-[var(--warn-ink)]' : 'text-[var(--text-1)]'
              }`}
            >
              {noBackup
                ? t('settings.summaryBackupNone')
                : t('settings.summaryBackupBanner', { ago })}
            </span>
            <span className="shrink-0 text-[var(--text-2)]">
              <ChevronRightIcon />
            </span>
          </button>
        </Card>

        <Card>
          <ListRow
            title={t('settings.appearanceSection')}
            subtitle={themeLabel === undefined ? undefined : t(themeLabel)}
            trailing={<ChevronRightIcon />}
            onClick={go('appearance')}
          />
          <ListRow
            title={t('settings.sessionTitle')}
            subtitle={announcerLabel === undefined ? undefined : t(announcerLabel)}
            trailing={<ChevronRightIcon />}
            onClick={go('session')}
          />
          <ListRow
            title={t('settings.coachSection')}
            subtitle={
              step === undefined
                ? undefined
                : typeof step === 'number'
                  ? t('settings.summaryStepValue', { value: formatNumber(step) })
                  : t('settings.summaryStepNone')
            }
            trailing={<ChevronRightIcon />}
            onClick={go('coach')}
          />
          <ListRow
            title={t('settings.backupTitle')}
            subtitle={t('settings.summaryBackupContent')}
            trailing={<ChevronRightIcon />}
            onClick={go('backup')}
          />
          <ListRow
            title={t('settings.appSection')}
            subtitle={t(offlineReady ? 'settings.summaryOfflineReady' : 'settings.summaryOfflinePending')}
            trailing={<ChevronRightIcon />}
            onClick={go('app')}
          />
        </Card>
      </div>
    </Screen>
  );
}
