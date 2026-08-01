import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@/data/types';
import type {
  ExternalExerciseObservation,
  ExternalExerciseReviewEntry,
} from '@/lib/externalExerciseIdentity';
import type { HevyImportData } from '@/lib/hevyCsv';
import type {
  HevyImportDraft,
  HevyMappingDraftRow,
} from './hevyImportDraft';
import { HevyExerciseMappingSheet } from './HevyExerciseMappingSheet';
import { HevyImportMappingStep } from './HevyImportMappingStep';
import { HevyImportReview } from './HevyImportReview';

function exercise(
  id: string,
  name: string,
  primaryMuscle: Exercise['primaryMuscle'],
  equipment: Exercise['equipment'],
): Exercise {
  return {
    id,
    name,
    primaryMuscle,
    secondaryMuscles: [],
    equipment,
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
  };
}

const pallof = exercise(
  'pallof',
  'Pallof press',
  'abs',
  'cable',
);
const shoulderPress = exercise(
  'shoulder',
  'Développé épaules à la poulie',
  'shoulders',
  'cable',
);

function observation(
  sourceTitle: string,
): ExternalExerciseObservation {
  return {
    source: 'hevy_csv',
    sourceTitle,
    measurementType: 'weight_reps',
    equipmentHint: 'cable',
    sessionCount: 2,
    setCount: 4,
    examples: [
      {
        workoutName: 'LOWER A',
        startedAt: new Date(2026, 6, 26, 12).getTime(),
        sets: [{ weight: 10, reps: 15 }],
      },
    ],
  };
}

function row(
  review: ExternalExerciseReviewEntry,
  resolution?: HevyMappingDraftRow['resolution'],
  resolutionSource?: HevyMappingDraftRow['resolutionSource'],
): HevyMappingDraftRow {
  return {
    source: {
      sourceTitle: review.observation.sourceTitle,
      measurementType: review.observation.measurementType,
      equipment: review.observation.equipmentHint ?? 'other',
    },
    review,
    ...(resolution === undefined ? {} : { resolution }),
    ...(resolutionSource === undefined ? {} : { resolutionSource }),
  };
}

function draft(rows: HevyMappingDraftRow[]): HevyImportDraft {
  return {
    importableWorkouts: 1,
    skippedWorkouts: 0,
    importedAt: 1,
    routineNames: [],
    rows,
  };
}

describe('HevyImportMappingStep', () => {
  it('distinguishes suggestions, reused confirmations and conflicts', () => {
    const suggestionObservation = observation(
      'Développé Debout Poulie Centrée',
    );
    const confirmedObservation = observation('Shoulder Press');
    const conflictObservation = observation('Ancien exercice');
    const rows = [
      row({
        status: 'needs_confirmation',
        identityKey: 'developpe debout poulie centree',
        observation: suggestionObservation,
        suggestions: [{ exercise: pallof }],
      }),
      row(
        {
          status: 'confirmed',
          identityKey: 'shoulder press',
          observation: confirmedObservation,
          exercise: shoulderPress,
        },
        { kind: 'existing', exerciseId: shoulderPress.id },
        'binding',
      ),
      row(
        {
          status: 'conflict',
          identityKey: 'ancien exercice',
          observation: conflictObservation,
          reason: 'target_deleted',
          suggestions: [],
        },
        { kind: 'existing', exerciseId: shoulderPress.id },
        'binding',
      ),
    ];

    render(
      <HevyImportMappingStep
        draft={draft(rows)}
        exercises={[pallof, shoulderPress]}
        onOpen={vi.fn()}
      />,
    );

    const suggestionButton = screen.getByRole('button', {
      name: /Développé Debout Poulie Centrée/,
    });
    expect(
      within(suggestionButton).getByText('À confirmer'),
    ).toBeInTheDocument();
    expect(
      within(suggestionButton).queryByRole('img'),
    ).not.toBeInTheDocument();

    const confirmedButton = screen.getByRole('button', {
      name: /Shoulder Press/,
    });
    expect(
      within(confirmedButton).getByText('Confirmé'),
    ).toBeInTheDocument();
    expect(
      within(confirmedButton).getByRole('img', {
        name: 'Confirmé',
      }),
    ).toBeInTheDocument();

    const conflictButton = screen.getByRole('button', {
      name: /Ancien exercice/,
    });
    expect(
      within(conflictButton).getByText('Association à vérifier'),
    ).toBeInTheDocument();
    expect(
      within(conflictButton).getByText(
        'L’exercice associé a été supprimé',
      ),
    ).toBeInTheDocument();
    expect(
      within(conflictButton).queryByRole('img'),
    ).not.toBeInTheDocument();
  });

  it('shows Pallof target metadata and source evidence on its row before opening details', async () => {
    const user = userEvent.setup();
    const sourceObservation = observation(
      'Développé Debout Poulie Centrée',
    );
    const pallofRow = row({
      status: 'needs_confirmation',
      identityKey: 'developpe debout poulie centree',
      observation: sourceObservation,
      suggestions: [{ exercise: pallof }],
    });

    function Harness() {
      const [opened, setOpened] =
        useState<HevyMappingDraftRow | null>(null);
      return (
        <>
          <HevyImportMappingStep
            draft={draft([pallofRow])}
            exercises={[pallof]}
            onOpen={setOpened}
          />
          <HevyExerciseMappingSheet
            row={opened}
            exercises={[pallof]}
            onClose={() => setOpened(null)}
            onSelect={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);
    const pallofButton = screen.getByRole('button', {
      name: /Développé Debout Poulie Centrée/,
    });
    expect(within(pallofButton).getByText('Pallof press')).toBeInTheDocument();
    expect(within(pallofButton).getByText('Abdominaux')).toBeInTheDocument();
    expect(within(pallofButton).getByText('Poulie')).toBeInTheDocument();
    expect(
      within(pallofButton).getByText('Poids et répétitions'),
    ).toBeInTheDocument();
    expect(
      within(pallofButton).getByText('2 séances · 4 séries'),
    ).toBeInTheDocument();

    await user.click(pallofButton);

    const dialog = screen.getByRole('dialog', {
      name: 'Développé Debout Poulie Centrée',
    });
    expect(within(dialog).getByText('Pallof press')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Abdominaux · Poulie · Poids et répétitions'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('2 séances · 4 séries'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('LOWER A')).toBeInTheDocument();
  });

  it('reviews new, reused and custom confirmations separately', () => {
    const reusedObservation = observation('Shoulder Press');
    const customObservation = observation('Exercice personnel');
    const rows = [
      row(
        {
          status: 'confirmed',
          identityKey: 'shoulder press',
          observation: reusedObservation,
          exercise: shoulderPress,
        },
        { kind: 'existing', exerciseId: shoulderPress.id },
        'binding',
      ),
      row(
        {
          status: 'needs_confirmation',
          identityKey: 'exercice personnel',
          observation: customObservation,
          suggestions: [],
        },
        {
          kind: 'custom',
          exercise: {
            name: 'Exercice personnel',
            primaryMuscle: 'other',
            secondaryMuscles: [],
            equipment: 'cable',
            measurementType: 'weight_reps',
            isUnilateral: 0,
          },
        },
        'user',
      ),
    ];
    const importData: HevyImportData = {
      workouts: [],
      sourceExercises: [],
      workoutCount: 1,
      exerciseCount: 2,
      setCount: 4,
    };

    render(
      <HevyImportReview data={importData} draft={draft(rows)} />,
    );

    expect(
      screen.getByText('1 nouvelle association'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 association confirmée réutilisée'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 exercice personnel sera créé.'),
    ).toBeInTheDocument();
  });
});
