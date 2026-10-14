import { t } from '@/i18n/fr';

/**
 * Les phrases de la protection : ce que les Réglages et le rappel de l'accueil disent de la
 * dernière sauvegarde. Elles vivent ici, d'un seul tenant, parce que les deux écrans doivent
 * dire la même chose au même moment — un rappel qui annonce « il y a 5 jours » pendant que les
 * Réglages écrivent « hier » est un rappel qu'on n'écoute plus.
 */

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

const startOfLocalDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/**
 * « hier », « il y a 5 jours » : la question est *ça fait combien de temps*, pas *quel jour*.
 * Au-delà d'un mois le compte de jours ne dit plus rien et la date reprend la main.
 *
 * Des minuits locaux et non des tranches de 24 h : une sauvegarde d'hier 22 h reste « hier » à
 * 8 h ce matin, et le passage à l'heure d'hiver ne fabrique pas un jour de plus.
 */
export function backupAgoLabel(lastBackupAt: number, now: number): string {
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(lastBackupAt)) / 86_400_000);
  if (days <= 0) return t('settings.backupAgoToday');
  if (days === 1) return t('settings.backupAgoYesterday');
  if (days < 30) return t('settings.backupAgoDays', { count: days });
  return t('settings.backupAgoDate', { date: dateFormatter.format(lastBackupAt) });
}

/** « 1 séance », « 4 séances ». */
export function backupSessionsLabel(count: number): string {
  return count === 1 ? t('home.backupSessionsOne') : t('home.backupSessionsMany', { count });
}

export interface BackupStatusInput {
  lastBackupAt: number | undefined;
  /** `undefined` tant que le compte n'est pas lu : on ne dit rien de ce qu'on ignore. */
  workoutsSince: number | undefined;
  now: number;
}

/** La ligne des Réglages : où en est la protection, en une phrase. */
export function backupStatusLine({ lastBackupAt, workoutsSince, now }: BackupStatusInput): string {
  const count = workoutsSince ?? 0;

  if (lastBackupAt === undefined) {
    if (count === 0) return t('settings.backupStatusNever');
    return count === 1
      ? t('settings.backupStatusNeverOne')
      : t('settings.backupStatusNeverMany', { count });
  }

  const ago = backupAgoLabel(lastBackupAt, now);
  if (workoutsSince === undefined) return t('settings.backupLastOnly', { ago });
  if (count === 0) return t('settings.backupStatusUpToDate', { ago });
  return count === 1
    ? t('settings.backupStatusSinceOne', { ago })
    : t('settings.backupStatusSinceMany', { ago, count });
}
