import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { ListRow } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { InstallSettings } from './InstallSettings';

/** Réglages › Application : l'installation, le hors-ligne, la base de preuves, le dépannage et les crédits. */
export function AppSettingsScreen() {
  const navigate = useAppNavigate();

  return (
    <Screen title={t('settings.appSection')} onBack={() => void navigate('/settings')}>
      <div className="flex flex-col gap-9">
        <InstallSettings />
        <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
          <ListRow
            title={t('settings.knowledgeLink')}
            subtitle={t('settings.knowledgeHint')}
            trailing={<ChevronRightIcon />}
            onClick={() => void navigate('/knowledge')}
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
      </div>
    </Screen>
  );
}
