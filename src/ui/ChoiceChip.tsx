/**
 * Un choix parmi quelques-uns, posé à plat plutôt que caché dans un sélecteur.
 *
 * **Deux rangs, et c'est tout l'objet du composant.** Une *valeur* choisie prend
 * l'aplat d'accent : c'est le réglage, il se lit d'un coup d'œil depuis l'autre
 * bout de la pièce. Un *mode* choisi — « Aucun », « Non comptée », tout ce qui
 * dit « pas de valeur ici » — prend l'accent doux : c'est un choix légitime,
 * mais il reste subordonné aux valeurs et à l'action principale de l'écran.
 * Sans cette distinction, « Non comptée » criait plus fort que « 70 % » alors
 * qu'il dit exactement le contraire.
 *
 * Le mode se pose sur sa propre ligne chez l'appelant, jamais dans la grille des
 * valeurs : côte à côte, il se lit comme une valeur de plus.
 *
 * Extrait de `RestPicker`, qui portait ces règles en commentaire et les gardait
 * pour lui — la carte de charge en avait recopié une moitié.
 */
export function ChoiceChip({
  label,
  active,
  numeric = false,
  fill = false,
  quietActive = false,
  onClick,
}: {
  label: string;
  active: boolean;
  /** Chiffres alignés : « 2:30 » et « 70 % » se comparent en colonne. */
  numeric?: boolean;
  /** Occuper la cellule de grille, plutôt que d'épouser le libellé. */
  fill?: boolean;
  /** Marque ce chip comme un mode, pas comme une valeur. */
  quietActive?: boolean;
  onClick: () => void;
}) {
  const activeClass = quietActive
    ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
    : 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-xl text-base font-semibold transition-colors
        duration-[var(--dur-1)] ease-[var(--ease-mech)] ${fill ? 'w-full px-1' : 'px-4'} ${
          numeric ? 'metric' : ''
        } ${active ? activeClass : 'bg-[var(--surface-2)] text-[var(--text-1)]'}`}
    >
      {label}
    </button>
  );
}
