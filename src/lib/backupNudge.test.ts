import { describe, expect, it } from 'vitest';
import {
  backupNudge,
  daysSinceBackup,
  NUDGE_AFTER_DAYS,
  NUDGE_AFTER_WORKOUTS,
  SNOOZE_DAYS,
  snoozeUntil,
} from './backupNudge';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 14, 18, 0, 0);
const daysAgo = (days: number) => now - days * DAY;

describe('daysSinceBackup', () => {
  it('compte des jours entiers', () => {
    expect(daysSinceBackup(daysAgo(0), now)).toBe(0);
    expect(daysSinceBackup(now - (DAY - 1), now)).toBe(0);
    expect(daysSinceBackup(daysAgo(3), now)).toBe(3);
    expect(daysSinceBackup(now - 3.9 * DAY, now)).toBe(3);
  });

  it('ne dit rien d’une sauvegarde jamais faite ou illisible', () => {
    expect(daysSinceBackup(undefined, now)).toBeUndefined();
    expect(daysSinceBackup(0, now)).toBeUndefined();
    expect(daysSinceBackup(Number.NaN, now)).toBeUndefined();
  });

  it('ne produit jamais un âge négatif quand l’horloge a reculé', () => {
    expect(daysSinceBackup(now + 5 * DAY, now)).toBe(0);
  });
});

describe('backupNudge', () => {
  it('se tait quand rien n’est à protéger, quel que soit l’âge du fichier', () => {
    expect(backupNudge({ lastBackupAt: daysAgo(400), workoutsSince: 0, now })).toEqual({
      show: false,
    });
    expect(backupNudge({ lastBackupAt: undefined, workoutsSince: 0, now })).toEqual({
      show: false,
    });
    expect(backupNudge({ lastBackupAt: undefined, workoutsSince: Number.NaN, now })).toEqual({
      show: false,
    });
  });

  describe('rien n’a jamais été sauvegardé', () => {
    it('laisse tranquille celui qui débute', () => {
      for (let workouts = 1; workouts < NUDGE_AFTER_WORKOUTS; workouts += 1) {
        expect(backupNudge({ lastBackupAt: undefined, workoutsSince: workouts, now })).toEqual({
          show: false,
        });
      }
    });

    it('rappelle à partir de trois séances', () => {
      expect(
        backupNudge({ lastBackupAt: undefined, workoutsSince: NUDGE_AFTER_WORKOUTS, now }),
      ).toEqual({ show: true, reason: 'never', workouts: NUDGE_AFTER_WORKOUTS, daysSince: undefined });
    });
  });

  describe('une sauvegarde existe', () => {
    it('rappelle dès trois séances qu’elle ne contient pas, même récente', () => {
      expect(backupNudge({ lastBackupAt: daysAgo(2), workoutsSince: 3, now })).toEqual({
        show: true,
        reason: 'workouts',
        workouts: 3,
        daysSince: 2,
      });
    });

    it('laisse passer une ou deux séances récentes', () => {
      expect(backupNudge({ lastBackupAt: daysAgo(5), workoutsSince: 2, now }).show).toBe(false);
      expect(
        backupNudge({ lastBackupAt: daysAgo(NUDGE_AFTER_DAYS - 1), workoutsSince: 1, now }).show,
      ).toBe(false);
    });

    it('rappelle une seule séance quand la dernière sauvegarde date de deux semaines', () => {
      expect(
        backupNudge({ lastBackupAt: daysAgo(NUDGE_AFTER_DAYS), workoutsSince: 1, now }),
      ).toEqual({ show: true, reason: 'days', workouts: 1, daysSince: NUDGE_AFTER_DAYS });
    });
  });

  describe('« Plus tard »', () => {
    const due = { lastBackupAt: daysAgo(20), workoutsSince: 5, now };

    it('fait taire le rappel jusqu’à la fin du délai', () => {
      expect(backupNudge({ ...due, snoozedUntil: now + 1 }).show).toBe(false);
    });

    it('le laisse revenir quand le délai est écoulé', () => {
      expect(backupNudge({ ...due, snoozedUntil: now }).show).toBe(true);
      expect(backupNudge({ ...due, snoozedUntil: now - DAY }).show).toBe(true);
    });

    it('ignore une valeur illisible plutôt que de se taire pour toujours', () => {
      expect(backupNudge({ ...due, snoozedUntil: Number.NaN }).show).toBe(true);
    });
  });

  it('pose « Plus tard » à sept jours', () => {
    expect(SNOOZE_DAYS).toBe(7);
    expect(snoozeUntil(now)).toBe(now + 7 * DAY);
  });
});
