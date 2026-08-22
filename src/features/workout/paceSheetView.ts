import type { RepPacer } from '@/stores/repPacer';
import type { PaceSheetView } from './PaceSheet';
import { prepareNextPace, type PaceCadence } from './paceTarget';
import type { WorkoutSet } from '@/data/types';

/**
 * Ce que la feuille montre pour une ligne.
 *
 * Une vue, pas une horloge — d'où ce fichier. `useWorkoutPace` arbitre le
 * métronome et le chrono ; il n'a pas en plus à décider comment une feuille se
 * lit, et lui laisser les deux le faisait dépasser les trois cents lignes que
 * le projet se fixe.
 *
 * Pur : ce qui tourne entre, un `PaceSheetView` sort.
 */
export interface PaceSheetSource {
  rowId: string;
  name: string;
  sets: readonly WorkoutSet[];
  cadence: PaceCadence;
  /** Le tempo en vigueur pour cette ligne, préférence comprise. */
  repSeconds: number;
  /** La préférence derrière lui, pour que la feuille sache dire qu'ils diffèrent. */
  defaultRepSeconds: number;
  /** Vrai quand l'horloge de cette ligne tourne — celle des deux qui la concerne. */
  running: boolean;
  /** Le métronome, lu seulement quand c'est lui qui tourne. */
  pacer: Pick<RepPacer, 'reps' | 'repSeconds'>;
}

export function paceSheetViewOf(source: PaceSheetSource): PaceSheetView {
  const preparation = prepareNextPace(source.sets, source.cadence);
  const target = preparation.kind === 'ready' ? preparation.target : null;
  const beating = source.running && source.cadence.kind === 'reps';

  return {
    kind: source.cadence.kind,
    rowId: source.rowId,
    name: source.name,
    repSeconds: beating ? source.pacer.repSeconds : source.repSeconds,
    defaultRepSeconds: source.defaultRepSeconds,
    // Un maintien n'a pas de répétitions à annoncer, et un champ vide n'en est
    // pas une : `null` est la seule réponse honnête dans les deux cas.
    reps: beating ? source.pacer.reps : target?.kind === 'reps' ? target.reps : null,
    canStart: preparation.kind !== 'done',
    running: source.running,
  };
}
