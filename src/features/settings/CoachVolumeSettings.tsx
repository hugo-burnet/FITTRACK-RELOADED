import { useAppNavigate } from '@/app/navigation';
import { t } from '@/i18n/fr';
import { ListRow, SectionTitle } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';

/**
 * L'entrée vers les bornes de volume du coach. Une seule ligne : l'écran qu'elle ouvre a trop à dire
 * pour tenir dans les Réglages, et les bornes se règlent une fois, pas à chaque séance.
 */
export function CoachVolumeSettings() {
  const navigate = useAppNavigate();

  return (
    <section>
      <SectionTitle>{t('settings.coachSection')}</SectionTitle>
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          title={t('settings.volumeLink')}
          subtitle={t('settings.volumeHint')}
          trailing={<ChevronRightIcon />}
          onClick={() => void navigate('/settings/volume')}
        />
      </div>
    </section>
  );
}
