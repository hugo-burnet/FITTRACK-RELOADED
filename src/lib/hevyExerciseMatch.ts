import type {
  Equipment,
  Exercise,
  MeasurementType,
} from '@/data/types';
import type { HevyParsedSet } from './hevyCsv';
import { HEVY_EXERCISE_SLUG_BY_KEY } from './hevyExerciseAliases';

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
  'other',
  'plate',
  'poid',
  'poulie',
  'smith',
  'corp',
]);

const MATCH_TOKEN = new Map<string, string>([
  ['back', 'dos'],
  ['basse', 'bas'],
  ['chest', 'poitrine'],
  ['dumbbell', 'haltere'],
  ['face', 'visage'],
  ['hang', 'suspension'],
  ['leg', 'jambe'],
  ['low', 'bas'],
  ['plank', 'gainage'],
  ['pres', 'developpe'],
  ['press', 'developpe'],
  ['raise', 'elevation'],
  ['row', 'tirage'],
  ['shoulder', 'epaule'],
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

export function hevyExerciseSourceKey(title: string): string {
  const normalizedTitle = normalizeHevyExerciseTitle(title);
  if (normalizedTitle === '') return '';
  return `${normalizedTitle}|${inferHevyEquipment(title)}`;
}

export function findSuggestedHevyExercise(
  sourceTitle: string,
  measurementType: MeasurementType,
  exercises: readonly Exercise[],
): Exercise | undefined {
  const sourceEquipment = inferHevyEquipment(sourceTitle);
  const key = hevyExerciseSourceKey(sourceTitle);
  const slug = HEVY_EXERCISE_SLUG_BY_KEY[key];
  if (slug === undefined) return undefined;

  return exercises.find(
    (exercise) =>
      exercise.slug === slug &&
      exercise.measurementType === measurementType &&
      (sourceEquipment === 'other' ||
        exercise.equipment === sourceEquipment),
  );
}

/**
 * @deprecated Task 5 removes the final caller; Task 6 removes this alias.
 */
export const findCanonicalHevyExercise = findSuggestedHevyExercise;

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

function matchTokens(value: string): string[] {
  return tokens(value)
    .filter((token) => !STOP_WORDS.has(token))
    .map((token) => MATCH_TOKEN.get(token) ?? token);
}

function orderedTokenSimilarity(
  source: readonly string[],
  candidate: readonly string[],
): number {
  const longest = Math.max(source.length, candidate.length);
  if (longest === 0) return 0;

  const previous = Array.from(
    { length: candidate.length + 1 },
    () => 0,
  );
  for (const sourceToken of source) {
    let diagonal = 0;
    for (let index = 1; index <= candidate.length; index += 1) {
      const above = previous[index]!;
      previous[index] =
        sourceToken === candidate[index - 1]
          ? diagonal + 1
          : Math.max(previous[index]!, previous[index - 1]!);
      diagonal = above;
    }
  }
  return previous[candidate.length]! / longest;
}

export function rankHevyExerciseCandidates(
  sourceTitle: string,
  exercises: readonly Exercise[],
): Exercise[] {
  const sourceName = normalizeHevyExerciseTitle(sourceTitle);
  const sourceTokens = new Set(sourceName.split(' ').filter(Boolean));
  const sourceEquipment = inferHevyEquipment(sourceTitle);
  const sourceMatchTokens = matchTokens(sourceTitle);

  return [...exercises].sort((left, right) => {
    const score = (exercise: Exercise) => {
      const candidateName = normalizeHevyExerciseTitle(exercise.name);
      const candidateTokens = new Set(
        candidateName.split(' ').filter(Boolean),
      );
      const candidateMatchTokens = matchTokens(exercise.name);
      const equipmentScore =
        sourceEquipment === 'other'
          ? 0
          : exercise.equipment === sourceEquipment
            ? 120
            : -120;
      return (
        (candidateName === sourceName ? 1000 : 0) +
        diceCoefficient(
          new Set(sourceMatchTokens),
          new Set(candidateMatchTokens),
        ) *
          100 +
        orderedTokenSimilarity(
          sourceMatchTokens,
          candidateMatchTokens,
        ) *
          40 +
        equipmentScore -
        Math.abs(sourceTokens.size - candidateTokens.size)
      );
    };

    return (
      score(right) - score(left) ||
      left.name.localeCompare(right.name, 'fr')
    );
  });
}
