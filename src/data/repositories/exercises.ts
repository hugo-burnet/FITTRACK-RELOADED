import { db } from '@/data/db';
import type { Equipment, Exercise, MuscleGroup, Syncable } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';

export interface ExerciseFilter {
  search?: string;
  muscle?: MuscleGroup;
  equipment?: Equipment;
}

/** Everything a custom exercise needs. `isCustom` is forced, `slug` is the catalogue's. */
export type NewExercise = Omit<Exercise, keyof Syncable | 'isCustom' | 'slug'>;

/**
 * Every combining mark, i.e. the accents that NFD splits off. Written as a
 * Unicode property rather than the usual `[̀-ͯ]` range: that range
 * spelled literally is a run of invisible characters, which no reviewer can see
 * and an editor can silently mangle.
 */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Folds away case and accents.
 *
 * `normalize('NFD')` splits "é" into "e" plus a combining accent, which the
 * regex then drops. Without it, typing "developpe" on a phone keyboard never
 * finds "Développé" — guaranteed friction in the gym, where nobody long-presses
 * a key to get an accent between two sets.
 */
export function normalizeSearch(input: string): string {
  return input.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/**
 * Whether a name answers a search, word by word: every word of the search must
 * appear in the name, in any order. Matching the whole phrase meant "squat
 * barre" never found "Squat (barre)" — the parentheses the catalogue puts around
 * the equipment broke a phrase nobody types verbatim between two sets. An empty
 * search matches everything.
 */
export function matchesSearch(name: string, search: string): boolean {
  const words = normalizeSearch(search).split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
  if (words.length === 0) return true;
  const haystack = normalizeSearch(name);
  return words.every((word) => haystack.includes(word));
}

/**
 * The library screen's only read. Sorted by name in French collation, so "Épaulé"
 * lands with the E's rather than after Z.
 */
export async function listExercises(filter: ExerciseFilter = {}): Promise<Exercise[]> {
  const { search, muscle, equipment } = filter;

  // One index at most: IndexedDB cannot intersect two of them, and the second
  // criterion costs nothing on the few hundred rows that survive the first.
  let collection = db.exercises.toCollection();
  if (muscle !== undefined) collection = db.exercises.where('primaryMuscle').equals(muscle);
  else if (equipment !== undefined) collection = db.exercises.where('equipment').equals(equipment);

  let rows = alive(await collection.toArray());

  if (muscle !== undefined && equipment !== undefined) {
    rows = rows.filter((row) => row.equipment === equipment);
  }

  if (search !== undefined) rows = rows.filter((row) => matchesSearch(row.name, search));

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/**
 * The denominator of the library's readout ("24 **sur 168**"). Counts on the
 * `deletedAt` index rather than reading the rows: the figure re-reads on every
 * write, and loading 168 objects to discard them would be wasteful.
 */
export async function countExercises(): Promise<number> {
  return db.exercises.where('deletedAt').equals(0).count();
}

/**
 * Les ids des exercices vivants, en une lecture sur l'index `deletedAt`.
 *
 * Pour les écrans qui montrent des exercices lus dans l'historique (un nom
 * d'instantané survit à la suppression) et ne doivent lier que ceux qui ont
 * encore une page : `getExercise` d'un exercice supprimé renvoie `undefined`.
 */
export async function liveExerciseIds(): Promise<Set<string>> {
  return new Set(await db.exercises.where('deletedAt').equals(0).primaryKeys());
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  const exercise = await db.exercises.get(id);
  return exercise !== undefined && exercise.deletedAt === 0 ? exercise : undefined;
}

/** RF-08. No cap of any kind — non-negotiable rule n°1. */
export async function createCustomExercise(data: NewExercise): Promise<Exercise> {
  const exercise = newEntity<Exercise>({ ...data, isCustom: 1 });
  await db.exercises.add(exercise);
  return exercise;
}

/**
 * RF-09. Read-then-put rather than a partial update, so `updatedAt` moves through
 * `touch` like everywhere else. The Syncable fields are deliberately not
 * editable: rewriting `id` or `createdAt` from a form is never intended.
 */
export async function updateExercise(
  id: string,
  changes: Partial<Omit<Exercise, keyof Syncable>>,
): Promise<void> {
  const existing = await db.exercises.get(id);
  if (existing === undefined) return;
  await db.exercises.put(touch(existing, changes));
}

export async function deleteExercise(id: string): Promise<void> {
  await softDelete(db.exercises, id);
}
