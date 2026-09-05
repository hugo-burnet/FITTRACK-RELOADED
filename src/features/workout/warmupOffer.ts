import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  type WarmupSetSuggestion,
  type WarmupStep,
} from '@/lib/warmup';
import { rememberedWarmup } from '@/lib/warmupMemory';
import { warmupContextFor } from './warmupContext';

/**
 * Reproposer l'échauffement de la dernière fois — proposé, jamais imposé.
 *
 * **Ce qui décide de se taire.** La proposition ne s'affiche que si les cinq
 * conditions sont réunies, et chacune répond à un défaut précis :
 *
 * - l'exercice se charge en kilos (`warmupContextFor`) — un gainage n'a pas de
 *   montée en charge ;
 * - la séance du jour ne porte **aucune** série d'échauffement pour lui : une
 *   routine qui prévoit déjà sa montée n'a pas à en recevoir une seconde ;
 * - aucune série n'a encore été validée : passé la première, l'échauffement est
 *   derrière soi, et la proposition n'a plus qu'à disparaître d'elle-même —
 *   c'est aussi ce qui la rend inutile à « ignorer » explicitement, et ce qui
 *   fait qu'une reprise de séance ne la ramène pas ;
 * - la dernière fois portait une montée lisible (`rememberedWarmup`) ;
 * - la charge de travail du jour est connue, sans quoi il n'y a rien à quoi
 *   rapporter les pourcentages.
 *
 * **La charge du jour, pas celle d'hier.** Les poids proposés sont recalculés
 * sur la charge de travail d'aujourd'hui. `changedLoad` dit si elle a bougé
 * depuis la séance mémorisée : l'écran s'en sert pour l'annoncer plutôt que de
 * laisser croire à une recopie.
 */
export interface WarmupOffer {
  /** Les paliers mémorisés, tels que la feuille les rouvrirait. */
  steps: WarmupStep[];
  /** Ces paliers appliqués à la charge de travail du jour. */
  suggestions: WarmupSetSuggestion[];
  targetWeightKg: number;
  /** La charge de travail a changé depuis la montée mémorisée. */
  changedLoad: boolean;
}

export function warmupOfferFor(line: WorkoutExerciseDetail): WarmupOffer | null {
  const context = warmupContextFor(line);
  if (context === null) return null;

  const targetWeightKg = context.targetWeightKg;
  if (targetWeightKg === undefined || !Number.isFinite(targetWeightKg) || targetWeightKg <= 0) {
    return null;
  }

  if (line.sets.some((set) => set.setType === 'warmup')) return null;
  if (line.sets.some((set) => set.isCompleted === 1)) return null;

  const remembered = rememberedWarmup(line.previous);
  if (remembered === null) return null;

  const suggestions = calculateWarmupSets({
    targetWeightKg,
    incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
    minimumWeightKg: context.minimumWeightKg,
    steps: remembered.steps,
  });
  if (suggestions.length === 0) return null;

  return {
    steps: remembered.steps,
    suggestions,
    targetWeightKg,
    changedLoad: remembered.referenceWeightKg !== targetWeightKg,
  };
}
