import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import { setDefaultLoadStepKg } from '@/data/repositories/settings';
import type {
  CoachRecommendation,
  Exercise,
  PersonalRecord,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';

const exercise: Exercise = {
  ...newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id: 'bench',
};

const workout: Workout = {
  ...newEntity<Workout>({
    routineId: '',
    name: 'Haut du corps',
    status: 'completed',
    startedAt: Date.UTC(2026, 6, 1, 18),
    endedAt: Date.UTC(2026, 6, 1, 19),
    durationSeconds: 3_600,
  }),
  id: 'workout',
};

const row: WorkoutExercise = {
  ...newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
  }),
  id: 'row',
};

const rawSet: WorkoutSet = {
  ...newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 100,
    reps: 5,
    isCompleted: 1,
    performedAt: workout.startedAt,
  }),
  id: 'raw-set',
};

const record = (
  id: string,
  type: PersonalRecord['type'],
  value: number,
  context: Partial<PersonalRecord> = {},
): PersonalRecord => ({
  ...newEntity<PersonalRecord>({
    exerciseId: exercise.id,
    type,
    value,
    achievedAt: workout.startedAt,
    workoutId: workout.id,
    ...context,
  }),
  id,
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL courante">{`${location.pathname}${location.search}`}</output>;
}

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/exercises/bench']}>
      <LocationProbe />
      <Routes>
        <Route path="/exercises/:id" element={<ExerciseDetailScreen />} />
        <Route path="/analytics/records" element={<p>Rail filtré</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ExerciseDetailScreen persisted records', () => {
  beforeEach(async () => {
    await resetDb();
    await db.transaction(
      'rw',
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.personalRecords,
      async () => {
        await db.exercises.add(exercise);
        await db.workouts.add(workout);
        await db.workoutExercises.add(row);
        await db.workoutSets.add(rawSet);
        await db.personalRecords.bulkAdd([
          record('persisted-weight', 'max_weight', 122.5, { weight: 122.5, reps: 3 }),
          record('persisted-1rm', 'best_1rm', 137.34, {
            weight: 120,
            reps: 5,
            formula: 'epley',
            workoutSetId: rawSet.id,
          }),
        ]);
      },
    );
  });

  it('reads the persisted projection even when raw sets contain different best values', async () => {
    renderScreen();

    // Les records sont des tuiles du groupe « Repères » : le nom accessible d'une tuile est
    // son libellé puis son chiffre, qui est ce que la projection persistée dit.
    const section = (await screen.findByText('Repères')).closest('section');
    expect(section).not.toBeNull();
    const maxWeight = within(section!).getByRole('button', { name: /^Charge max/ });
    expect(maxWeight).toHaveTextContent('122,5');
    expect(maxWeight).toHaveTextContent('kg');
    const oneRepMax = within(section!).getByRole('button', { name: /^1RM estimé/ });
    /**
     * Valeur brute persistée en pleine précision, relue au 0,1 kg du graphique.
     *
     * Une décimale et pas deux, et c'est explicite côté code : `recordNumber`
     * arrondit au centième par défaut, mais `recordValue` passe `10` pour
     * `best_1rm` seul. Un 1RM est une estimation — deux décimales y seraient une
     * fausse précision. Les deux branches ont trouvé cette assertion périmée
     * chacune de leur côté et l'ont corrigée à la même valeur.
     */
    expect(oneRepMax).toHaveTextContent('137,3');
    // Le contexte « 120 kg × 5 · Epley » n'est plus dit sur la fiche : la frise de records le porte.
    expect(within(section!).queryByText('100 kg × 5')).toBeNull();
  });

  it('opens the dedicated record rail filtered to this exercise', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: /^Charge max(?! ·)/ }));
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent(
        '/analytics/records?exerciseId=bench',
      ),
    );
  });
});

describe('ExerciseDetailScreen load increment', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(exercise);
  });

  it('persists a custom load increment next to rest settings', async () => {
    const user = userEvent.setup();
    renderScreen();

    const field = await screen.findByRole('textbox', { name: 'Incrément de charge' });
    expect(field).toHaveAttribute('placeholder', '2,5');

    await user.clear(field);
    await user.type(field, '1,25');

    await waitFor(async () => {
      const stored = await db.exercises.get('bench');
      expect(stored?.loadIncrementKg).toBe(1.25);
    });
  });

  it('montre le pas des Réglages, et non la table du matériel, quand la fiche est vide', async () => {
    await setDefaultLoadStepKg(1.125);
    renderScreen();

    const field = await screen.findByRole('textbox', { name: 'Incrément de charge' });

    await waitFor(() => expect(field).toHaveAttribute('placeholder', '1,125'));
    expect(screen.getByText(/Vide = le pas des Réglages \(1,125 kg\)/)).toBeInTheDocument();
  });

  it('garde la table du matériel dans la phrase tant que les Réglages ne disent rien', async () => {
    renderScreen();

    await screen.findByRole('textbox', { name: 'Incrément de charge' });

    expect(screen.getByText(/Vide = défaut selon le matériel \(2,5 kg\)/)).toBeInTheDocument();
  });
});

