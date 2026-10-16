import { useAppNavigate } from '@/app/navigation';
import { t } from '@/i18n/fr';
import { ListRow, SectionTitle } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { DefaultLoadStepRow } from './DefaultLoadStepRow';

/**
 * Ce que le coach lit des Réglages : les bornes de volume et le pas de charge. Deux lignes, parce que
 * ce sont des réglages qu'on pose une fois, pas à chaque séance.
 *
 * Les bornes de volume ouvrent leur propre écran — il a trop à dire pour tenir ici. Le pas de charge
 * tient dans une feuille.
 */
export function CoachSettings() {
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
        <DefaultLoadStepRow />
      </div>
    </section>
  );
}
