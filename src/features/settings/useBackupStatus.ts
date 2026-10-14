import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useSyncExternalStore } from 'react';
import { getBootStorage } from '@/app/bootEasterEgg';
import { countWorkoutsSince } from '@/data/repositories/backupStatus';
import { backupNudge, type BackupNudge } from '@/lib/backupNudge';
import { readBackupMemory, subscribeBackupMemory } from '@/stores/backupMemory';

export interface BackupStatus {
  lastBackupAt: number | undefined;
  /** `undefined` tant que le compte n'est pas lu. */
  workoutsSince: number | undefined;
  nudge: BackupNudge;
  /** L'instant où l'écran s'est monté : l'échelle est le jour, pas la seconde. */
  now: number;
}

/**
 * Les deux dates sont lues dans `localStorage` et regroupées en une chaîne : `useSyncExternalStore`
 * compare les instantanés par identité, et un objet neuf à chaque lecture ferait boucler le rendu.
 */
function memorySnapshot(): string {
  const { lastBackupAt, snoozedUntil } = readBackupMemory(getBootStorage());
  return `${lastBackupAt ?? ''}|${snoozedUntil ?? ''}`;
}

function parse(part: string | undefined): number | undefined {
  return part === undefined || part === '' ? undefined : Number(part);
}

/**
 * Où en est la protection de l'historique : la dernière sauvegarde, ce qu'elle ne contient pas, et
 * si le rappel doit parler. Lu par les Réglages (la ligne d'état) et l'accueil (la carte) — les
 * deux suivent la même mémoire, donc une sauvegarde faite depuis l'un éteint l'autre.
 *
 * Le compte des séances est une requête vivante : une séance qu'on termine l'allume sans rechargement.
 */
export function useBackupStatus(): BackupStatus {
  const [last, snoozed] = useSyncExternalStore(subscribeBackupMemory, memorySnapshot).split('|');
  const lastBackupAt = parse(last);
  const snoozedUntil = parse(snoozed);
  const [now] = useState(() => Date.now());

  const workoutsSince = useLiveQuery(() => countWorkoutsSince(lastBackupAt ?? 0), [lastBackupAt]);

  const nudge: BackupNudge =
    workoutsSince === undefined
      ? { show: false }
      : backupNudge({ lastBackupAt, workoutsSince, now, snoozedUntil });

  return { lastBackupAt, workoutsSince, nudge, now };
}
