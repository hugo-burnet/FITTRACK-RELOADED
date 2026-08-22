import type { ReactNode } from 'react';

/**
 * Le bouton du coin haut-droit d'un écran : une icône, jamais un mot.
 *
 * Établi au Lot 3 sur la bibliothèque, repris au Lot 4 sur les routines, et
 * écrit deux fois à l'identique. Nommé ici avant qu'un troisième écran n'en
 * réinvente une variante — ce que le Lot 5 a précisément fait en posant un
 * chronomètre à cet endroit : un relevé qui était secrètement un menu, sans
 * rien pour le dire, sur l'écran le plus important de l'app.
 *
 * Une icône et pas un mot, parce que le titre à sa gauche est choisi par
 * l'utilisateur et peut être n'importe quoi : c'est la leçon du Lot 4 sur les
 * trois éléments en concurrence sur 375 px. Un relevé, lui, descend au-dessus
 * de la liste qu'il compte.
 */
export function HeaderAction({
  label,
  onClick,
  children,
  pressed,
  disabled = false,
  tutorialId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  tutorialId?: string;
}) {
  return (
    <button
      type="button"
      data-tutorial-id={tutorialId}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      // `last:` and not a bare `-mr-2`: the negative margin exists so the icon's
      // 48px box overhangs the screen padding and the glyph lands on the optical
      // edge. That is a property of the button at the EDGE, not of every button.
      // Applied to all of them it ate exactly the `gap-2` of the workout header —
      // reported from the phone, the deload chip glued to the chronometer — and
      // it silently overlapped the two icons of the history header by 8px.
      className={`flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
        last:-mr-2 active:bg-[var(--surface-1)] disabled:opacity-60
        ${pressed ? 'bg-[var(--accent-soft)]' : ''}`}
    >
      {children}
    </button>
  );
}