describe('ExerciseDetailScreen vues Suivi et Documentation', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add({ ...exercise, movementPattern: 'poussee_horizontale' });
  });

  it('ouvre sur le Suivi, pas sur la documentation', async () => {
    renderScreen();

    const tracking = await screen.findByRole('tab', { name: 'Suivi' });
    expect(tracking).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Documentation' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bascule sur la documentation reliée à l’exercice', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('tab', { name: 'Documentation' }));

    expect(screen.getByRole('heading', { name: 'Pectoraux' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Poussée horizontale' })).toBeVisible();
  });

  it('revient au Suivi sans perdre ses réglages', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('tab', { name: 'Documentation' }));
    await user.click(screen.getByRole('tab', { name: 'Suivi' }));

    expect(await screen.findByText('Notes')).toBeVisible();
  });
});

describe('ExerciseDetailScreen onglet Suivi', () => {
  beforeEach(async () => {
    await resetDb();
    await db.transaction(
      'rw',
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.coachRecommendations,
      async () => {
        await db.exercises.add(exercise);
        await db.workouts.add(workout);
        await db.workoutExercises.add(row);
        await db.workoutSets.add(rawSet);
        await db.coachRecommendations.add({
          ...newEntity<CoachRecommendation>({
            exerciseId: exercise.id,
            code: 'range_ceiling_reached',
            recommendedAt: workout.startedAt,
            nextLoadKg: 102.5,
            evidence: [],
            status: 'followed',
            sourceWorkoutId: workout.id,
          }),
          id: 'rec',
        });
      },
    );
  });

  it('écrit la dernière fois avec sa charge et ses reps, et mène à la séance', async () => {
    const user = userEvent.setup();
    renderScreen();

    const tile = await screen.findByRole('button', { name: /^La dernière fois/ });
    expect(tile).toHaveTextContent('100');
    expect(tile).toHaveTextContent('1 série : 5 reps');

    await user.click(tile);
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent('/history/workout'),
    );
  });

  it('porte la progression dans la seule tuile G, qui ouvre la vue plein écran', async () => {
    const user = userEvent.setup();
    renderScreen();

    const tile = await screen.findByRole('button', { name: /^Charge max · 1 séance/ });
    expect(tile).toHaveAttribute('data-size', 'G');
    expect(document.querySelectorAll('[data-size="G"]')).toHaveLength(1);

    await user.click(tile);
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent('/analytics/exercises/bench'),
    );
  });

  it('chaque ligne de séance mène à sa séance', async () => {
    const user = userEvent.setup();
    renderScreen();

    const sessions = (await screen.findByText('Séances')).closest('section')!;
    await user.click(within(sessions).getByRole('button', { name: /1 série/ }));
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent('/history/workout'),
    );
  });

  it('ouvre la séance source d’une recommandation du coach', async () => {
    const user = userEvent.setup();
    renderScreen();

    const coach = (await screen.findByText('Le coach')).closest('section')!;
    await user.click(within(coach).getByRole('button', { name: 'Voir la séance' }));
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent('/history/workout'),
    );
  });

  it('n’a plus de bande « Terminé », et la carte des muscles est dans la Documentation', async () => {
    const user = userEvent.setup();
    renderScreen();

    await screen.findByRole('button', { name: /^La dernière fois/ });
    expect(screen.queryByRole('button', { name: 'Terminé' })).toBeNull();
    expect(screen.queryByText('Muscles travaillés')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Documentation' }));
    expect(await screen.findByText('Muscles travaillés')).toBeVisible();
  });
});

describe('ExerciseDetailScreen exercice jamais fait', () => {
  beforeEach(async () => {
    await resetDb();
    await db.exercises.add(exercise);
  });

  it('ne dessine aucune section vide', async () => {
    renderScreen();

    expect(await screen.findByText(/Aucune séance avec cet exercice/)).toBeVisible();
    expect(screen.queryByText('Repères')).toBeNull();
    expect(screen.queryByText('Progression')).toBeNull();
    expect(screen.queryByText('Le coach')).toBeNull();
    expect(screen.queryByText('Séances')).toBeNull();
  });
});
