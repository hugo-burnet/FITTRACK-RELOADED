import { ensureMilestoneProjection } from '@/data/repositories/milestones';
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

  /*
   * Le rattrapage des paliers, avant les records et à part d'eux.
   *
   * **Rien de ce qu'il fait ne mérite d'empêcher l'app de s'ouvrir**, et son
   * échec n'a même pas de statut à remonter : un écran de paliers vide se
   * remplira au prochain démarrage, là où des records absents ont une bannière
   * de réparation parce qu'ils manquent en pleine séance. C'est aussi pour ça
   * qu'il n'est pas dans une migration Dexie, où une exception aurait laissé la
   * base fermée.
   */
  try {
    await ensureMilestoneProjection();
  } catch (error) {
    console.error('Les paliers n’ont pas pu être calculés', error);
  }

  try {
    return { recordProjection: await ensureRecordProjection() };
  } catch (error) {
    console.error('La projection des records n’a pas pu être reconstruite', error);
    return { recordProjection: 'stale' };
  }
}
