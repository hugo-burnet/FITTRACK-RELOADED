import { describe, expect, it } from 'vitest';
import { backupAgoLabel, backupSessionsLabel, backupStatusLine } from './backupText';

// Midi local : les comparaisons de jours se font sur des minuits locaux, jamais sur 24 h.
const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();
const now = at(9, 14, 18); // 14 octobre 2026, 18 h

describe('backupAgoLabel', () => {
  it('dit « aujourd’hui » et « hier » plutôt qu’un nombre de jours', () => {
    expect(backupAgoLabel(at(9, 14, 8), now)).toBe('aujourd’hui');
    expect(backupAgoLabel(at(9, 13, 23), now)).toBe('hier');
  });

  it('compte des jours civils, pas des tranches de 24 heures', () => {
    // Hier 22 h reste « hier » à 8 h ce matin.
    expect(backupAgoLabel(at(9, 13, 22), at(9, 14, 8))).toBe('hier');
    expect(backupAgoLabel(at(9, 9, 10), now)).toBe('il y a 5 jours');
  });

  it('reprend la date au-delà d’un mois, où un nombre de jours ne dit plus rien', () => {
    expect(backupAgoLabel(at(8, 3), now)).toBe('le 3 septembre');
  });

  it('ne dit pas « il y a -2 jours » quand l’horloge a reculé', () => {
    expect(backupAgoLabel(at(9, 16), now)).toBe('aujourd’hui');
  });
});

describe('backupSessionsLabel', () => {
  it('accorde le pluriel', () => {
    expect(backupSessionsLabel(1)).toBe('1 séance');
    expect(backupSessionsLabel(2)).toBe('2 séances');
    expect(backupSessionsLabel(12)).toBe('12 séances');
  });
});

describe('backupStatusLine', () => {
  it('dit que rien n’a jamais été sauvegardé, sans compter ce qui n’existe pas', () => {
    expect(backupStatusLine({ lastBackupAt: undefined, workoutsSince: 0, now })).toBe(
      'Aucune sauvegarde faite depuis cet appareil.',
    );
  });

  it('dit ce qu’il y a à protéger quand rien n’a jamais été sauvegardé', () => {
    expect(backupStatusLine({ lastBackupAt: undefined, workoutsSince: 1, now })).toBe(
      'Aucune sauvegarde faite depuis cet appareil. 1 séance à protéger.',
    );
    expect(backupStatusLine({ lastBackupAt: undefined, workoutsSince: 7, now })).toBe(
      'Aucune sauvegarde faite depuis cet appareil. 7 séances à protéger.',
    );
  });

  it('dit « À jour » quand la dernière sauvegarde contient tout', () => {
    expect(backupStatusLine({ lastBackupAt: at(9, 13), workoutsSince: 0, now })).toBe(
      'Dernière sauvegarde : hier. À jour.',
    );
  });

  it('compte les séances que la dernière sauvegarde ne contient pas', () => {
    expect(backupStatusLine({ lastBackupAt: at(9, 9), workoutsSince: 1, now })).toBe(
      'Dernière sauvegarde : il y a 5 jours. 1 séance depuis.',
    );
    expect(backupStatusLine({ lastBackupAt: at(9, 9), workoutsSince: 4, now })).toBe(
      'Dernière sauvegarde : il y a 5 jours. 4 séances depuis.',
    );
  });

  it('ne dit rien du compte tant qu’il n’est pas lu', () => {
    expect(backupStatusLine({ lastBackupAt: at(9, 13), workoutsSince: undefined, now })).toBe(
      'Dernière sauvegarde : hier.',
    );
    expect(backupStatusLine({ lastBackupAt: undefined, workoutsSince: undefined, now })).toBe(
      'Aucune sauvegarde faite depuis cet appareil.',
    );
  });
});
