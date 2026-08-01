import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';

/**
 * Les trois analyses, en trois cases.
 *
 * Aucun graphique n'est dessiné ici : ces écrans sont chargés à la demande
 * (`features/analytics/routes.tsx`), et en rendre un sur l'accueil ferait payer
 * leur JavaScript à chaque ouverture de l'app — exactement ce que le
 * `lazy` d'origine évite. Un raccourci n'est qu'un lien.
 *
 * Le mot court est pour l'œil, sur trois colonnes de 375 px ; le nom complet de
 * l'écran est donné à l'oreille, et c'est le même que dans l'écran Analyses.
 */
const LINKS: Array<{ to: string; labelKey: TranslationKey; nameKey: TranslationKey }> = [
  { to: '/analytics/weekly', labelKey: 'home.progressPace', nameKey: 'weekly.link' },
  { to: '/analytics/volume', labelKey: 'home.progressVolume', nameKey: 'volume.link' },
  { to: '/analytics/muscles', labelKey: 'home.progressMuscles', nameKey: 'muscles.link' },
];

export function HomeProgressLinks() {
  const navigate = useNavigate();

  return (
    <section>
      <SectionTitle>{t('home.progressSection')}</SectionTitle>

      <Card>
        <div className="grid grid-cols-3">
          {LINKS.map(({ to, labelKey, nameKey }) => (
            <button
              key={to}
              type="button"
              aria-label={t(nameKey)}
              onClick={() => void navigate(to)}
              className="flex min-h-14 items-center justify-center border-l border-[var(--border)]
                p-4 text-base font-semibold text-[var(--text-1)] first:border-l-0
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}
