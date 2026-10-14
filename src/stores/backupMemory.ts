/**
 * Ce que l'appareil sait de ses sauvegardes : quand la dernière a été faite, et jusqu'à quand
 * « Plus tard » fait taire le rappel.
 *
 * Deux dates dans `localStorage`, **hors sauvegarde** — le préfixe `fittrack.` et non `fittrack:`,
 * comme le déblocage de TTY1 et la date de la console rare. Une date de sauvegarde dans la
 * sauvegarde elle-même dirait toujours la précédente ; et rejouer sur un téléphone neuf l'âge
 * de la protection d'un autre serait un mensonge. Elle décrit cet appareil, pas le compte.
 *
 * Le stockage est un confort, jamais un prérequis : bloqué, plein ou absent, rien ne lève, et le
 * rappel se comporte comme si rien n'avait jamais été sauvegardé — le sens le plus prudent.
 * Même contrat que `skinUnlock.ts`, dont `getBootStorage` fournit le stockage.
 */
type MemoryStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

export const LAST_BACKUP_KEY = 'fittrack.lastBackupAt';
export const NUDGE_SNOOZE_KEY = 'fittrack.backupNudgeSnoozedUntil';

export interface BackupMemory {
  /** `undefined` : jamais sauvegardé, ou illisible. */
  lastBackupAt: number | undefined;
  snoozedUntil: number | undefined;
}

function readTimestamp(storage: MemoryStorage, key: string): number | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeTimestamp(storage: MemoryStorage, key: string, value: number): void {
  if (!storage) return;
  try {
    storage.setItem(key, String(Math.trunc(value)));
  } catch {
    // Une date non écrite se traduit par un rappel de plus : mieux que de bloquer l'export.
  }
}

export function readBackupMemory(storage: MemoryStorage): BackupMemory {
  return {
    lastBackupAt: readTimestamp(storage, LAST_BACKUP_KEY),
    snoozedUntil: readTimestamp(storage, NUDGE_SNOOZE_KEY),
  };
}

const listeners = new Set<() => void>();

/**
 * Prévient les écrans de cette fenêtre qu'une date a changé : l'accueil et les Réglages lisent la
 * même mémoire, et `localStorage` n'émet d'événement que vers les *autres* fenêtres.
 */
export function subscribeBackupMemory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Une sauvegarde vient d'être faite — ou restaurée — et contient tout ce qui existait à `at`.
 *
 * `at` est l'instant où le fichier a été **construit**, pas celui où la feuille de partage s'est
 * refermée : une séance enregistrée entre les deux n'est pas dans le fichier. Une sauvegarde
 * fraîche met aussi fin au « Plus tard » en cours : il parlait de la précédente.
 */
export function rememberBackup(storage: MemoryStorage, at: number): void {
  if (!Number.isFinite(at) || at <= 0) return;
  writeTimestamp(storage, LAST_BACKUP_KEY, at);
  writeTimestamp(storage, NUDGE_SNOOZE_KEY, 0);
  notify();
}

export function snoozeBackupNudge(storage: MemoryStorage, until: number): void {
  writeTimestamp(storage, NUDGE_SNOOZE_KEY, until);
  notify();
}
