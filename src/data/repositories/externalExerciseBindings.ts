import Dexie from 'dexie';
import { db } from '@/data/db';
import type { ExternalExerciseBinding, ExternalExerciseSource } from '@/data/types';

export async function listExternalExerciseBindings(
  source: ExternalExerciseSource,
): Promise<ExternalExerciseBinding[]> {
  return (
    await db.externalExerciseBindings
      .where('[source+identityKey]')
      .between([source, Dexie.minKey], [source, Dexie.maxKey])
      .toArray()
  )
    .filter((binding) => binding.deletedAt === 0)
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
}
