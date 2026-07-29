import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@/data/types';
import type { HevyMappingDraftRow } from './hevyImportDraft';
import { filterHevyMappingExercises } from './hevyExerciseMappingFilters';
import { HevyExerciseMappingSheet } from './HevyExerciseMappingSheet';

const row: HevyMappingDraftRow = {
  source: {
    sourceTitle: 'Développé Hevy',
    measurementType: 'weight_reps',
    equipment: 'dumbbell',
  },
  review: {
    status: 'needs_confirmation',
    identityKey: 'developpe hevy',
    observation: {
      source: 'hevy_csv',
      sourceTitle: 'Développé Hevy',
      measurementType: 'weight_reps',
      equipmentHint: 'dumbbell',
      sessionCount: 1,
      setCount: 1,
      examples: [],
    },
    suggestions: [],
  },
};

function exercise(
  id: string,
  name: string,
  primaryMuscle: Exercise['primaryMuscle'],
  equipment: Exercise['equipment'],
  measurementType: Exercise['measurementType'] = 'weight_reps',
): Exercise {
  return {
    id,
    name,
    primaryMuscle,
    secondaryMuscles: [],
    equipment,
    measurementType,
    isCustom: 0,
    isUnilateral: 0,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
  };
}

const exercises = [
  exercise('matching', 'Développé incliné haltères', 'chest', 'dumbbell'),
  exercise('wrong-equipment', 'Développé couché barre', 'chest', 'barbell'),
  exercise('wrong-muscle', 'Curl incliné haltères', 'biceps', 'dumbbell'),
  exercise('wrong-measurement', 'Développé chronométré', 'chest', 'dumbbell', 'time_only'),
];

describe('HevyExerciseMappingSheet', () => {
  it('combines measurement, search, muscle and equipment filters', () => {
    expect(
      filterHevyMappingExercises(exercises, row, 'developpe', 'chest', 'dumbbell').map(
        (candidate) => candidate.id,
      ),
    ).toEqual(['matching']);
  });

  it('resets both filters after closing the mapping sheet', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [currentRow, setCurrentRow] = useState<HevyMappingDraftRow | null>(row);
      return (
        <>
          <button type="button" onClick={() => setCurrentRow(row)}>
            Rouvrir
          </button>
          <HevyExerciseMappingSheet
            row={currentRow}
            exercises={exercises}
            onClose={() => setCurrentRow(null)}
            onSelect={vi.fn()}
          />
        </>
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Muscle' }));
    await user.click(screen.getByRole('radio', { name: 'Pectoraux' }));
    await user.click(screen.getByRole('button', { name: 'Matériel' }));
    await user.click(screen.getByRole('radio', { name: 'Haltères' }));

    const mappingDialog = screen.getByRole('dialog', { name: 'Développé Hevy' });
    expect(within(mappingDialog).getByRole('button', { name: 'Pectoraux' })).toBeInTheDocument();
    expect(within(mappingDialog).getByRole('button', { name: 'Haltères' })).toBeInTheDocument();

    await user.click(within(mappingDialog).getByRole('button', { name: 'Fermer' }));
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }));

    const reopenedDialog = screen.getByRole('dialog', { name: 'Développé Hevy' });
    expect(within(reopenedDialog).getByRole('button', { name: 'Muscle' })).toBeInTheDocument();
    expect(within(reopenedDialog).getByRole('button', { name: 'Matériel' })).toBeInTheDocument();
  });
});
