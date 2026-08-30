import { artForMilestone, milestoneArtUrl } from '@/lib/milestones/art';
import { Sheet } from '@/ui';
import { captionForArt } from './artCaption';

/**
 * Le mème en grand, dans la feuille du bas — pas un lightbox centré.
 *
 * **Pourquoi une feuille.** C’est le geste de toute l’app : une main, le pouce
 * en bas, on glisse pour fermer. Un cadre au milieu de l’écran serait un autre
 * logiciel. L’image prend toute la largeur ; la légende est une ligne, pas une
 * notice.
 */
export function MilestonePeek({
  definitionId,
  title,
  onClose,
}: {
  definitionId: string | null;
  title: string;
  onClose: () => void;
}) {
  const key = definitionId === null ? undefined : artForMilestone(definitionId);

  return (
    <Sheet open={key !== undefined} onClose={onClose} title={title}>
      {key === undefined ? null : (
        <div className="pb-8">
          <img
            src={milestoneArtUrl(key)}
            alt=""
            className="animate-pop aspect-square w-full rounded-lg object-cover"
          />
          <p className="mt-4 text-pretty text-sm leading-relaxed text-[var(--text-2)]">
            {captionForArt(key)}
          </p>
        </div>
      )}
    </Sheet>
  );
}
