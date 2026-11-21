import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type {
  CoachRecommendation,
  Exercise,
  PersonalRecord,
  Program,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { HistoryDetailScreen } from './HistoryDetailScreen';

const STARTED_AT = Date.UTC(2026, 6, 27, 16, 20, 0);

async function seedArchivedWorkout(): Promise<Workout> {
  const exercise = newEntity<Exercise>({
    name: 'Développé couché',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  });
  const workout = newEntity<Workout>({
    routineId: '',
    name: 'Upper A',
    status: 'completed',
    startedAt: STARTED_AT,
    endedAt: STARTED_AT + 3_600_000,
    durationSeconds: 3600,
    startedTimezoneOffsetMinutes: 120,
  });
  const row = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: 'weight_reps',
    exercisePrimaryMuscle: 'chest',
    exerciseEquipment: 'barbell',
  });
  const set = newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 80,
    reps: 10,
    isCompleted: 1,
    performedAt: STARTED_AT + 60_000,
  });

  await db.exercises.add(exercise);
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  await db.workoutSets.add(set);

  return workout;
}

function install(world: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, 'share', { value: world.share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: world.clipboard,
    configurable: true,
    writable: true,
  });
}

async function renderDetail(workoutId: string) {
  render(
    <MemoryRouter initialEntries={[`/history/${workoutId}`]}>
      <Routes>
        <Route path="/history/:workoutId" element={<HistoryDetailScreen />} />
        <Route path="/history" element={<p>Journal</p>} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Développé couché');
}

const openActions = () =>
  userEvent.click(screen.getByRole('button', { name: 'Actions de la séance' }));

describe('HistoryDetailScreen — benchmark', () => {
  beforeEach(resetDb);

  it('mène de la fiche d’un benchmark à son bilan', async () => {
    const workout = await seedArchivedWorkout();
    await db.workouts.update(workout.id, { kind: 'benchmark' });
    render(
      <MemoryRouter initialEntries={[`/history/${workout.id}`]}>
        <Routes>
          <Route path="/history/:workoutId" element={<HistoryDetailScreen />} />
          <Route path="/benchmark/:workoutId" element={<p>Bilan de la séance test</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Voir le bilan' }));

    expect(await screen.findByText('Bilan de la séance test')).toBeInTheDocument();
  });

  it('ne propose pas de bilan pour une séance ordinaire', async () => {
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    expect(screen.queryByRole('button', { name: 'Voir le bilan' })).not.toBeInTheDocument();
  });
});

describe('HistoryDetailScreen — partage', () => {
  beforeEach(resetDb);
  afterEach(() => install({ share: undefined, clipboard: undefined }));

  it('propose de partager et de copier la séance', async () => {
    install({ share: vi.fn(), clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled(),
    );
    expect(screen.getByRole('button', { name: 'Copier le texte' })).toBeEnabled();
  });

  it('envoie le Markdown de la séance à la feuille système', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0]?.[0] as { title: string; text: string };
    expect(payload.title).toBe('FitTrack — Upper A');
    expect(payload.text).toContain('# Export FitTrack');
    expect(payload.text).toContain('### Développé couché — Pectoraux · Barre');
    expect(payload.text).toContain('| 1 | 80 kg | 10 |');
  });

  it('ne dit rien quand le partage est annulé', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    install({ share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: vi.fn() } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(screen.queryByText(/presse-papiers/)).toBeNull();
  });

  it('confirme la copie, qui ne se voit nulle part ailleurs', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    install({ share: undefined, clipboard: { writeText } });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Copier le texte' })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copier le texte' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Séance copiée dans le presse-papiers.',
    );
    expect(writeText.mock.calls[0]?.[0]).toContain('# Export FitTrack');
  });

  it('annonce un échec quand ni le partage ni la copie ne sont possibles', async () => {
    install({ share: undefined, clipboard: undefined });
    const workout = await seedArchivedWorkout();
    await renderDetail(workout.id);

    await openActions();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Partager' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'La séance n’a pas pu être partagée ni copiée.',
    );
  });
});

