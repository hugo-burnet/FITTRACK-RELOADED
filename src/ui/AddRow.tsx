import { PlusIcon } from './icons';

/**
 * "Encore un de ceux-là" — le seul geste d'ajout de l'app.
 *
 * Le motif vient du Lot 4, en pied de carte d'exercice ; il vivait en double
 * dans deux composants, et le Lot 5 en a d'abord inventé un troisième — une
 * boîte en pointillés, centrée, sans fond. Elle ne ressemblait à rien d'autre
 * dans l'app : toutes les surfaces d'ici sont pleines et sans bordure, si bien
 * qu'un contour vide se lisait comme un emplacement à remplir, pas comme une
 * commande. Deux « + » cohabitaient alors sur le même écran en deux langues.
 *
 * Une seule langue, donc, à tous les niveaux : la ligne s'ajoute au pied de la
 * carte qu'elle allonge, l'exercice au pied de la liste qu'il allonge — dans une
 * `Card` à lui, parce que sur ces écrans **tout bloc est une carte**. Ce qui
 * change d'un cas à l'autre, c'est ce qu'on ajoute, et c'est exactement ce que
 * le libellé dit.
 */
export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-base
        font-semibold text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
        active:bg-[var(--surface-2)]"
    >
      <PlusIcon width="18" height="18" />
      {label}
    </button>
  );
}
