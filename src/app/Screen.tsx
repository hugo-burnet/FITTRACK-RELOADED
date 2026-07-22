import type { ReactNode } from 'react';
import { t } from '@/i18n/fr';
import { ArrowLeftIcon } from '@/ui/icons';

type Props = {
  title: string;
  /**
   * Draws the back arrow, on the left, before the title. Every screen that can
   * be left gets the identical control from here rather than spelling out its
   * own.
   */
  onBack?: () => void;
  /** Right-hand slot in the header: a count, an action. */
  action?: ReactNode;
  /**
   * L'`ActionBand` de l'écran : son verbe, dans la zone du pouce (règle du
   * Lot 3). **Une seule**, et jamais une navigation — revenir en arrière est le
   * travail de la flèche de l'en-tête, pas d'un second bouton. Absente, rien
   * n'est dessiné.
   */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The frame every screen shares: one h1, one measure, one set of margins.
 *
 * The way back is an **arrow on the left**, not the destination's name on the
 * right. Reported from the phone: a word in the top corner reads as a label
 * rather than as something to press, and it also put a second piece of text
 * beside a title the user chose, on 375px. The arrow is the mark every phone
 * already uses, and it costs the title no room.
 *
 * **Le défilement vit ici, entre l'en-tête et le pied.** Il vivait au-dessus,
 * sur le `<main>` de la coquille, et les barres d'action étaient alors des
 * `position: sticky` posées par-dessus le contenu : ça tranchait un mot en
 * deux, et une carte glissant dessous se confondait avec la bande. Remonté du
 * téléphone en ces termes — « ça chevauche, ça fait posé là ».
 *
 * C'est exactement le raisonnement que le Lot 1 a tenu pour la barre de
 * navigation, jamais transposé à celle-ci : **frère flex, pas superposition.**
 * Épinglée de la même façon, mais aucun écran ne peut plus cacher sa dernière
 * ligne derrière elle — le défaut devient structurellement impossible au lieu
 * d'être compensé par une marge que chaque écran doit se souvenir de poser.
 *
 * `min-h-0` sur les deux colonnes flex n'est pas décoratif : sans lui un enfant
 * défilant refuse de rétrécir sous sa hauteur de contenu, et c'est la page
 * entière qui se met à défiler — pied compris.
 */
export function Screen({ title, onBack, action, footer, children }: Props) {
  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[36rem] flex-1 flex-col">
      <header className="flex min-h-16 shrink-0 items-center gap-2 px-4 pt-5 pb-4">
        {onBack && (
          <button
            type="button"
            aria-label={t('common.back')}
            onClick={onBack}
            className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-xl
              text-[var(--text-1)] active:bg-[var(--surface-1)]"
          >
            <ArrowLeftIcon />
          </button>
        )}
        {/* Truncates rather than wraps: a title is the one line you scan, and a
            routine's name belongs to the user — it can be anything. */}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-[var(--text-1)]">
          {title}
        </h1>
        {action}
      </header>

      {/* Grows to fill the screen so a lone empty state can centre itself in it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-8">
        {children}
      </div>

      {/* Rendu tel quel, sans enveloppe : la bande va d'un bord à l'autre et
          porte son propre filet. Une dalle qui contiendrait une pastille ferait
          trois couches de décor pour une commande. */}
      {footer}
    </section>
  );
}
