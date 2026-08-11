import { ensureRecordProjection } from '@/data/repositories/personalRecords';
import { seedDatabase } from '@/data/seed/seedDatabase';

export interface InitializationResult {
  recordProjection: 'ready' | 'rebuilt' | 'stale';
}

/**
 * Prepares persistent reads in their dependency order. The catalogue failure
 * remains fatal to boot; records are a repairable projection, so only that
 * second step may become stale while the rest of the app mounts.
 */
export async function initializePersistentData(): Promise<InitializationResult> {
  await seedDatabase();

  try {
    return { recordProjection: await ensureRecordProjection() };
  } catch (error) {
    console.error('La projection des records n’a pas pu être reconstruite', error);
    return { recordProjection: 'stale' };
  }
}
