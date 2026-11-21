import { t } from '@/i18n/fr';

/** Le pas des deux boutons : celui que tout le monde connaît des autres applis de salle. */
export const REST_SHIFT_SECONDS = 15;

/**
 * −15 s et +15 s, et « Passer », dans la barre de repos en bas de la séance (`RestDock`).
 *
 * Deux cibles de 48 px côte à côte : on raccourcit un repos parce qu'on est prêt plus tôt, on
 * l'allonge parce qu'on ne l'est pas encore — les deux se font d'une main, sans ouvrir de feuille.
 * Un repos raccourci à zéro se termine comme un repos écoulé (`restTimer.shift`).
 */
export function RestShift({
  onShift,
  onSkip,
  className = '',
}: {
  onShift: (seconds: number) => void;
  /** Termine le repos maintenant. Absent, le bouton n'est pas affiché. */
  onSkip?: () => void;
  /** La place dans la rangée du repos : décidée par le parent, qui connaît sa largeur. */
  className?: string;
}) {
  const button = `flex min-h-12 min-w-fit flex-1 items-center justify-center rounded-xl bg-[var(--surface-2)]
    px-0.5 text-base font-semibold @[23rem]:px-2 tabular transition-colors duration-[var(--dur-1)]
    active:bg-[var(--surface-1)]`;

  return (
    <div data-part="rest-shift" className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        data-shift="-15"
        aria-label={t('workout.restShorten')}
        onClick={() => onShift(-REST_SHIFT_SECONDS)}
        className={`${button} text-[var(--text-2)]`}
      >
        <span aria-hidden="true">{t('workout.restMinus')}</span>
      </button>
      <button
        type="button"
        data-shift="15"
        aria-label={t('workout.restLengthen')}
        onClick={() => onShift(REST_SHIFT_SECONDS)}
        className={`${button} text-[var(--accent-ink)]`}
      >
        <span aria-hidden="true">{t('workout.restPlus')}</span>
      </button>
      {onSkip !== undefined && (
        <button
          type="button"
          data-shift="skip"
          aria-label={t('workout.restSkip')}
          onClick={onSkip}
          className={`${button} text-[var(--text-1)]`}
        >
          <span aria-hidden="true">{t('workout.restSkipShort')}</span>
        </button>
      )}
    </div>
  );
}
