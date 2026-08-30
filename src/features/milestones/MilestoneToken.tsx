import { artForMilestone, milestoneArtUrl } from '@/lib/milestones/art';

/**
 * Le jeton d'un palier : l'illustration embarquée, pas le chiffre.
 *
 * **Le chiffre vit dans le titre à côté.** Le superposer sur 48 px noierait
 * Pepe comme le disque, et le lecteur d'écran le dirait deux fois. L'image
 * est `aria-hidden` pour la même raison que l'ancien disque.
 *
 * **Carré arrondi, pas un disque.** Un `rounded-full` coupe les visages
 * (Pepe, Wojak, trollface) pile là où on les reconnaît. Pas d'anneau
 * neutre : le trait autour du jeton mangeait l'image. L'accent de
 * l'accueil reste un anneau, pas un fond orange.
 */
export function MilestoneToken({
  definitionId,
  tone = 'neutral',
  size = 'md',
}: {
  definitionId: string;
  tone?: 'neutral' | 'accent';
  size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'h-20 w-20' : 'h-16 w-16';
  const ring = tone === 'accent' ? 'ring-2 ring-[var(--color-accent)]' : '';
  const key = artForMilestone(definitionId);

  if (key === undefined) {
    return (
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-lg bg-[var(--surface-2)] ${box} ${ring}`}
      />
    );
  }

  return (
    <img
      src={milestoneArtUrl(key)}
      alt=""
      aria-hidden="true"
      className={`shrink-0 rounded-lg object-cover ${box} ${ring}`}
    />
  );
}
