import { db } from '@/data/db';

/**
 * Quand l'app a servi pour la première fois sur cet appareil : la plus petite `createdAt` d'un
 * exercice, `undefined` si la table est vide.
 *
 * Le catalogue est semé au premier lancement avec `newEntity`, donc cette date est celle de
 * l'installation. Une base restaurée garde les dates d'origine, et c'est voulu : elle date d'avant
 * la restauration. Les exercices supprimés comptent — supprimer ne rajeunit pas l'app.
 *
 * Un parcours plutôt qu'un index : la table fait un millier de lignes, la lecture n'a lieu qu'au
 * démarrage et seulement tant que TTY1 est verrouillé, et un index sur `createdAt` coûterait une
 * migration Dexie pour une question qu'on pose une fois par mois.
 */
export async function getFirstUseAt(): Promise<number | undefined> {
  let oldest: number | undefined;

  await db.exercises.each((exercise) => {
    if (oldest === undefined || exercise.createdAt < oldest) oldest = exercise.createdAt;
  });

  return oldest;
}
