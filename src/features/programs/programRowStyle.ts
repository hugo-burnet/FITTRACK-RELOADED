// Le gabarit des lignes d'un programme (semaine en cours, semaines passées), partagé par leurs composants.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

/** « lundi 16 nov. » */
export const dayDateReading = (timestamp: number): string => dateFormatter.format(timestamp);

/**
 * Le gabarit d'une ligne de la semaine. Celui de `ListRow` (56 px, filet entre
 * lignes, posée dans une `Card`), repris ici parce que `ListRow` ne sait ni se
 * dire « pressé » (le créneau qu'on va lancer) ni porter un lien : le jour y est
 * une colonne à part, et la ligne reste une seule cible.
 */
export const WEEK_ROW_CLASS = `flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
  bg-[var(--surface-1)] px-4 py-3 text-left last:border-b-0`;

export const PRESSABLE_ROW_CLASS = `${WEEK_ROW_CLASS} transition-colors duration-[var(--dur-1)]
  active:bg-[var(--surface-2)] disabled:opacity-40`;

/** La part « choix » d'une ligne qui porte aussi une flèche d'ouverture : sans filet, il est sur la ligne. */
export const SELECT_PART_CLASS = `flex min-h-14 min-w-0 flex-1 items-center gap-3 bg-[var(--surface-1)]
  py-3 pl-4 pr-2 text-left transition-colors duration-[var(--dur-1)]
  active:bg-[var(--surface-2)] disabled:opacity-40`;
