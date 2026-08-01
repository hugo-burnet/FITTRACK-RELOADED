/**
 * The comparable form of a routine name.
 *
 * Names are the only link left between an imported session and the routine it
 * belongs to (`pickSuggestedRoutine`), and the key that groups a Hevy export
 * into routines (`selectHevyRoutineSources`). One implementation for both, so
 * that what the import considers "the same routine" and what the home screen
 * considers "the same routine" can never drift apart.
 *
 * Case and stray spaces only. Accents are kept: « Épaules » and « Epaules » are
 * two names a person typed differently on purpose, and folding them would merge
 * two routines the user sees as distinct.
 */
export function normalizeRoutineName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
