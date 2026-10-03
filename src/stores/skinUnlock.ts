import type { Theme } from './theme';

/**
 * Le déblocage du thème TTY1 : un drapeau dans `localStorage`, rien dans Dexie.
 *
 * Il se lit avant le premier rendu, comme le thème et la date de la surprise rare, et il ne parle
 * que de cet appareil. Une base restaurée ailleurs retrouve quand même l'option, par l'ancienneté
 * (`unlockTty1IfSeasoned`) : les exercices gardent leurs dates d'origine.
 *
 * Le stockage est un confort, jamais un prérequis : bloqué, plein ou absent, rien ne lève et TTY1
 * reste verrouillé. Même contrat que `bootEasterEgg.ts`, dont `getBootStorage` fournit le stockage.
 */
type UnlockStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

export const TTY1_UNLOCK_KEY = 'fittrack.tty1Unlocked';

/**
 * Au-delà de ce nombre de jours d'usage, TTY1 est débloqué d'office.
 *
 * Il doit rester **supérieur** au plus long délai de la surprise rare (28 jours) : c'est
 * l'argument entier. Au-delà, la console était forcément due, et une série d'ouvertures toutes
 * sautées par une séance en cours ne doit pas garder TTY1 verrouillé pour toujours.
 * `skinUnlock.test.ts` le garde.
 */
export const SEASONED_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isTty1Unlocked(storage: UnlockStorage): boolean {
  if (!storage) return false;

  try {
    return storage.getItem(TTY1_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function unlockTty1(storage: UnlockStorage): void {
  if (!storage) return;

  try {
    storage.setItem(TTY1_UNLOCK_KEY, '1');
  } catch {
    // Un déblocage non écrit se rejouera au prochain démarrage : mieux vaut cela qu'un
    // démarrage qui n'aboutit pas.
  }
}

/**
 * `firstUseAt` est la plus petite `createdAt` d'un exercice, soit le premier lancement. Une date
 * future (horloge reculée) ou non finie ne débloque rien : mieux vaut un verrou de trop qu'un
 * déblocage sur une date qu'on ne croit pas.
 */
export function unlockTty1IfSeasoned(
  storage: UnlockStorage,
  firstUseAt: number,
  now: number,
): void {
  if (!Number.isFinite(firstUseAt)) return;
  if (now - firstUseAt > SEASONED_AFTER_DAYS * DAY_MS) unlockTty1(storage);
}

/**
 * Le thème mémorisé prouve que l'option était accessible : la v2.8.0 a livré TTY1 ouvert, et le
 * retirer à qui le porte serait une régression. Sans ce passage, quitter le thème une fois
 * l'enfermerait dehors — le drapeau n'existait pas encore.
 */
export function unlockTty1IfInUse(storage: UnlockStorage, theme: Theme): void {
  if (theme === 'tty1') unlockTty1(storage);
}
