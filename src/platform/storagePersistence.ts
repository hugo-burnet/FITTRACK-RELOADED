/**
 * Demander au navigateur de ne pas effacer la base de lui-même.
 *
 * Sans cette demande, IndexedDB est un stockage « au mieux » : quand la place manque, le
 * navigateur peut vider l'origine entière — séances, routines, records — sans rien demander,
 * ni à l'app ni à la personne. La règle n° 4 (pas de perte de données) ne se négocie pas avec
 * l'espace disque d'un téléphone.
 *
 * Ce n'est pas une sauvegarde : un stockage protégé ne survit ni à une désinstallation ni à un
 * téléphone perdu (cf. `lib/backupNudge`). C'est la protection contre le seul effacement que
 * l'utilisateur ne décide pas.
 *
 * Un confort jamais un prérequis : un navigateur qui ne sait pas, qui refuse ou qui plante ne
 * doit pas empêcher l'app de démarrer. Chrome décide en silence (et accorde d'office à une PWA
 * installée) ; l'APK, lui, vit dans l'espace de l'application.
 */
export type PersistenceOutcome = 'granted' | 'already' | 'denied' | 'unsupported';

export async function requestPersistentStorage(
  storage: StorageManager | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.storage,
): Promise<PersistenceOutcome> {
  if (storage === undefined || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return 'already';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** L'état actuel, sans rien demander : `null` quand le navigateur ne sait pas le dire. */
export async function readStoragePersistence(
  storage: StorageManager | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.storage,
): Promise<boolean | null> {
  if (storage === undefined || typeof storage.persisted !== 'function') return null;
  try {
    return await storage.persisted();
  } catch {
    return null;
  }
}
