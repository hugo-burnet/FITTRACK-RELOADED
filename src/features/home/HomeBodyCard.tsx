import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/i18n/fr';
import type { TranslationKey } from '@/i18n/fr';
import { Card } from '@/ui';

/**
 * Le corps travaillé, en tête d'écran, et les trois analyses à son pied.
 *
 * **C'est désormais la première chose de l'accueil, et c'est le sujet de l'app.**
 * Le dessin vivait tout en bas, sous une carte de semaine, une pesée, la séance
 * à lancer et l'historique récent : cinq blocs à franchir pour voir la seule
 * image qui répond à *qu'est-ce que je travaille, et qu'est-ce que je laisse de
 * côté*. Il ouvre maintenant l'écran, et la séance à lancer le suit
 * immédiatement — regarder, puis partir.
 *
 * **Le dessin porte enfin un nom.** Il était `aria-hidden` parce que les écrans
 * qui l'affichaient nommaient les muscles en toutes lettres à côté ; ici il n'y
 * a pas de liste, donc il n'y a plus de doublon à taire.
 *
 * **Le chunk reste `lazy`.** Les 23 ko de géométrie n'entrent pas dans le bundle
 * de démarrage : l'accueil s'affiche aussi vite qu'avant, le dessin se remplit
 * ensuite. Ce que la règle du Lot 12 protégeait est gardé ; ce qu'elle
 * interdisait — un graphique sur l'accueil — est assumé depuis le Lot 18.
 *
 * Pas de titre de section au-dessus : un corps humain n'a pas besoin qu'on
 * annonce que c'en est un, et c'est un intertitre de moins sur un écran dont le
 * défaut était d'en avoir cinq.
 *
 * **Sans dessin, pas de carte.** Le corps ne dessine rien quand rien n'a été
 * travaillé sur douze semaines — installation neuve, ou douze semaines
 * silencieuses. Il restait alors 56 px de trois boutons collés sous le titre de
 * l'écran : une barre d'onglets égarée, qui menait à trois analyses vides et
 * que plus rien ne nommait. La carte s'en va avec le dessin ; Rythme, Volume et
 * Muscles se retrouvent depuis l'Historique et depuis la fiche d'un exercice.
 */
const HomeMuscleMap = lazy(() =>
  import('./HomeMuscleMap').then((module) => ({ default: module.HomeMuscleMap })),
);

const LINKS: Array<{ to: string; labelKey: TranslationKey; nameKey: TranslationKey }> = [
  { to: '/analytics/weekly', labelKey: 'home.progressPace', nameKey: 'weekly.link' },
  { to: '/analytics/volume', labelKey: 'home.progressVolume', nameKey: 'volume.link' },
  { to: '/analytics/muscles', labelKey: 'home.progressMuscles', nameKey: 'muscles.link' },
];

export function HomeBodyCard() {
  const navigate = useNavigate();
  // `null` tant que le dessin n'a pas répondu : la carte tient sa place pendant
  // ce temps-là plutôt que d'apparaître après coup sous le pouce.
  const [drawn, setDrawn] = useState<boolean | null>(null);

  if (drawn === false) return null;

  return (
    <section>
      <Card>
        {/* Une trame vide à la hauteur du dessin, jamais un spinner : le chunk
            arrive en une frame ou deux, et réserver la place empêche les trois
            boutons de sauter sous le pouce au moment où il se remplit. */}
        <Suspense fallback={<div className="h-[26rem]" aria-hidden />}>
          <HomeMuscleMap onResolved={setDrawn} />
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
