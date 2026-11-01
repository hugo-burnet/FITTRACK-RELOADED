import { t } from '@/i18n/fr';

/** Le pas des deux boutons : celui que tout le monde connaît des autres applis de salle. */
export const REST_SHIFT_SECONDS = 15;

/**
 * −15 s et +15 s, sous l'en-tête de l'exercice qui se repose.
 *
 * Deux cibles de 48 px côte à côte : on raccourcit un repos parce qu'on est prêt plus tôt, on
 * l'allonge parce qu'on ne l'est pas encore — les deux se font d'une main, sans ouvrir de feuille.
 * Un repos raccourci à zéro se termine comme un repos écoulé (`restTimer.shift`).
 */
export function RestShift({ onShift }: { onShift: (seconds: number) => void }) {
  const button = `flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--surface-2)]
    text-base font-semibold tabular transition-colors duration-[var(--dur-1)]
    active:bg-[var(--surface-1)]`;

  return (
    <div data-part="rest-shift" className="flex gap-2 px-3 pb-3">
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
    </div>
  );
}
