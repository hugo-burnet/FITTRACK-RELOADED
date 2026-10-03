import { useEffect, useState } from 'react';

/**
 * L'horloge de l'ouverture TTY1 : les millisecondes écoulées depuis le montage, **par sauts** — de
 * un instant du script au suivant, jamais entre deux.
 *
 * Un `setTimeout` par instant distinct plutôt qu'un intervalle : l'écran n'est redessiné que quand
 * une ligne arrive, et une ligne arrive exactement quand son heure sonne. Un thread occupé (la base
 * qui s'ouvre) retarde un tour, jamais n'en saute un ni ne les mélange : `Math.max` garantit que
 * l'horloge ne recule pas.
 *
 * `immediate` : tout est déjà dit, sans temporisateur. C'est la phase de sortie du rideau, qui
 * montre l'écran dans son état final sans rien rejouer, et le mouvement réduit.
 *
 * `instants` doit garder la même identité d'un rendu à l'autre (un `useMemo` chez l'appelant) :
 * il relance les temporisateurs quand il change.
 */
export function useBootClock(instants: readonly number[], immediate: boolean): number {
  const [elapsed, setElapsed] = useState(immediate ? Number.POSITIVE_INFINITY : 0);

  useEffect(() => {
    if (immediate) return;

    const timers = [...new Set(instants)]
      .sort((first, second) => first - second)
      .map((instant) =>
        window.setTimeout(() => setElapsed((current) => Math.max(current, instant)), instant),
      );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [instants, immediate]);

  return immediate ? Number.POSITIVE_INFINITY : elapsed;
}
