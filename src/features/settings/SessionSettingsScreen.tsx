import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { AnnouncerSettings } from './AnnouncerSettings';
import { EffortPromptSettings } from './EffortPromptSettings';
import { NotificationSettings } from './NotificationSettings';
import { OneRepMaxSettings } from './OneRepMaxSettings';
import { RpeDisciplineSettings } from './RpeDisciplineSettings';

/** Réglages › Séance : ce qui change ce que l'app dit, demande et estime pendant l'entraînement. */
export function SessionSettingsScreen() {
  const navigate = useAppNavigate();

  return (
    <Screen title={t('settings.sessionTitle')} onBack={() => void navigate('/settings')}>
      <div className="flex flex-col gap-9">
        <AnnouncerSettings />
        <EffortPromptSettings />
        <RpeDisciplineSettings />
        <OneRepMaxSettings />
        <NotificationSettings />
      </div>
    </Screen>
  );
}
