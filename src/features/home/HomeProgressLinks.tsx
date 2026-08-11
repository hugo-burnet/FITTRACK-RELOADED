import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Card, SectionTitle } from '@/ui';

/**
 * Le corps travaillé, puis les trois analyses en trois cases.
 *
 * **Un dessin est désormais rendu ici, et c'est un revirement assumé.** Ce
 * fichier disait qu'aucun graphique ne devait l'être, pour que l'ouverture de
 * l'app ne paie jamais le JavaScript des écrans d'analyse. Le reproche qui a
 * renversé la règle est juste : rien sur l'accueil ne laissait deviner qu'un
 * schéma musculaire existait, donc la fonctionnalité était invisible pour la
 * seule personne qui utilise l'app.
 *
 * **La raison de la règle est gardée même si sa lettre ne l'est plus** : le
 * corps est dans un module `lazy`, donc ses 23 ko de géométrie restent hors du
 * bundle de démarrage et arrivent après le premier rendu. L'accueil s'affiche
 * exactement aussi vite qu'avant ; le dessin se remplit ensuite.
 *
 * Le mot court est pour l'œil, sur trois colonnes de 375 px ; le nom complet de
 * l'écran est donné à l'oreille, et c'est le même que dans l'écran Analyses.
 */
const HomeMuscleMap = lazy(() =>
  import('./HomeMuscleMap').then((module) => ({ default: module.HomeMuscleMap })),
);
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
        {/* Une trame vide à la hauteur du dessin, jamais un spinner : le chunk
            arrive en une frame ou deux, et réserver la place empêche les trois
            boutons de sauter sous le pouce au moment où il se remplit. */}
        <Suspense fallback={<div className="h-64" aria-hidden />}>
          <HomeMuscleMap />
        </Suspense>

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
