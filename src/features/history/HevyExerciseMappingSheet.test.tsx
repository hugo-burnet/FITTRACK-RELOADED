import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Exercise } from '@/data/types';
import type { HevyMappingDraftRow } from './hevyImportDraft';
import {
  setHevyImportResolution,
  unresolvedHevySources,
  type HevyImportDraft,
} from './hevyImportDraft';
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
  it('affiche le type de mesure de chaque cible proposée', () => {
    render(
      <HevyExerciseMappingSheet
        row={row}
        exercises={exercises}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Poids et répétitions/)).toHaveLength(3);
  });

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

  it('ne permet pas à une cible supprimée de résoudre la ligne ou d’activer Continuer', () => {
    const deleted = {
      ...exercises[0]!,
      id: 'deleted-target',
      name: 'Cible FitTrack supprimée',
      deletedAt: 2,
    };
    const conflictRow: HevyMappingDraftRow = {
      source: {
        sourceTitle: 'Ancien exercice Hevy',
        measurementType: 'weight_reps',
        equipment: 'dumbbell',
      },
      review: {
        status: 'conflict',
        identityKey: 'ancien exercice hevy',
        observation: {
          source: 'hevy_csv',
          sourceTitle: 'Ancien exercice Hevy',
          measurementType: 'weight_reps',
          equipmentHint: 'dumbbell',
          sessionCount: 1,
          setCount: 1,
          examples: [],
        },
        reason: 'target_deleted',
        suggestions: [{ exercise: deleted }],
      },
    };
    const initialDraft: HevyImportDraft = {
      importableWorkouts: 1,
      skippedWorkouts: 0,
      importedAt: 1,
      routineNames: [],
      rows: [conflictRow],
    };

    function Harness() {
      const [draft, setDraft] = useState(initialDraft);
      return (
        <>
          <HevyExerciseMappingSheet
            row={conflictRow}
            exercises={[deleted]}
            onClose={vi.fn()}
            onSelect={(resolution) =>
              setDraft((current) =>
                setHevyImportResolution(
                  current,
                  conflictRow.source.sourceTitle,
                  resolution,
                ),
              )
            }
          />
          <button
            type="button"
            disabled={unresolvedHevySources(draft).length > 0}
          >
            Continuer
          </button>
          <output>
            {draft.rows[0]?.resolution === undefined
              ? 'non résolu'
              : 'résolu'}
          </output>
        </>
      );
    }

    render(<Harness />);

    const dialog = screen.getByRole('dialog', {
      name: 'Ancien exercice Hevy',
    });
    expect(
      within(dialog).queryByRole('button', {
        name: /Cible FitTrack supprimée/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continuer' }),
    ).toBeDisabled();
    expect(screen.getByText('non résolu')).toBeInTheDocument();
  });
});