describe('HistoryDetailScreen — le contexte, les records et le coach', () => {
  beforeEach(resetDb);

  async function renderWithRoutes(workoutId: string) {
    render(
      <MemoryRouter initialEntries={[`/history/${workoutId}`]}>
        <Routes>
          <Route path="/history/:workoutId" element={<HistoryDetailScreen />} />
          <Route path="/programs/:id" element={<p>Fiche du programme</p>} />
          <Route path="/exercises/:id" element={<p>Fiche de l’exercice</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Développé couché');
  }

  it('n’affiche ni programme, ni records, ni coach pour une séance libre', async () => {
    const workout = await seedArchivedWorkout();
    await renderWithRoutes(workout.id);

    expect(screen.queryByText('Records de cette séance')).not.toBeInTheDocument();
    expect(screen.queryByText('Ce que le coach en a conclu')).not.toBeInTheDocument();
    expect(screen.queryByText(/Semaine/)).not.toBeInTheDocument();
  });

  it('montre le programme de la séance, avec sa semaine et sa phase, et mène à sa fiche', async () => {
    const workout = await seedArchivedWorkout();
    const program = newEntity<Program>({
      name: 'Hypertrophie · automne',
      startsAt: STARTED_AT,
      durationWeeks: 6,
      status: 'active',
    });
    await db.programs.add(program);
    await db.workouts.update(workout.id, {
      programId: program.id,
      programWeekIndex: 1,
      programPhase: 'progression',
    });
    await renderWithRoutes(workout.id);

    const link = await screen.findByRole('button', { name: /Hypertrophie · automne/ });
    expect(link).toHaveTextContent('Semaine 2 / 6 · Progression');
    await userEvent.click(link);

    expect(await screen.findByText('Fiche du programme')).toBeInTheDocument();
  });

  it('garde la ligne d’un programme supprimé, sans lien', async () => {
    const workout = await seedArchivedWorkout();
    const program = newEntity<Program>({
      name: 'Ancien',
      startsAt: STARTED_AT,
      durationWeeks: 6,
      status: 'completed',
    });
    await db.programs.add({ ...program, deletedAt: STARTED_AT });
    await db.workouts.update(workout.id, { programId: program.id, programWeekIndex: 0 });
    await renderWithRoutes(workout.id);

    expect(await screen.findByText('Programme supprimé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Programme supprimé/ })).not.toBeInTheDocument();
  });

  it('liste les records de la séance par exercice, chaque ligne menant à l’exercice', async () => {
    const workout = await seedArchivedWorkout();
    const exerciseId = (await db.exercises.toArray())[0]!.id;
    const record = newEntity<PersonalRecord>({
      exerciseId,
      type: 'max_weight',
      value: 80,
      achievedAt: STARTED_AT + 60_000,
      workoutId: workout.id,
      weight: 80,
      reps: 10,
    });
    await db.personalRecords.add(record);
    await renderWithRoutes(workout.id);

    expect(await screen.findByText('Records de cette séance')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Charge max/ }));

    expect(await screen.findByText('Fiche de l’exercice')).toBeInTheDocument();
  });

  it('dit ce que le coach a conclu de la séance, avec l’état de sa proposition', async () => {
    const workout = await seedArchivedWorkout();
    const exerciseId = (await db.exercises.toArray())[0]!.id;
    await db.coachRecommendations.add(
      newEntity<CoachRecommendation>({
        exerciseId,
        code: 'range_ceiling_reached',
        recommendedAt: STARTED_AT + 3_600_000,
        nextLoadKg: 82.5,
        evidence: [
          { label: 'current_load_kg', value: 80 },
          { label: 'working_sets', value: 4 },
          { label: 'target_reps_max', value: 8 },
        ],
        status: 'followed',
        sourceWorkoutId: workout.id,
      }),
    );
    await renderWithRoutes(workout.id);

    expect(await screen.findByText('Ce que le coach en a conclu')).toBeInTheDocument();
    expect(screen.getByText('Suivie')).toBeInTheDocument();
    expect(screen.getByText('82,5')).toBeInTheDocument();
  });

  it('ouvre la page de l’exercice depuis le titre de sa carte', async () => {
    const workout = await seedArchivedWorkout();
    await renderWithRoutes(workout.id);

    await userEvent.click(screen.getByRole('button', { name: 'Développé couché' }));

    expect(await screen.findByText('Fiche de l’exercice')).toBeInTheDocument();
  });
});
