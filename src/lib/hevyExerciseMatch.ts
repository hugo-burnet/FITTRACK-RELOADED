import type {
  Equipment,
  Exercise,
  MeasurementType,
} from '@/data/types';
import type { HevyParsedSet } from './hevyCsv';

const COMBINING_MARKS = /\p{M}/gu;
const NON_WORDS = /[^\p{L}\p{N}]+/gu;

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'avec',
  'de',
  'des',
  'du',
  'en',
  'la',
  'le',
  'les',
]);

const EQUIPMENT_WORDS = new Set([
  'band',
  'barbell',
  'barre',
  'bodyweight',
  'cable',
  'disque',
  'dumbbell',
  'elastique',
  'haltere',
  'kettlebell',
  'machine',
  'plate',
  'poid',
  'poulie',
  'smith',
  'corp',
]);

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase();
}

function singularize(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('s') || token.endsWith('x')) return token.slice(0, -1);
  return token;
}

function tokens(value: string): string[] {
  return fold(value)
    .replace(NON_WORDS, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

export function normalizeHevyExerciseTitle(title: string): string {
  return tokens(title)
    .filter(
      (token) =>
        !STOP_WORDS.has(token) && !EQUIPMENT_WORDS.has(token),
    )
    .join(' ');
}

function shapeOf(set: HevyParsedSet): MeasurementType | undefined {
  const weight = set.weight !== undefined;
  const reps = set.reps !== undefined;
  const duration = set.durationSeconds !== undefined;
  const distance = set.distanceMeters !== undefined;

  if (weight && reps && !duration && !distance) return 'weight_reps';
  if (!weight && reps && !duration && !distance) return 'reps_only';
  if (!weight && !reps && duration && !distance) return 'time_only';
  if (!weight && !reps && duration && distance) return 'distance_time';
  if (weight && !reps && duration && !distance) return 'weight_time';
  return undefined;
}

export function inferHevyMeasurementType(
  sets: readonly HevyParsedSet[],
): MeasurementType | undefined {
  let inferred: MeasurementType | undefined;
  for (const set of sets) {
    const shape = shapeOf(set);
    if (shape === undefined) return undefined;
    if (inferred !== undefined && inferred !== shape) return undefined;
    inferred = shape;
  }
  return inferred;
}

export function inferHevyEquipment(title: string): Equipment {
  const normalized = ` ${fold(title).replace(NON_WORDS, ' ')} `;
  const words = new Set(tokens(title));
  if (words.has('smith')) return 'smith';
  if (
    normalized.includes(' poids du corps ') ||
    words.has('bodyweight')
  ) {
    return 'bodyweight';
  }
  if (words.has('haltere') || words.has('dumbbell')) return 'dumbbell';
  if (words.has('barre') || words.has('barbell')) {
    return 'barbell';
  }
  if (words.has('poulie') || words.has('cable')) {
    return 'cable';
  }
  if (words.has('machine')) return 'machine';
  if (words.has('elastique') || words.has('band')) {
    return 'band';
  }
  if (words.has('kettlebell')) return 'kettlebell';
  if (words.has('disque') || words.has('plate')) {
    return 'plate';
  }
  return 'other';
}

function diceCoefficient(
  source: ReadonlySet<string>,
  candidate: ReadonlySet<string>,
): number {
  if (source.size === 0 && candidate.size === 0) return 1;
  let intersection = 0;
  for (const token of source) {
    if (candidate.has(token)) intersection += 1;
  }
  return (2 * intersection) / (source.size + candidate.size);
}

export function rankHevyExerciseCandidates(
  sourceTitle: string,
  exercises: readonly Exercise[],
): Exercise[] {
  const sourceName = normalizeHevyExerciseTitle(sourceTitle);
  const sourceTokens = new Set(sourceName.split(' ').filter(Boolean));
  const sourceEquipment = inferHevyEquipment(sourceTitle);

  return [...exercises].sort((left, right) => {
    const score = (exercise: Exercise) => {
      const candidateName = normalizeHevyExerciseTitle(exercise.name);
      const candidateTokens = new Set(
        candidateName.split(' ').filter(Boolean),
      );
      return (
        (candidateName === sourceName ? 1000 : 0) +
        diceCoefficient(sourceTokens, candidateTokens) * 100 +
        (exercise.equipment === sourceEquipment ? 10 : 0) -
        Math.abs(sourceTokens.size - candidateTokens.size)
      );
    };

    return (
      score(right) - score(left) ||
      left.name.localeCompare(right.name, 'fr')
    );
  });
}
