import { db } from '@/data/db';

/**
 * Combien de séances terminées une sauvegarde faite à `since` ne contient pas.
 *
 * **Créée ou finie après `since`**, pas « modifiée après » : `updatedAt` bouge quand
 * l'application réécrit en masse (recalcul des records, mise à jour des instantanés) et
 * annoncerait alors des dizaines de séances « non sauvegardées » qui n'ont pas changé.
 * `createdAt` attrape une séance importée aujourd'hui (Hevy) dont la date, elle, est
 * ancienne ; `endedAt` attrape celle qu'on vient de finir. Une séance ancienne corrigée à
 * la main n'est pas comptée — le rappel perd un cas rare, pas sa crédibilité.
 *
 * Les séances abandonnées et supprimées ne comptent pas : il n'y a rien à protéger.
 * `since` à 0 compte tout l'historique, ce qui est la réponse quand rien n'a jamais été
 * sauvegardé.
 */
export async function countWorkoutsSince(since: number): Promise<number> {
  return db.workouts
    .where('status')
    .equals('completed')
    .filter((workout) => workout.deletedAt === 0 && Math.max(workout.createdAt, workout.endedAt) > since)
    .count();
}
