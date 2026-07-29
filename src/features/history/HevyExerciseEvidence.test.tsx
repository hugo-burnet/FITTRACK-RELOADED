import { render, screen } from '@testing-library/react';
import { t } from '@/i18n/fr';
import { describe, expect, it } from 'vitest';
import { HevyExerciseEvidence } from './HevyExerciseEvidence';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

describe('HevyExerciseEvidence', () => {
  it('localise le séparateur des valeurs partielles', () => {
    expect(t('history.importEvidenceValueSeparator')).toBe(' · ');
  });

  it('affiche le résumé et des séances exemples localisées', () => {
    const startedAt = Date.UTC(2024, 6, 9, 12);

    render(
      <HevyExerciseEvidence
        observation={{
          sessionCount: 2,
          setCount: 4,
          examples: [
            {
              workoutName: 'LOWER A',
              startedAt,
              sets: [
                { weight: 10, reps: 15 },
                { weight: 15, reps: 12 },
              ],
            },
            {
              workoutName: 'LOWER B',
              startedAt: Date.UTC(2024, 6, 7, 12),
              sets: [{ reps: 10 }, { durationSeconds: 45 }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('2 séances · 4 séries')).toBeVisible();
    expect(screen.getByText('LOWER A')).toBeVisible();
    expect(screen.getByText(dateFormatter.format(startedAt))).toBeVisible();
    expect(screen.getByText('10 kg × 15')).toBeVisible();
    expect(screen.getByText('15 kg × 12')).toBeVisible();
  });
});
