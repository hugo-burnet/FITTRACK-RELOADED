import type { ProgramPhase } from '@/data/types';

/**
 * The level a phase suggests when it is chosen explicitly — in the week editor,
 * or as the level of a recipe's phase. Never applied by a migration, a session
 * start, or any recompute: picking a phase proposes a number, it does not lock one.
 *
 * There is deliberately no second scale. A recipe is a sequence of phases, and
 * its levels are read from here.
 */
export const SUGGESTED_LOAD_INDEX: Record<ProgramPhase, number> = {
  construction: 100,
  progression: 105,
  overload: 110,
  deload: 60,
  return: 100,
  test: 110,
};

export const LOAD_INDEX_PRESETS = [60, 90, 100, 105, 110] as const;

/** Le niveau qui ne change rien : les charges sont celles de la routine. */
export const LOAD_INDEX_NEUTRAL = 100;

/** Points de niveau que vaut un cran de charge. */
export const LOAD_INDEX_POINTS_PER_STEP = 5;

/**
 * Crans de charge que le niveau ajoute aux séries de travail.
 *
 * **Des crans, jamais un facteur.** 105 n'est pas « fois 1,05 » : sur une barre
 * à 82,5 kg cela donnerait 86,625 kg, un nombre qu'aucun jeu de disques ne sait
 * produire. Un cran, c'est le plus petit saut réel de l'exercice
 * (`resolveLoadIncrementKg`) — 2,5 kg sur une barre, 5 kg sur une machine — et
 * le niveau en compte un tous les cinq points. 90 vaut donc deux crans en
 * moins, 95 un seul : le pas de la saisie est de un, celui de l'effet est de
 * cinq, et l'écran écrit lequel s'applique.
 */
export function loadIndexSteps(loadIndex: number): number {
  if (!Number.isFinite(loadIndex)) return 0;
  return Math.round((loadIndex - LOAD_INDEX_NEUTRAL) / LOAD_INDEX_POINTS_PER_STEP);
}
