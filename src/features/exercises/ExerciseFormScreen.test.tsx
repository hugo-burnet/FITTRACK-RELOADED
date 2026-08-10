import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCustomExercise, listExercises } from '@/data/repositories/exercises';
import { resetDb } from '@/test/resetDb';
import { ExerciseFormScreen } from './ExerciseFormScreen';

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/exercises/new']}>
      <Routes>
        <Route path="/exercises/new" element={<ExerciseFormScreen />} />
        <Route path="*" element={<div>destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function chooseMeasurement(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /Ce que tu saisis/ }));
  await user.click(screen.getByRole('radio', { name: new RegExp('^' + name) }));
}

async function setName(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByLabelText('Nom'), name);
}

describe('ExerciseFormScreen bodyweight coefficient', () => {
  beforeEach(resetDb);

  it('shows an optional blank percentage for repetitions-only exercises', async () => {
    const user = userEvent.setup();
    renderCreate();

    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');

    expect(screen.getByLabelText('Part du poids du corps')).toHaveValue('');
    expect(screen.getByText('Optionnel. 70 % pour des pompes, 100 % pour des tractions.'))
      .toBeInTheDocument();
  });

  it('persists 70 percent as a 0.7 factor', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Pompes inclin\u00e9es');
    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');
    await user.type(screen.getByLabelText('Part du poids du corps'), '70');

    await user.click(screen.getByRole('button', { name: 'Cr\u00e9er l\u2019exercice' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Pompes inclin\u00e9es' }))[0]?.bodyweightLoadFactor,
      ).toBe(0.7);
    });
  });

  it('keeps a blank repetitions-only coefficient undefined', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Mouvement libre');
    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');
    await user.click(screen.getByRole('button', { name: 'Cr\u00e9er l\u2019exercice' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Mouvement libre' }))[0]?.bodyweightLoadFactor,
      ).toBeUndefined();
    });
  });

  it('defaults assisted repetitions to 100 percent', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Tractions assist\u00e9es maison');
    await chooseMeasurement(user, 'Assistance et r\u00e9p\u00e9titions');

    expect(screen.getByLabelText('Part du poids du corps')).toHaveValue('100');
    await user.click(screen.getByRole('button', { name: 'Cr\u00e9er l\u2019exercice' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Tractions assist\u00e9es maison' }))[0]
          ?.bodyweightLoadFactor,
      ).toBe(1);
    });
  });

  it('hides and removes the factor for an unrelated measurement type', async () => {
    const exercise = await createCustomExercise({
      name: 'Ancien mouvement',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isUnilateral: 0,
      bodyweightLoadFactor: 0.7,
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/exercises/' + exercise.id + '/edit']}>
        <Routes>
          <Route path="/exercises/:id/edit" element={<ExerciseFormScreen />} />
          <Route path="*" element={<div>destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Part du poids du corps')).toHaveValue('70');
    await chooseMeasurement(user, 'Poids et r\u00e9p\u00e9titions');
    expect(screen.queryByLabelText('Part du poids du corps')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Ancien mouvement' }))[0]?.bodyweightLoadFactor,
      ).toBeUndefined();
    });
  });

  it('rejects percentages outside the inclusive 1 to 100 range', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Coefficient invalide');
    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');
    await user.type(screen.getByLabelText('Part du poids du corps'), '101');

    expect(screen.getByRole('alert')).toHaveTextContent('Plus de 0 et jusqu\u2019\u00e0 100 %.');
    expect(screen.getByRole('button', { name: 'Cr\u00e9er l\u2019exercice' })).toBeDisabled();
  });
});
