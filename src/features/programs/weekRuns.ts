import type { ProgramPhase } from '@/data/types';

export interface ProgramWeekReading {
  weekIndex: number;
  loadIndex: number;
  phase: ProgramPhase;
}

export interface ProgramWeekRun extends ProgramWeekReading {
  /** Dernière semaine de la suite ; égale à `weekIndex` quand elle est seule. */
  lastWeekIndex: number;
}

/**
 * Replie les semaines identiques qui se suivent.
 *
 * « Semaines suivantes » listait une ligne par semaine, et le trajet par défaut
 * en produisait huit rigoureusement identiques — huit lignes à lire pour
 * apprendre qu'il ne se passe rien. Ce qu'on cherche sur cette liste, ce sont
 * les **changements** : où tombe la décharge, quand la charge monte. Une suite
 * qui ne change pas est une seule information, donc une seule ligne.
 *
 * Deux semaines fusionnent quand elles se suivent vraiment (index contigus) et
 * qu'elles disent la même chose. Le trou laissé par une semaine absente coupe
 * la suite : mieux vaut deux lignes qu'une plage qui ment sur ce qu'elle couvre.
 */
export function groupWeekRuns(weeks: readonly ProgramWeekReading[]): ProgramWeekRun[] {
  const ordered = [...weeks].sort((left, right) => left.weekIndex - right.weekIndex);
  const runs: ProgramWeekRun[] = [];

  for (const week of ordered) {
    const current = runs[runs.length - 1];
    const continues =
      current !== undefined &&
      current.lastWeekIndex + 1 === week.weekIndex &&
      current.loadIndex === week.loadIndex &&
      current.phase === week.phase;

    if (continues) current.lastWeekIndex = week.weekIndex;
    else runs.push({ ...week, lastWeekIndex: week.weekIndex });
  }

  return runs;
}
