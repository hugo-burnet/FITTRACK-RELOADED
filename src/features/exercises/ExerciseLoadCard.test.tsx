import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import { createCustomExercise, getExercise } from '@/data/repositories/exercises';
import type { Exercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { ExerciseLoadCard } from './ExerciseLoadCard';

const make = (overrides: Partial<Parameters<typeof createCustomExercise>[0]> = {}) =>
  createCustomExercise({
    name: 'Traction prise neutre',
    primaryMuscle: 'lats',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType: 'reps_only',
    isUnilateral: 0,
    ...overrides,
  });

/** The card writes straight through, so the assertions read the row back. */
const reread = async (exercise: Exercise) => (await getExercise(exercise.id))!;

describe('ExerciseLoadCard — part du poids du corps', () => {
  beforeEach(resetDb);

  it('écrit 100 % d’un geste sur une traction qui n’en avait aucun', async () => {
    const exercise = await make();
    const user = userEvent.setup();
    render(<ExerciseLoadCard exercise={exercise} />);

    await user.click(screen.getByRole('button', { name: '100 %' }));

    await waitFor(async () => {
      expect((await reread(exercise)).bodyweightLoadFactor).toBe(1);
    });
  });

  it('marque le coefficient comme réglé à la main, pour que le catalogue s’en écarte', async () => {
    const exercise = await make();
    const user = userEvent.setup();
    render(<ExerciseLoadCard exercise={exercise} />);

    await user.click(screen.getByRole('button', { name: '70 %' }));

    await waitFor(async () => {
      const row = await reread(exercise);
      expect(row.bodyweightLoadFactor).toBe(0.7);
      expect(row.bodyweightLoadFactorIsCustom).toBe(1);
    });
  });

  it('accepte « non comptée » comme réponse, pas seulement comme absence', async () => {
    const exercise = await make({ bodyweightLoadFactor: 1 });
    const user = userEvent.setup();
    render(<ExerciseLoadCard exercise={exercise} />);

    await user.click(screen.getByRole('button', { name: 'Non comptée' }));

    await waitFor(async () => {
      expect((await reread(exercise)).bodyweightLoadFactor).toBeUndefined();
    });
  });

  it('prévient qu’un coefficient sans poids du corps ne compte toujours rien', async () => {
    const exercise = await make({ bodyweightLoadFactor: 1 });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(
      await screen.findByText('Renseigne ton poids sur l’accueil pour que ces répétitions comptent.'),
    ).toBeInTheDocument();
  });

  it('se tait dès que le poids du corps est connu', async () => {
    await saveBodyWeight(78);
    const exercise = await make({ bodyweightLoadFactor: 1 });
    render(<ExerciseLoadCard exercise={exercise} />);

    await waitFor(() => {
      expect(screen.queryByText(/Renseigne ton poids sur l’accueil/)).not.toBeInTheDocument();
    });
  });

  it('ne pose pas la question sur un exercice chargé à la barre', async () => {
    const exercise = await make({ equipment: 'barbell', measurementType: 'weight_reps' });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.queryByLabelText('Part du poids du corps')).not.toBeInTheDocument();
  });
});

describe('ExerciseLoadCard — chargement en disques', () => {
  beforeEach(resetDb);

  it('propose « aucun » sur une traction, et laisse le lest s’activer', async () => {
    const exercise = await make();
    const user = userEvent.setup();
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.getByRole('button', { name: /Chargement en disques/ })).toHaveTextContent(
      'Aucun',
    );

    await user.click(screen.getByRole('button', { name: /Chargement en disques/ }));
    await user.click(screen.getByRole('radio', { name: /^Un seul côté/ }));

    await waitFor(async () => {
      expect((await reread(exercise)).plateLoading).toBe('single_sided');
    });
  });

  it('ouvre une barre de 20 kg sur un exercice à la barre, sans rien avoir été réglé', async () => {
    const exercise = await make({ equipment: 'barbell', measurementType: 'weight_reps' });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.getByRole('button', { name: /Chargement en disques/ })).toHaveTextContent(
      'Sur une barre',
    );
    expect(screen.getByLabelText('Poids de la barre')).toHaveValue('');
    expect(screen.getByLabelText('Poids de la barre')).toHaveAttribute('placeholder', '20');
  });

  it('enregistre une barre EZ de 10 kg', async () => {
    const exercise = await make({ equipment: 'barbell', measurementType: 'weight_reps' });
    const user = userEvent.setup();
    render(<ExerciseLoadCard exercise={exercise} />);

    await user.type(screen.getByLabelText('Poids de la barre'), '10');

    await waitFor(async () => {
      expect((await reread(exercise)).plateBaseWeightKg).toBe(10);
    });
  });

  it('appelle « charge à vide » la base d’un chargement sans barre', async () => {
    const exercise = await make({ plateLoading: 'two_sided' });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.getByLabelText('Charge à vide')).toBeInTheDocument();
    expect(screen.queryByLabelText('Poids de la barre')).not.toBeInTheDocument();
  });

  it('n’offre aucun poids à vide quand il n’y a rien à charger', async () => {
    const exercise = await make({ plateLoading: 'none' });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.queryByLabelText('Charge à vide')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Poids de la barre')).not.toBeInTheDocument();
  });

  it('montre ce que le réglage donne sur une charge d’exemple', async () => {
    const exercise = await make({ plateLoading: 'single_sided' });
    render(<ExerciseLoadCard exercise={exercise} />);

    expect(screen.getByText('Pour 20 kg')).toBeInTheDocument();
    expect(screen.getByText('20 à charger')).toBeInTheDocument();
  });

  it('ne pose aucune des deux questions à un gainage', async () => {
    const exercise = await make({
      name: 'Gainage',
      primaryMuscle: 'abs',
      measurementType: 'time_only',
    });
    const { container } = render(<ExerciseLoadCard exercise={exercise} />);

    expect(container).toBeEmptyDOMElement();
  });
});
