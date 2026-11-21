import { useAppNavigate } from '@/app/navigation';
import { t } from '@/i18n/fr';
import { Card, ListRow, SectionTitle } from '@/ui';
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
      <Card>
        <ListRow
          title={t('settings.volumeLink')}
          subtitle={t('settings.volumeHint')}
          onClick={() => void navigate('/settings/volume')}
        />
        <DefaultLoadStepRow />
      </Card>
    </section>
  );
}
