import { describe, expect, it } from 'vitest';
import type { CoachSignal, CoachSignalCode } from '@/lib/coach';
import { workoutRecapCues } from './workoutRecapVoice';

function signal(code: CoachSignalCode): CoachSignal {
  return { code, exerciseId: code, evidence: [], severity: 1 };
}

describe('workoutRecapCues', () => {
  it('annonce un bilan stable quand le coach ne relève rien', () => {
    expect(workoutRecapCues([])).toEqual(['workout-recap-start', 'coach-recap-steady']);
  });

  it('garde une seule conclusion par famille de constats', () => {
    expect(
      workoutRecapCues([
        signal('range_satisfied'),
        signal('range_ceiling_reached'),
        signal('range_completed'),
        signal('range_missed'),
        signal('intra_session_drop'),
        signal('long_rest'),
        signal('plateau'),
      ]),
    ).toEqual([
      'workout-recap-start',
      'coach-recap-progress',
      'coach-recap-increase',
      'coach-recap-adjust',
      'coach-recap-fatigue',
      'coach-recap-plateau',
    ]);
  });

  it.each([
    ['range_missed', 'coach-recap-adjust'],
    ['intra_session_drop', 'coach-recap-fatigue'],
    ['plateau', 'coach-recap-plateau'],
  ] as const)('annonce %s avec le verdict %s', (code, expectedCue) => {
    expect(workoutRecapCues([signal(code)])).toEqual(['workout-recap-start', expectedCue]);
    expect(workoutRecapCues([signal(code)])).not.toContain('coach-recap-steady');
  });
});
