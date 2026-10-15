import { t } from '@/i18n/fr';
import { partReading } from '@/i18n/labels';
import { BENCHMARK_MAX_REPS, type BenchmarkLine, type BenchmarkProposal } from '@/lib/benchmark';
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

/** Le chiffre à côté de l'interrupteur : l'écart quand la routine porte déjà une charge, la charge sinon. */
export function proposalMark(proposal: BenchmarkProposal): string {
  const { deltaKg } = proposal;
  if (deltaKg === undefined) return loadReading(proposal.proposedWeight);
  return `${deltaKg < 0 ? '−' : '+'}${loadReading(Math.abs(deltaKg))}`;
}

/** « 8 – 12 reps », « 15 – 20 reps », « 20 reps » : la fourchette de la routine, écrite comme sur sa ligne. */
export function zoneReading(line: BenchmarkLine): string | undefined {
  if (line.zone === undefined) return undefined;
  const part = repsReading({ targetReps: line.zone.low, targetRepsMax: line.zone.high });
  return part === undefined ? undefined : t('benchmark.zone', { range: partReading(part) });
}

/** La mise en garde d'une estimation tirée d'un essai loin de la fourchette. */
export function roughReading(line: BenchmarkLine): string | undefined {
  if (line.rough !== true || line.tested?.reps === undefined) return undefined;
  return t('benchmark.rough', { reps: line.tested.reps });
}

/** Ce que la routine dit de cet exercice — ou rien, quand la ligne se suffit. */
export function routineReading(line: BenchmarkLine): string | undefined {
  if (line.verdict !== 'calibrated') return undefined;
  if (line.aligned === true) return t('benchmark.aligned');
  if (line.proposal === undefined) return t('benchmark.noLine');
  return line.currentKg === undefined
    ? t('benchmark.inRoutineNone')
    : t('benchmark.inRoutine', { value: loadReading(line.currentKg) });
}

/** Pourquoi une ligne n'a pas de charge à proposer. */
export function withoutLoadReading(line: BenchmarkLine): string | undefined {
  switch (line.verdict) {
    case 'too_light':
      return t('benchmark.tooLight', { max: BENCHMARK_MAX_REPS });
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
