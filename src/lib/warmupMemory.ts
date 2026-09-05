import type { SetType } from '@/data/types';
import type { WarmupStep } from './warmup';

/**
 * L'échauffement qu'on a réellement fait la dernière fois, relu pour être
 * reproposé.
 *
 * **Pourquoi rien n'est stocké.** La séance précédente porte déjà la réponse :
 * ses séries d'échauffement sont dans la base, marquées `warmup`, à côté de la
 * charge de travail du jour. Une table de plus dirait la même chose, avec une
 * migration, une place dans la sauvegarde, et un risque supplémentaire — celui
 * de mémoriser une rampe qu'on a ensuite corrigée dans l'historique. La mémoire
 * est donc l'historique lui-même, et elle est juste par construction.
 *
 * **Par exercice, pas par routine.** La lecture part des séries d'un exercice,
 * quelle que soit la séance où il apparaissait : c'est le mouvement qui demande
 * une montée en charge, pas le programme du jour.
 *
 * **En pourcentages, et c'est la réponse au changement de charge.** Un
 * échauffement recopié en kilos deviendrait faux dès la première progression.
 * Ce qui est mémorisé est le *rapport* de chaque palier à la charge de travail
 * de ce jour-là ; il se réapplique à la charge d'aujourd'hui, quelle qu'elle
 * soit. Une montée à 20/40 pour 60 kg redevient 23,3/46,7 pour 70 kg — que
 * `calculateWarmupSets` arrondit ensuite vers le bas, comme partout ailleurs.
 */

/** Ce qu'une série passée doit dire pour qu'on puisse la relire. */
export interface RememberedSet {
  setType: SetType;
  weight?: number;
  targetWeight?: number;
  reps?: number;
  targetReps?: number;
}

export interface RememberedWarmup {
  steps: WarmupStep[];
  /** La charge de travail à laquelle la montée se rapportait. */
  referenceWeightKg: number;
}

function loadOf(set: RememberedSet): number | undefined {
  const value = set.weight ?? set.targetWeight;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function repsOf(set: RememberedSet): number | undefined {
  const value = set.reps ?? set.targetReps;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * La montée de la dernière fois, ou `null` s'il n'y en avait pas de lisible.
 *
 * La référence est la **première** série de travail : c'est la charge d'attaque,
 * celle pour laquelle on s'est échauffé. Une série montée plus haut ensuite est
 * une progression intra-séance, et la rapporter à elle rendrait la montée
 * artificiellement basse.
 */
export function rememberedWarmup(previous: readonly RememberedSet[]): RememberedWarmup | null {
  const working = previous.find((set) => set.setType !== 'warmup' && loadOf(set) !== undefined);
  const referenceWeightKg = working === undefined ? undefined : loadOf(working);
  if (referenceWeightKg === undefined) return null;

  const steps = previous.flatMap<WarmupStep>((set) => {
    if (set.setType !== 'warmup') return [];
    const load = loadOf(set);
    const reps = repsOf(set);
    if (load === undefined || reps === undefined) return [];
    const percentage = Math.round((load / referenceWeightKg) * 100);
    // Un palier à la charge de travail n'est pas un échauffement, et
    // `calculateWarmupSets` le refuserait de toute façon.
    if (percentage <= 0 || percentage >= 100) return [];
    return [{ percentage, reps }];
  });

  return steps.length === 0 ? null : { steps, referenceWeightKg };
}
