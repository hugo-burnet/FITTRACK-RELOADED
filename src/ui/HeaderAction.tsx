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
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="-mr-2 flex size-12 shrink-0 items-center justify-center rounded-xl
        text-[var(--accent-ink)] active:bg-[var(--surface-1)]"
    >
      {children}
    </button>
  );
}
