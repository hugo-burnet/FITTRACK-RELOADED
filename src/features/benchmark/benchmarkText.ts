import type { BenchmarkGoal } from '@/data/types';
import { t } from '@/i18n/fr';
import { partReading } from '@/i18n/labels';
import type { BenchmarkLine, BenchmarkProposal } from '@/lib/benchmark';
import { BENCHMARK_GOAL_TEST_REPS, BENCHMARK_MAX_REPS, type RepZone } from '@/lib/benchmarkModel';
import { performedParts, repsReading } from '@/lib/measurement';

/**
 * Les phrases du bilan, hors du composant : elles se testent sans écran, et la
 * carte d'un exercice n'a plus qu'à les poser.
 */

const decimal = (value: number): string => value.toLocaleString('fr-FR');

/** « 77,5 kg » — la même écriture qu'une charge de routine, `partReading` en est la seule source. */
export const loadReading = (kg: number): string =>
  partReading({ value: decimal(kg), unit: 'kg' });

/** Un 1RM est une estimation : un chiffre après la virgule en dit déjà trop. */
export const oneRepMaxReading = (kg: number): string => loadReading(Math.round(kg * 10) / 10);

/** Ce qui a été fait, écrit comme une série d'historique (« 9 reps · 80 kg »). */
export function testedReading(line: BenchmarkLine): string | undefined {
  if (line.tested === undefined) return undefined;
  const parts = performedParts(line.measurementType, line.tested);
  return parts.length === 0 ? undefined : parts.map(partReading).join(' · ');
}

/** « 8 – 12 reps », « 15 – 20 reps », « 20 reps » : une fourchette, écrite comme sur la ligne d'une routine. */
const rangeReading = (zone: RepZone): string | undefined => {
  const part = repsReading({ targetReps: zone.low, targetRepsMax: zone.high });
  return part === undefined ? undefined : partReading(part);
};

/** « classique », « léger », « lourd » : le nom d'un style, en minuscules, pour se glisser dans une phrase. */
export const goalName = (goal: BenchmarkGoal): string => t(`benchmark.goalName.${goal}`);

/**
 * Le rappel en tête de la séance de benchmark. Avec un style, il dit aussi le nombre de répétitions à viser :
 * la fourchette n'est pas sur la ligne de série (la cible de répétitions rouvrirait le défaut des répétitions
 * proposées), c'est donc ici que la personne le retrouve en choisissant sa charge.
 */
export const bannerReading = (goal: BenchmarkGoal | undefined): string =>
  goal === undefined
    ? t('benchmark.workoutBanner')
    : t('benchmark.workoutBannerGoal', { style: goalName(goal), reps: BENCHMARK_GOAL_TEST_REPS[goal] });

/**
 * Le chiffre à côté de l'interrupteur : l'écart quand la routine porte déjà une charge, la charge sinon — et la
 * fourchette quand c'est la seule chose à écrire (la charge est déjà la bonne).
 */
export function proposalMark(proposal: BenchmarkProposal): string {
  const { deltaKg, zone } = proposal;
  if (deltaKg === undefined) return loadReading(proposal.proposedWeight);
  if (deltaKg === 0 && zone !== undefined) {
    return rangeReading(zone) ?? loadReading(proposal.proposedWeight);
  }
  return `${deltaKg < 0 ? '−' : '+'}${loadReading(Math.abs(deltaKg))}`;
}

/** Sous l'interrupteur, quand l'écart de charge n'est pas tout ce qu'il écrit : la fourchette du style aussi. */
export function zoneNoteReading(proposal: BenchmarkProposal): string | undefined {
  if (proposal.zone === undefined || proposal.deltaKg === 0) return undefined;
  const range = rangeReading(proposal.zone);
  return range === undefined ? undefined : t('benchmark.zoneNote', { range });
}

/**
 * La fourchette sur laquelle la charge est calculée : « Ton style : classique · 8 – 12 reps » quand la personne
 * en a choisi un, « Fourchette de la routine : 8 – 12 reps » sinon.
 */
export function zoneReading(line: BenchmarkLine): string | undefined {
  if (line.zone === undefined) return undefined;
  const range = rangeReading(line.zone);
  if (range === undefined) return undefined;
  return line.goal === undefined
    ? t('benchmark.zone', { range })
    : t('benchmark.style', { name: goalName(line.goal), range });
}

/** Les répétitions que la première série doit tenir : un nombre entier, la précision du modèle n'en dit pas plus. */
const capacityReps = (line: BenchmarkLine): number | undefined =>
  line.referenceReps === undefined ? undefined : Math.round(line.referenceReps);

