import { useEffect, useState, type CSSProperties } from 'react';
import { t } from '@/i18n/fr';

/**
 * Combien de temps le rideau d'ouverture reste en place, en millisecondes.
 *
 * C'est une durée choisie, pas une mesure : la base est prête bien avant sur un
 * démarrage à chaud. Le rideau ne rapporte donc aucune progression — il présente
 * l'app. `main.tsx` fait courir cette attente **en parallèle** de la préparation
 * de la base : une base lente absorbe ces 2,5 s au lieu de s'y ajouter.
 */
export const BOOT_HOLD_MS = 2500;

/** Sa disparition. Doit rester égal à la durée de `boot-curtain` dans index.css. */
const BOOT_EXIT_MS = 320;

/**
 * Les deux paires de plaques du logo, dans l'ordre où on les enfile.
 *
 * Les coordonnées sont celles de `public/icon.svg`, au trait près : c'est le
 * logo qu'on anime, pas un dessin qui lui ressemble. Si l'icône change, ces
 * cinq chiffres changent avec elle. Chaque entrée décrit la plaque de gauche ;
 * la droite est son miroir autour de x = 12, le centre du dessin.
 *
 * `travel` est la distance parcourue avant de se poser. Le manchon vient de plus
 * loin que la petite plaque parce qu'il remonte toute la barre — c'est ce qui se
 * passe quand on charge, et deux glissements de longueur différente se lisent
 * comme deux gestes au lieu d'un effet répété.
 */
const PLATES = [
  { x: 6.5, half: 3.5, travel: 8, delay: 640 },
  { x: 3.5, half: 1.5, travel: 5, delay: 940 },
];

/**
 * Le logo, chargé sous nos yeux. Le `viewBox` est serré sur le dessin — l'icône
 * le noie dans sa tuile arrondie, qui ne sert qu'au lanceur.
 */
function LoadedBar() {
  return (
    <svg className="boot-bar" viewBox="2 7 20 10" fill="none" aria-hidden="true">
      <path
        className="boot-rail"
        d="M8 12h8"
        stroke="var(--accent-ink)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {PLATES.flatMap(({ x, half, travel, delay }) =>
        [x, 24 - x].map((cx) => (
          <path
            key={cx}
            className={`boot-plate boot-plate--${cx < 12 ? 'l' : 'r'}`}
            style={
              { '--boot-delay': `${delay}ms`, '--boot-travel': `${travel}px` } as CSSProperties
            }
            d={`M${cx} ${12 - half}v${half * 2}`}
            stroke="var(--accent-ink)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )),
      )}
    </svg>
  );
}

/**
 * L'ouverture de l'app, en trois temps : le manchon se pose, les deux paires de
 * plaques s'enfilent — puis la barre chargée se soulève, et c'est sur cette
 * frame-là que le principe apparaît. Charger, charger, lever. Rien ne tourne et
 * rien ne pulse : le mouvement a un début et une fin, comme une série.
 *
 * `exiting` rend le même écran **sans** aucune animation d'entrée : au moment où
 * `main.tsx` monte le routeur, ce composant est démonté puis remonté, et sans ce
 * drapeau la séquence entière repartirait de zéro pendant qu'elle s'efface.
 */
export function BootScreen({ exiting = false }: { exiting?: boolean }) {
  return (
    // `aria-hidden` seulement en sortie : à ce moment le vrai contenu est monté
    // dessous, et un lecteur d'écran n'a pas à relire un rideau qui s'efface. À
    // l'entrée, c'est le seul contenu à l'écran.
    <div className="boot" data-phase={exiting ? 'out' : 'in'} aria-hidden={exiting || undefined}>
      <div className="flex flex-col items-center gap-5">
        {/* Le levé porte sur le logo seul : c'est la barre qui monte, pas la page. */}
        <div className="boot-lift">
          <LoadedBar />
        </div>
        <p className="boot-mark">{t('app.name')}</p>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 px-6 text-center">
        <p className="boot-principle">{t('app.principle')}</p>
        <p className="boot-tagline">{t('app.tagline')}</p>
      </div>
    </div>
  );
}

/**
 * Le rideau une fois le routeur monté dessous : il s'efface, puis se retire.
 * Rendu au-dessus de l'app plutôt qu'à sa place, pour que le premier écran soit
 * déjà peint quand on le découvre.
 */
export function BootCurtain() {
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setLifted(true), BOOT_EXIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (lifted) return null;
  return <BootScreen exiting />;
}

/**
 * Shown when the seed failed. A fixed overlay rather than a flex sibling: the
 * shell's layout chain was measured on a real phone at Lot 1 and a degraded
 * state is not a reason to disturb it.
 */
export function SeedErrorBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="alert"
      className="safe-top fixed inset-x-0 top-0 z-50 border-b-2 border-[var(--color-warn)]
        bg-[var(--surface-2)]"
    >
      <div className="mx-auto flex max-w-[36rem] items-center gap-3 px-4 py-2">
        <p className="flex-1 text-sm leading-snug text-[var(--text-1)]">{t('boot.seedFailed')}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-12 shrink-0 px-3 text-sm font-semibold text-[var(--text-2)]"
        >
          {t('boot.dismiss')}
        </button>
      </div>
    </div>
  );
}
