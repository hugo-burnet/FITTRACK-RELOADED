import type { WorkoutSet } from '@/data/types';

/**
 * Où en est une série unilatérale — premier côté, changement, second côté.
 *
 * Pure et dérivée d'une **échéance absolue** plutôt que d'un compte à rebours en
 * mémoire. Un minuteur repart de zéro après un écran éteint, un appel ou un kill
 * de l'application : il renvoyait au premier côté quelqu'un qui venait de finir
 * les deux. L'instant où le second côté commence est écrit en base ; l'écran ne
 * fait que comparer l'heure à ce nombre.
 */
export const SIDE_TRANSITION_MS = 10_000;

export type SideStage = 'first' | 'transition' | 'second';

export function sideStageFor(
  set: Pick<WorkoutSet, 'isCompleted' | 'setType' | 'unilateralSecondSideStartsAt'>,
  unilateral: boolean,
  now = Date.now(),
): SideStage | null {
  // Les échauffements restent hors cycle : ils se font des deux côtés sans
  // qu'on les compte, et leur imposer la transition ajouterait dix secondes
  // d'attente à chaque montée en charge.
  if (!unilateral || set.setType === 'warmup' || set.isCompleted === 1) return null;
  if (set.unilateralSecondSideStartsAt === undefined) return 'first';
  return now < set.unilateralSecondSideStartsAt ? 'transition' : 'second';
}
