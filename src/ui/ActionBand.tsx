type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** `accent` pour le verbe de l'écran, `quiet` pour une sortie. */
  tone?: 'accent' | 'quiet';
};

/**
 * L'action primaire d'un écran, en bande pleine largeur juste au-dessus des
 * onglets.
 *
 * Une bande et pas un bouton posé sur une barre. Le motif précédent empilait
 * trois couches pour une seule commande — une dalle de la couleur du fond, une
 * pastille arrondie dedans, les onglets dessous — et se lisait, mot pour mot,
 * « ça fait posé là ». La forme retenue est celle que l'app emploie déjà pour
 * la barre de reprise, la seule grande surface d'accent qui n'ait jamais
 * accroché : bord à bord, sans retrait, sans arrondi, 56 px.
 *
 * **Une seule par écran.** L'éditeur de routine en portait deux — « Terminé »
 * et « Démarrer » — alors que « Terminé » appelait le même `goBack` que la
 * flèche de l'en-tête. La règle du Lot 3 qui l'avait fait naître (« la vraie
 * sortie vit dans la zone du pouce ») datait d'avant cette flèche, ajoutée au
 * Lot 4 ; le doublon lui a simplement survécu.
 */
export function ActionBand({ label, onClick, disabled = false, tone = 'accent' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 w-full shrink-0 items-center justify-center border-t
        border-[var(--border)] px-4 text-lg font-semibold transition-[filter]
        duration-[var(--dur-1)] disabled:pointer-events-none disabled:opacity-40
        ${
          tone === 'accent'
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] active:brightness-95'
            : 'bg-[var(--surface-1)] text-[var(--text-1)] active:brightness-125'
        }`}
    >
      {label}
    </button>
  );
}
