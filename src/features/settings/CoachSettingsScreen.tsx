import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { CoachSettings } from './CoachSettings';

/** Réglages › Coach : le pas de charge par défaut et les bornes de volume. */
export function CoachSettingsScreen() {
  const navigate = useAppNavigate();

  return (
    <Screen title={t('settings.coachSection')} onBack={() => void navigate('/settings')}>
      <CoachSettings />
    </Screen>
  );
}
