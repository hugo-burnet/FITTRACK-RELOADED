import { RestRail, RestStatus } from './RestRail';
import { RestShift } from './RestShift';

type Props = {
  startedAt: number;
  endsAt: number;
  /** Keeps the wall clock running while muting every rest-owned sound. */
  audioSuppressed: boolean;
  /** Returns true when the next set takes over with its repetition cadence. */
  onDone: (audioAllowed: boolean) => boolean;
  /** −15 s or +15 s on the rest in progress. */
  onShift: (seconds: number) => void;
  /** Ends the rest now. */
  onSkip: () => void;
};

/**
 * Le repos en cours, épinglé en bas de l'écran de séance, juste au-dessus de « Terminer la séance ».
 *
 * Il vivait dans l'en-tête de la carte de l'exercice qui se repose, en 14 px, et sortait de l'écran
 * dès qu'on faisait défiler jusqu'à l'exercice suivant — avec ses −15 s / +15 s (audit v2.19,
 * constat 3). Ici il est un frère flex de la bande d'action, hors de la zone qui défile : visible quel
 * que soit le défilement, et sous le pouce.
 *
 * Les mêmes pièces qu'avant, déplacées et non refaites : `RestRail` (la barre, sa minuterie
 * d'échéance, et en Cyber la barre de vie et ses dégâts — les feuilles de thème la trouvent par son
 * `data-part`, où qu'elle soit), `RestStatus` (le décompte lisible) et `RestShift` (les boutons, en
 * parallélogrammes en Cyber). La vie de la minuterie d'échéance est celle de ce composant : il est
 * monté tant que le repos dure, et remonté à chaque nouveau repos (clé du parent).
 */
export function RestDock({ startedAt, endsAt, audioSuppressed, onDone, onShift, onSkip }: Props) {
  return (
    <div
      data-part="rest-dock"
      className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-1)] px-3 pt-2 pb-3"
    >
      <div className="relative pb-4">
        <RestStatus endsAt={endsAt} />
        <RestRail
          startedAt={startedAt}
          endsAt={endsAt}
          audioSuppressed={audioSuppressed}
          onDone={onDone}
        />
      </div>
      <RestShift onShift={onShift} onSkip={onSkip} />
    </div>
  );
}
