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

  /**
   * Le champ partait vide, et un exercice au poids du corps sans coefficient
   * pèse **zéro** dans le tonnage : une traction maison comptait quatorze
   * répétitions et pas un kilo. Remonté du téléphone. Le défaut est désormais le
   * corps entier — visible, et modifiable d'un geste juste en dessous.
   */
  it('part du corps entier pour un exercice en r\u00e9p\u00e9titions seules', async () => {
    const user = userEvent.setup();
    renderCreate();

    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');

    expect(screen.getByLabelText('Part du poids du corps')).toHaveValue('100');
    expect(screen.getByText('Optionnel. 70 % pour des pompes, 100 % pour des tractions.'))
      .toBeInTheDocument();
  });

  it('ne suppose aucun corps derri\u00e8re un mouvement \u00e0 l\u2019\u00e9lastique', async () => {
    const user = userEvent.setup();
    renderCreate();

    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');
    await user.click(screen.getByRole('button', { name: /Mat\u00e9riel/ }));
    await user.click(screen.getByRole('radio', { name: '\u00c9lastique' }));

    expect(screen.getByLabelText('Part du poids du corps')).toHaveValue('');
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

  it('respecte un coefficient effac\u00e9 \u00e0 la main', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Mouvement libre');
    await chooseMeasurement(user, 'R\u00e9p\u00e9titions seules');
    await user.clear(screen.getByLabelText('Part du poids du corps'));
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

/**
 * « Pour les tractions en prise neutre je n'ai pu renseigner que dos ou biceps,
 * pas les 2 » — remonté du téléphone. Le formulaire n'offrait qu'un muscle
 * principal, et `createCustomExercise` recevait `secondaryMuscles: []` en dur.
 */
describe('ExerciseFormScreen secondary muscles', () => {
  beforeEach(resetDb);

  async function openSecondaryMuscles(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /Muscles secondaires/ }));
  }

  it('enregistre plusieurs muscles secondaires \u00e0 la cr\u00e9ation', async () => {
    const user = userEvent.setup();
    renderCreate();
    await setName(user, 'Traction prise neutre');

    await openSecondaryMuscles(user);
    await user.click(screen.getByRole('checkbox', { name: 'Biceps' }));
    await user.click(screen.getByRole('checkbox', { name: 'Haut du dos' }));
    await user.click(screen.getByRole('button', { name: 'Termin\u00e9' }));

    expect(screen.getByText('Biceps \u00b7 Haut du dos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cr\u00e9er l\u2019exercice' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Traction prise neutre' }))[0]?.secondaryMuscles,
      ).toEqual(['biceps', 'upper_back']);
    });
  });

  it('n\u2019offre pas le muscle principal comme secondaire', async () => {
    const user = userEvent.setup();
    renderCreate();

    await openSecondaryMuscles(user);

    // Le formulaire s'ouvre sur « Pectoraux » comme muscle principal.
    expect(screen.queryByRole('checkbox', { name: 'Pectoraux' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Triceps' })).toBeInTheDocument();
  });

  it('laisse la feuille ouverte entre deux choix', async () => {
    const user = userEvent.setup();
    renderCreate();

    await openSecondaryMuscles(user);
    await user.click(screen.getByRole('checkbox', { name: 'Biceps' }));

    expect(screen.getByRole('checkbox', { name: 'Biceps' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Triceps' })).toBeInTheDocument();
  });

  it('modifie les muscles secondaires d\u2019un exercice existant', async () => {
    const exercise = await createCustomExercise({
      name: 'Traction prise neutre',
      primaryMuscle: 'lats',
      secondaryMuscles: ['biceps'],
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      isUnilateral: 0,
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

    expect(await screen.findByText('Biceps')).toBeInTheDocument();
    await openSecondaryMuscles(user);
    await user.click(screen.getByRole('checkbox', { name: 'Haut du dos' }));
    await user.click(screen.getByRole('button', { name: 'Termin\u00e9' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => {
      expect(
        (await listExercises({ search: 'Traction prise neutre' }))[0]?.secondaryMuscles,
      ).toEqual(['biceps', 'upper_back']);
    });
  });
});
