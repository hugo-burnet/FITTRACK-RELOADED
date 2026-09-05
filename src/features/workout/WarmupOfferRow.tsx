import { t } from '@/i18n/fr';
import { Button } from '@/ui';
import { formatNumber } from '@/ui/numberField';
import type { WarmupOffer } from './warmupOffer';

/**
 * « Ton échauffement de la dernière fois », au-dessus de la grille.
 *
 * **Le même bandeau que le coach, et pas un nouveau.** Même aplat `--surface-2`
 * en pleine largeur, même sur-titre `label-xs`, même rangée de commandes : les
 * deux disent la même chose à la même place — voilà ce que la dernière séance
 * suggère, à toi de voir. En inventer un second dialecte visuel pour la même
 * intention aurait coûté un apprentissage pour rien.
 *
 * **Trois issues, dont une sans bouton.** Ajouter écrit la montée telle quelle ;
 * Modifier rouvre la feuille sur ces paliers ; ignorer, c'est commencer à
 * soulever — la ligne s'efface d'elle-même à la première série validée. Il n'y
 * a donc pas de croix : une commande de plus pour refuser une proposition qui
 * part toute seule serait une commande de trop.
 */
export function WarmupOfferRow({
  offer,
  onAccept,
  onEdit,
}: {
  offer: WarmupOffer;
  onAccept: () => void;
  onEdit: () => void;
}) {
  const ramp = offer.suggestions
    .map((suggestion) =>
      t('workout.warmupOfferStep', {
        weight: formatNumber(suggestion.weightKg),
        reps: suggestion.reps,
      }),
    )
    .join(t('workout.warmupOfferSeparator'));

  return (
    <section
      className="w-full bg-[var(--surface-2)] px-4 py-3"
      aria-label={t('workout.warmupOfferTitle')}
    >
      <p className="label-xs font-semibold text-[var(--text-2)]">{t('workout.warmupOfferTitle')}</p>
      <p className="metric mt-1.5 text-base leading-snug text-[var(--text-1)]">{ramp}</p>
      {/* La charge a bougé : les paliers ont suivi. Le dire évite de croire à
          une recopie, et de recharger la barre d'hier. */}
      {offer.changedLoad && (
        <p className="mt-1 text-sm text-[var(--text-2)]">
          {t('workout.warmupOfferChanged', { weight: formatNumber(offer.targetWeightKg) })}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="primary" fullWidth onClick={onAccept}>
          {t('workout.warmupOfferAccept')}
        </Button>
        <Button variant="ghost" onClick={onEdit} className="shrink-0 border border-[var(--border)]">
          {t('workout.warmupOfferEdit')}
        </Button>
      </div>
    </section>
  );
}
