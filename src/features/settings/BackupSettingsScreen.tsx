import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { BackupActions } from './BackupActions';
import { ReadableExports } from './ReadableExports';

/** Réglages › Sauvegarde : l'état, la sauvegarde complète et sa restauration, puis les exports lisibles. */
export function BackupSettingsScreen() {
  const navigate = useAppNavigate();

  return (
    <Screen title={t('settings.backupTitle')} onBack={() => void navigate('/settings')}>
      <div className="flex flex-col gap-9">
        <BackupActions />
        <ReadableExports />
      </div>
    </Screen>
  );
}
