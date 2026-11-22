import { useLiveQuery } from 'dexie-react-hooks';
import { getRpeDisciplineSettings } from '@/data/repositories/rpeDiscipline';
import type { Workout } from '@/data/types';
import {
  effectiveDisciplineState,
  exceedsCeiling,
  type RpeDisciplineState,
} from '@/lib/rpeDiscipline';

const CLEAR: RpeDisciplineState = { status: 'clear', overrides: 0 };

export interface LiveRpeDiscipline {
  state: RpeDisciplineState;
  /**
   * Ce RPE va-t-il suspendre la séance ? Une lecture **synchrone**, pour la bande d'effort : le bonus
   * de repos se décide au doigt, avant que l'écriture ne revienne, et il ne doit pas être annoncé
   * pour un repos que le protocole va arrêter. Le constat, lui, reste celui de la base.
   */
  wouldSuspend: (rpe: number) => boolean;
}

/**
 * Le verrou du protocole RPE pour la séance à l'écran, relu en direct dans la base.
 *
 * Aucun état en mémoire : la séance (`useActiveWorkout`) et le réglage sont deux requêtes vivantes,
 * et le verrou s'en déduit à chaque rendu. C'est ce qui le fait réapparaître tel quel après un
 * rechargement, un kill ou un redémarrage hors ligne — et ce qui l'empêche de jamais contredire le
 * refus que la base oppose à une série validée (`assertRpeDisciplineOpen`).
 *
 * Tant que le réglage charge, la séance est lue libre : le refus de la base reste la garde.
 */
export function useRpeDiscipline(workout: Workout | undefined): LiveRpeDiscipline {
  const settings = useLiveQuery(getRpeDisciplineSettings);
  if (workout === undefined || settings === undefined) {
    return { state: CLEAR, wouldSuspend: () => false };
  }
  return {
    state: effectiveDisciplineState(settings, workout.status, workout.rpeDiscipline),
    wouldSuspend: (rpe) => settings.enabled && exceedsCeiling(rpe, settings.ceiling),
  };
}
