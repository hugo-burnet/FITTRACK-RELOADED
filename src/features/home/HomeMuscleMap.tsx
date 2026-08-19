import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { toMuscleRows } from '@/lib/analytics/muscles';
import { periodBounds } from '@/lib/analytics/periods';
import { t } from '@/i18n/fr';
import { MuscleMap, balanceHighlight } from '@/ui/muscleMap';

/**
 * The body at the top of the home screen's Progression section.
 *
 * **This reopens a decision of Lot 12, deliberately and at the user's request.**
 * `HomeProgressLinks` said no chart is drawn here, so that opening the app never
 * pays for the analysis screens' JavaScript. The complaint that overturned it is
 * a fair one: nothing on the home screen suggested a body map existed at all, so
 * the feature was invisible to the only person using the app.
 *
 * The cost is paid down rather than accepted, in two ways:
 *
 * - **The chunk is deferred.** This module is `lazy`-loaded, so the 23 kB of
 *   geometry stay out of the startup bundle and arrive after the first paint.
 *   The rule's *reason* is honoured even though its letter is not.
 * - **One read, not two.** `useHistoricalPeriod` also fetches every completed
 *   timestamp to know whether earlier history exists — a second pass this
 *   screen has no use for, since it shows no "before this window" notice.
 *
 * Twelve weeks, fixed: the user chose it over all-history. It is the same
 * default the detail screen opens on, so tapping through changes the depth of
 * the reading and never the reading itself.
 */
const PERIOD = '12w';

interface Props {
  /**
   * Dit à la carte hôte si le dessin a quelque chose à montrer. Elle disparaît
   * entièrement quand la réponse est non : ses trois liens n'ont plus rien à
   * accompagner, et ils mèneraient à trois écrans vides.
   */
  onResolved: (drawn: boolean) => void;
}

export function HomeMuscleMap({ onResolved }: Props) {
  // Frozen on open, like every other historical window in the app: the bounds
  // must not slide under the reader at midnight.
  const [openedAt] = useState(() => Date.now());
  const { from, to } = periodBounds(PERIOD, openedAt);

  const workouts = useLiveQuery(
    async () =>
      from === undefined
        ? await listHistoricalWorkouts({ kind: 'all-history' })
        : await listHistoricalWorkouts({ kind: 'period', from, to }),
    [from, to],
  );

  const highlight =
    workouts === undefined
      ? null
      : balanceHighlight(muscleInvolvement(toMuscleRows(workouts)));
  const drawn = highlight === null ? null : Object.keys(highlight).length > 0;

  // Après le rendu, jamais pendant : prévenir la carte hôte au fil du rendu
  // reviendrait à écrire dans l'état d'un composant en train d'en rendre un
  // autre.
  useEffect(() => {
    if (drawn !== null) onResolved(drawn);
  }, [drawn, onResolved]);

  // Not answered yet: hold the drawing's own height, so the three buttons do not
  // jump under the thumb when it fills in.
  if (highlight === null) return <div className="h-72" aria-hidden />;

  // Answered, and there is nothing to draw — a fresh install, or twelve quiet
  // weeks. **No body at all rather than a dark one.** An all-unlit silhouette
  // says "you have trained nothing", which is both bleak and a claim the app has
  // no business making on its home screen; and reserving 256 px of emptiness for
  // it is worse than the missing drawing. Same rule as the records section on
  // the exercise sheet: nothing to report, so no section — et depuis que la
  // carte hôte le sait, elle s'en va avec, ses trois liens compris.
  if (!drawn) return null;

  // The separator belongs to the drawing, not to the buttons below it: hung on
  // the button row instead, it would still be drawn on a card that has no body
  // — a stray line across the top of an otherwise plain row of links.
  // La largeur est bridée ici, et pas dans `MuscleMap`.
  //
  // Le dessin est calé sur sa largeur (aspect-ratio 815/2048, soit deux figures
  // deux fois et demie plus hautes que larges) : laissé libre sur un téléphone
  // de 375 px, la paire fait 375 px de haut à elle seule. L'accueil est le seul
  // écran qui ait à arbitrer entre le corps et un bouton — 240 px de large, donc
  // 287 px de haut, est ce qui laisse « Lancer » au-dessus de la ligne de
  // flottaison d'un 375 × 812. Les écrans d'analyse, eux, gardent toute la
  // largeur : ils n'ont rien à faire tenir en dessous.
  //
  // C'est un arbitrage, et il se règle ici en un nombre.
  return (
    <div className="border-b border-[var(--border)] px-4 pt-4 pb-2">
      <div className="mx-auto max-w-[15rem]">
        <MuscleMap highlight={highlight} label={t('home.bodyLabel')} />
      </div>
    </div>
  );
}
