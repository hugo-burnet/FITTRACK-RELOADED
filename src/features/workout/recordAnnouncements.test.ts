import { beforeEach, describe, expect, it } from 'vitest';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import {
  claimNewRecords,
  forgetRecordAnnouncements,
  recordAnnouncementKeys,
} from './recordAnnouncements';

function entry(
  id: string,
  value: number,
  // `null` et non `undefined` : passer `undefined` réveillerait la valeur par
  // défaut, et le test « premier record » testerait un record battu.
  previousValue: number | null = value - 5,
): RecordTimelineEntry {
  return {
    record: {
      id,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: 0,
      exerciseId: 'bench',
      type: 'max_weight',
      value,
      achievedAt: 0,
      workoutId: 'w1',
    },
    exerciseName: 'Développé couché',
    workoutStatus: 'active',
    ...(previousValue === null ? {} : { previousValue }),
  };
}

describe('recordAnnouncementKeys', () => {
  it('ignore un premier record — il ne bat rien', () => {
    expect(recordAnnouncementKeys([entry('r1', 80, null)])).toEqual([]);
  });

  it('ne dépend pas de l’identifiant de la ligne projetée', () => {
    expect(recordAnnouncementKeys([entry('r1', 80)])).toEqual(
      recordAnnouncementKeys([entry('r2', 80)]),
    );
  });
});

describe('claimNewRecords', () => {
  beforeEach(forgetRecordAnnouncements);

  it('prend la première lecture comme référence, sans rien annoncer', () => {
    expect(claimNewRecords('w1', ['bench:max_weight:80'])).toBe(0);
  });

  it('annonce ce qui arrive après cette référence', () => {
    claimNewRecords('w1', ['bench:max_weight:80']);
    expect(claimNewRecords('w1', ['bench:max_weight:80', 'bench:best_1rm:100'])).toBe(1);
  });

  it('ne réannonce rien quand l’écran est quitté puis rouvert', () => {
    claimNewRecords('w1', ['bench:max_weight:80']);
    expect(claimNewRecords('w1', ['bench:max_weight:80', 'bench:best_1rm:100'])).toBe(1);
    // Retour sur la séance : la liste complète est relue d'un coup.
    expect(claimNewRecords('w1', ['bench:max_weight:80', 'bench:best_1rm:100'])).toBe(0);
  });

  it('repart de zéro pour une autre séance', () => {
    claimNewRecords('w1', ['bench:max_weight:80']);
    expect(claimNewRecords('w2', ['bench:max_weight:80'])).toBe(0);
  });
});