/**
 * La phrase à retenir : la charge, pour les séries et la fourchette sur lesquelles elle est calculée —
 * « 52,5 kg pour 3 séries de 8 – 12 reps ». Pour une pyramide, la charge de sa série la plus lourde : les autres
 * suivent du même écart.
 */
export function planReading(line: BenchmarkLine): string | undefined {
  if (line.suggestedKg === undefined || line.zone === undefined || line.plannedSets === undefined) {
    return undefined;
  }
  const value = loadReading(line.suggestedKg);
  if (line.pyramid === true) return t('benchmark.planPyramid', { value });
  const range = rangeReading(line.zone);
  if (range === undefined) return undefined;
  // Un minimum (plus de 30 répétitions) se dit « au moins » : la charge ne promet pas ce qu'on tiendra.
  if (line.minimum === true) {
    return line.plannedSets === 1
      ? t('benchmark.planMinimumOne', { value, range })
      : t('benchmark.planMinimum', { value, sets: line.plannedSets, range });
  }
  return line.plannedSets === 1
    ? t('benchmark.planOne', { value, range })
    : t('benchmark.plan', { value, sets: line.plannedSets, range });
}

/** Le max : une estimation, ou — au-delà de 30 répétitions — un plancher (« 1RM : au moins 80 kg »). */
export function oneRepMaxSentence(line: BenchmarkLine): string | undefined {
  if (line.oneRepMax === undefined) return undefined;
  const value = oneRepMaxReading(line.oneRepMax);
  return line.minimum === true
    ? t('benchmark.oneRepMaxMinimum', { value })
    : t('benchmark.oneRepMax', { value });
}

/** Pourquoi la charge est un minimum : plus de 30 répétitions, le max ne se calcule plus. */
export function minimumReading(line: BenchmarkLine): string | undefined {
  return line.minimum === true ? t('benchmark.minimumNote', { max: BENCHMARK_MAX_REPS }) : undefined;
}

/** Ce que chaque série tient à fond à la charge conseillée : « 13 · 11 · 10 », c'est ainsi qu'on lit trois séries. */
export function holdReading(line: BenchmarkLine): string | undefined {
  if (line.suggestedKg === undefined || line.holdReps === undefined || line.holdReps.length === 0) {
    return undefined;
  }
  return t('benchmark.hold', {
    value: loadReading(line.suggestedKg),
    reps: line.holdReps.join(' · '),
  });
}

/** Une pyramide garde sa forme : le décalage est le même pour toutes ses séries. */
export function pyramidReading(line: BenchmarkLine): string | undefined {
  return line.pyramid === true ? t('benchmark.pyramidNote') : undefined;
}

/**
 * La mise en garde d'une estimation tirée d'un essai loin de ce que la première série doit tenir. L'interrupteur
 * n'est nommé que s'il existe : sans proposition — pas de ligne de routine, routine déjà à ce niveau —, il n'y en a pas.
 */
export function roughReading(line: BenchmarkLine): string | undefined {
  const target = capacityReps(line);
  if (line.rough !== true || line.tested?.reps === undefined || target === undefined) return undefined;
  const warning = t('benchmark.rough', { reps: line.tested.reps, target });
  return line.proposal === undefined ? warning : `${warning} ${t('benchmark.roughSwitch')}`;
}

/** Ce que la routine dit de cet exercice — ou rien, quand la ligne se suffit. */
export function routineReading(line: BenchmarkLine): string | undefined {
  if (line.verdict !== 'calibrated') return undefined;
  if (line.aligned === true) return t('benchmark.aligned');
  if (line.proposal === undefined) {
    return line.routineEmpty === true ? t('benchmark.routineEmpty') : t('benchmark.noLine');
  }
  return line.currentKg === undefined
    ? t('benchmark.inRoutineNone')
    : t('benchmark.inRoutine', { value: loadReading(line.currentKg) });
}

/** La routine a bougé depuis le benchmark : ce qu'on s'apprête à écrire date. Seulement s'il y a quelque chose à écrire. */
export function changedReading(line: BenchmarkLine): string | undefined {
  return line.proposal !== undefined && line.routineChanged === true
    ? t('benchmark.routineChanged')
    : undefined;
}

/** Pourquoi une ligne n'a pas de charge à proposer. */
export function withoutLoadReading(line: BenchmarkLine): string | undefined {
  switch (line.verdict) {
    case 'unreadable':
      return t('benchmark.unreadable');
    case 'no_load':
      return t('benchmark.noLoad');
    case 'recorded':
      return t('benchmark.recorded');
    case 'calibrated':
    case 'skipped':
      return undefined;
  }
}

export const appliedReading = (count: number): string =>
  count === 0
    ? t('benchmark.appliedNone')
    : count === 1
      ? t('benchmark.appliedOne')
      : t('benchmark.appliedMany', { count });
