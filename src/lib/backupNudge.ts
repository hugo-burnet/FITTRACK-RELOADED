/**
 * Quand rappeler de sauvegarder.
 *
 * La règle n° 4 promet qu'une séance survit à un crash, à un appel, à un kill de
 * l'app. Elle ne promet rien contre un téléphone perdu, réinitialisé, ou une app
 * désinstallée : la base vit dans l'appareil, et la seule parade est un fichier
 * qui en sort. Personne d'autre que l'utilisateur ne peut l'y mettre — l'app peut
 * seulement ne pas le laisser oublier.
 *
 * **Compter les séances, pas les jours.** Quinze jours sans séance ne mettent
 * rien en danger ; trois séances jamais sauvegardées, si. Le rappel part donc du
 * nombre de séances que la dernière sauvegarde ne contient pas, et les jours ne
 * servent que de filet quand on s'entraîne peu : une séance isolée, vieille de
 * deux semaines, mérite aussi un rappel.
 *
 * **Rien à perdre, rien à dire.** Sans séance depuis la dernière sauvegarde, la
 * règle se tait quel que soit l'âge du fichier — un rappel qui revient quand il
 * n'y a rien à protéger est un rappel qu'on apprend à fermer sans le lire.
 *
 * Pur : ni horloge ni stockage, tout arrive en argument.
 */

/** Séances non sauvegardées à partir desquelles on rappelle, quel que soit l'âge. */
export const NUDGE_AFTER_WORKOUTS = 3;

/** Âge de la dernière sauvegarde à partir duquel une seule séance suffit. */
export const NUDGE_AFTER_DAYS = 14;

/** « Plus tard » : combien de temps le rappel se tait. */
export const SNOOZE_DAYS = 7;

const DAY_MS = 86_400_000;

export type BackupNudgeReason =
  /** Aucune sauvegarde n'a jamais été faite. */
  | 'never'
  /** Trois séances ou plus depuis la dernière. */
  | 'workouts'
  /** Peu de séances, mais la dernière sauvegarde date. */
  | 'days';

export interface BackupNudgeInput {
  /** Instant de la dernière sauvegarde, `undefined` si jamais faite. */
  lastBackupAt: number | undefined;
  /** Séances terminées que cette sauvegarde ne contient pas (toutes, si jamais faite). */
  workoutsSince: number;
  now: number;
  /** « Plus tard » : le rappel se tait jusqu'à cet instant. */
  snoozedUntil?: number | undefined;
}

export type BackupNudge =
  | { show: false }
  | {
      show: true;
      reason: BackupNudgeReason;
      workouts: number;
      /** `undefined` quand rien n'a jamais été sauvegardé. */
      daysSince: number | undefined;
    };

/**
 * Jours entiers écoulés depuis la dernière sauvegarde. Un instant illisible ou
 * futur (horloge reculée) ne produit jamais un âge négatif : zéro, c'est-à-dire
 * « à l'instant ». `undefined` quand rien n'a été sauvegardé.
 */
export function daysSinceBackup(lastBackupAt: number | undefined, now: number): number | undefined {
  if (lastBackupAt === undefined || !Number.isFinite(lastBackupAt) || lastBackupAt <= 0) {
    return undefined;
  }
  return Math.max(0, Math.floor((now - lastBackupAt) / DAY_MS));
}

export function backupNudge(input: BackupNudgeInput): BackupNudge {
  const { workoutsSince, now, snoozedUntil } = input;
  if (!Number.isFinite(workoutsSince) || workoutsSince <= 0) return { show: false };
  if (snoozedUntil !== undefined && Number.isFinite(snoozedUntil) && snoozedUntil > now) {
    return { show: false };
  }

  const daysSince = daysSinceBackup(input.lastBackupAt, now);
  const show = (reason: BackupNudgeReason): BackupNudge => ({
    show: true,
    reason,
    workouts: workoutsSince,
    daysSince,
  });

  if (daysSince === undefined) {
    return workoutsSince >= NUDGE_AFTER_WORKOUTS ? show('never') : { show: false };
  }
  if (workoutsSince >= NUDGE_AFTER_WORKOUTS) return show('workouts');
  if (daysSince >= NUDGE_AFTER_DAYS) return show('days');
  return { show: false };
}

/** L'instant où « Plus tard » prend fin. */
export function snoozeUntil(now: number): number {
  return now + SNOOZE_DAYS * DAY_MS;
}
