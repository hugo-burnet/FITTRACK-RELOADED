import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import * as personalRecordsRepository from '@/data/repositories/personalRecords';
import {
  PERSONAL_RECORDS_PROJECTION_VERSION,
  type RecordTimelineEntry,
} from '@/data/repositories/personalRecords';
import type { Exercise, PersonalRecord, Workout } from '@/data/types';
import { seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { RecordRail } from './RecordRail';
import { RecordsScreen } from './RecordsScreen';

const day = (number: number) => Date.UTC(2026, 6, number, 18);

const exercise = (id: string, name: string): Exercise => ({
  ...newEntity<Exercise>({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  }),
  id,
});

const workout = (id: string, status: 'active' | 'completed', at: number): Workout => ({
  ...newEntity<Workout>({
    routineId: '',
    name: `Séance ${id}`,
    status,
    startedAt: at,
    endedAt: status === 'completed' ? at + 3_600_000 : 0,
    durationSeconds: status === 'completed' ? 3_600 : 0,
  }),
  id,
});

const record = (
  id: string,
  exerciseId: string,
  workoutId: string,
  value: number,
  achievedAt: number,
  type: PersonalRecord['type'] = 'max_weight',
): PersonalRecord => ({
  ...newEntity<PersonalRecord>({ exerciseId, workoutId, type, value, achievedAt }),
  id,
});

async function seedTimeline(input: {
  exercises: Exercise[];
  workouts: Workout[];
  records: PersonalRecord[];
  current?: boolean;
}) {
  await db.transaction(
    'rw',
    db.exercises,
    db.workouts,
    db.personalRecords,
    db.settings,
    async () => {
      await db.exercises.bulkAdd(input.exercises);
      await db.workouts.bulkAdd(input.workouts);
      await db.personalRecords.bulkAdd(input.records);
      if (input.current !== false) {
        await db.settings.put({
          key: 'personalRecordsProjectionVersion',
          value: PERSONAL_RECORDS_PROJECTION_VERSION,
          updatedAt: Date.now(),
        });
      }
    },
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL courante">{`${location.pathname}${location.search}`}</output>;
}

function HistoryTarget() {
  const { workoutId } = useParams();
  return <p>{`Historique ${workoutId}`}</p>;
}

const renderRoute = (initialEntry = '/analytics/records') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/analytics/records" element={<RecordsScreen />} />
        <Route path="/analytics" element={<p>Analyses</p>} />
        <Route path="/workout" element={<p>Séance en cours</p>} />
        <Route path="/history/:workoutId" element={<HistoryTarget />} />
      </Routes>
    </MemoryRouter>,
  );

describe('RecordsScreen', () => {
  beforeEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  it('réutilise la timeline complète quand aucun filtre n’est actif', async () => {
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [record('record-1', bench.id, session.id, 80, day(1))],
    });
    const listTimeline = vi.spyOn(personalRecordsRepository, 'listRecordTimeline');

    renderRoute();

    expect(await screen.findByText('80 kg')).toBeVisible();
    expect(listTimeline).toHaveBeenCalledTimes(1);
  });

  it('limite les catégories de record à l’exercice sélectionné', async () => {
    const bench = exercise('bench', 'Développé couché');
    const squat = exercise('squat', 'Hack squat');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench, squat],
      workouts: [session],
      records: [
        record('bench-weight', bench.id, session.id, 100, day(2)),
        record('squat-reps', squat.id, session.id, 14, day(3), 'max_reps'),
      ],
    });

    renderRoute('/analytics/records?exerciseId=bench');
    expect(await screen.findByText('100 kg')).toBeVisible();
    await userEvent.click(await screen.findByRole('button', { name: 'Tous les records' }));

    expect(screen.getByRole('radio', { name: 'Charge max' })).toBeVisible();
    expect(screen.queryByRole('radio', { name: 'Répétitions max' })).toBeNull();
  });

  it('fait du record le plus récent la tête du rail puis montre tous les jalons antérieurs', async () => {
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [
        record('record-1', bench.id, session.id, 60, day(1)),
        record('record-2', bench.id, session.id, 70, day(2)),
        record('record-3', bench.id, session.id, 80, day(3)),
      ],
    });

    renderRoute();

    expect(await screen.findByRole('heading', { name: 'Records' })).toBeVisible();
    const marks = await screen.findAllByRole('listitem');
    expect(marks).toHaveLength(3);
    expect(marks.map((mark) => mark.textContent)).toEqual([
      expect.stringContaining('80 kg'),
      expect.stringContaining('70 kg'),
      expect.stringContaining('60 kg'),
    ]);
    expect(within(marks[0]!).getByText('Record actuel')).toBeVisible();
    expect(within(marks[2]!).getByText('Premier jalon')).toBeVisible();
  });

  it('expose le contexte, le gain et le premier jalon aux technologies d’assistance', async () => {
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [
        { ...record('record-1', bench.id, session.id, 60, day(1)), reps: 8 },
        { ...record('record-2', bench.id, session.id, 70, day(2)), reps: 6 },
      ],
    });

    renderRoute();

    const [currentMark, firstMark] = await screen.findAllByRole('listitem');
    const currentButton = within(currentMark!).getByRole('button');
    const firstButton = within(firstMark!).getByRole('button');
    expect(currentButton).toHaveAccessibleName(/Développé couché.*70 kg/);
    expect(currentButton).toHaveAccessibleDescription(/6 reps.*\+10 kg/);
    expect(firstButton).toHaveAccessibleName(/Développé couché.*60 kg/);
    expect(firstButton).toHaveAccessibleDescription(/8 reps.*Premier jalon/);
  });

  it('synchronise le filtre exercice avec l’URL et garde les options issues de la vue complète', async () => {
    const bench = exercise('bench', 'Développé couché');
    const squat = exercise('squat', 'Hack squat très longue amplitude contrôlée');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench, squat],
      workouts: [session],
      records: [
        record('bench-weight', bench.id, session.id, 100, day(2)),
        record('squat-reps', squat.id, session.id, 14, day(3), 'max_reps'),
      ],
    });

    const user = userEvent.setup();
    renderRoute('/analytics/records?exerciseId=bench');

    expect(await screen.findByRole('button', { name: 'Développé couché' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('URL courante')).toHaveTextContent('exerciseId=bench');
    expect(screen.queryByText('Hack squat très longue amplitude contrôlée')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Développé couché' }));
    expect(
      screen.getByRole('radio', { name: 'Hack squat très longue amplitude contrôlée' }),
    ).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Tous les exercices' }));

    await waitFor(() => expect(screen.getByLabelText('URL courante')).toHaveTextContent('/analytics/records'));
    expect(
      await screen.findByRole('button', {
        name: /Hack squat très longue amplitude contrôlée.*Répétitions max.*14 reps/i,
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Tous les records' }));
    await user.click(screen.getByRole('radio', { name: 'Répétitions max' }));
    expect(await screen.findByText('14 reps')).toBeVisible();
    await waitFor(() => expect(screen.queryByText('100 kg')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'Répétitions max' }));
    await user.click(screen.getByRole('radio', { name: 'Tous les records' }));
    expect(await screen.findByText('100 kg')).toBeVisible();
  });

  it('ouvre la séance active depuis son jalon', async () => {
    const bench = exercise('bench', 'Développé couché');
    const active = workout('active-workout', 'active', day(3));
    await seedTimeline({
      exercises: [bench],
      workouts: [active],
      records: [record('active-record', bench.id, active.id, 105, day(3))],
    });

    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: /Développé couché.*105 kg/i }));

    expect(await screen.findByText('Séance en cours')).toBeVisible();
  });

  it('évite une combinaison de filtres impossible pour l’exercice choisi', async () => {
    const bench = exercise('bench', 'Développé couché');
    const squat = exercise('squat', 'Hack squat');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench, squat],
      workouts: [session],
      records: [
        record('bench-weight', bench.id, session.id, 100, day(2)),
        record('squat-reps', squat.id, session.id, 14, day(3), 'max_reps'),
      ],
    });

    const user = userEvent.setup();
    renderRoute('/analytics/records?exerciseId=bench');
    expect(await screen.findByText('100 kg')).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Tous les records' }));

    expect(screen.getByRole('radio', { name: 'Charge max' })).toBeVisible();
    expect(screen.queryByRole('radio', { name: 'Répétitions max' })).toBeNull();
  });

  it('nomme et permet d’effacer un exercice de deep link indisponible', async () => {
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [record('bench-weight', bench.id, session.id, 100, day(2))],
    });

    const user = userEvent.setup();
    renderRoute('/analytics/records?exerciseId=missing');

    expect(await screen.findByRole('button', { name: 'Exercice indisponible' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByText('Aucun record avec ces filtres')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(await screen.findByText('100 kg')).toBeVisible();
  });

  it('sépare la valeur compacte du qualificatif d’assistance', async () => {
    const pullup = exercise('pullup', 'Tractions assistées');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [pullup],
      workouts: [session],
      records: [record('assistance', pullup.id, session.id, 40, day(2), 'min_assistance')],
    });

    renderRoute();

    expect(await screen.findByText('40 kg')).toBeVisible();
    expect(screen.getByText('d’assistance')).toBeVisible();
  });

  it('laisse une grande valeur suivre le zoom texte et revenir à la ligne sans overflow', async () => {
    const press = exercise('press', 'Presse à cuisses');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [press],
      workouts: [session],
      records: [record('large-value', press.id, session.id, 9_999, day(2))],
    });

    renderRoute();

    const value = await screen.findByText(/9\s999/, { selector: '.record-figure' });
    const unit = screen.getByText('kg');
    expect(value).toHaveClass('text-[2.5rem]', 'break-all');
    expect(value).not.toHaveAttribute('style');
    expect(unit).toHaveClass('text-base');
    expect(value.parentElement).toHaveClass('flex', 'flex-wrap');
  });

  it('ouvre le détail historique depuis un jalon terminé', async () => {
    const bench = exercise('bench', 'Développé couché');
    const completed = workout('completed-workout', 'completed', day(3));
    await seedTimeline({
      exercises: [bench],
      workouts: [completed],
      records: [record('completed-record', bench.id, completed.id, 105, day(3))],
    });

    const user = userEvent.setup();
    renderRoute();
    await user.click(await screen.findByRole('button', { name: /Développé couché.*105 kg/i }));

    expect(await screen.findByText('Historique completed-workout')).toBeVisible();
  });

  it('explique comment créer le premier record quand le rail est vide', async () => {
    await seedTimeline({ exercises: [], workouts: [], records: [] });

    renderRoute();

    expect(await screen.findByText('Ton premier record commencera ici')).toBeVisible();
    expect(screen.getByText(/Valide une série/)).toBeVisible();
  });

  it('permet de réessayer une projection obsolète puis remplace la réparation par le rail', async () => {
    const bench = exercise('bench', 'Développé couché');
    await db.exercises.add(bench);
    await seedWorkout({ exerciseId: bench.id, performedAt: day(2), sets: [[90, 5]] });
    await db.settings.put({ key: 'personalRecordsProjectionVersion', value: 0, updatedAt: 1 });
    const actualRebuild = personalRecordsRepository.rebuildAllRecords;
    const rebuild = vi
      .spyOn(personalRecordsRepository, 'rebuildAllRecords')
      .mockRejectedValueOnce(new Error('rebuild failed'))
      .mockImplementationOnce(actualRebuild);

    const user = userEvent.setup();
    renderRoute();

    expect(await screen.findByText('Tes records doivent être reconstruits')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Réparer les records' }));

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeVisible();
    expect(screen.getByText(/La réparation n’a pas abouti/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('90 kg')).toBeVisible();
    expect(screen.queryByText('Tes records doivent être reconstruits')).toBeNull();
    expect(rebuild).toHaveBeenCalledTimes(2);
  });

  it('anime uniquement un nouveau jalon inséré après le premier chargement', async () => {
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, 'animate', {
      value: animate,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [record('record-1', bench.id, session.id, 80, day(1))],
    });
    renderRoute();
    expect(await screen.findByText('80 kg')).toBeVisible();
    expect(animate).not.toHaveBeenCalled();

    await db.personalRecords.add(record('record-2', bench.id, session.id, 90, day(2)));

    expect(await screen.findByText('90 kg')).toBeVisible();
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  });

  it('insère instantanément un nouveau jalon quand les animations sont réduites', async () => {
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, 'animate', {
      value: animate,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: true }),
      configurable: true,
    });
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({
      exercises: [bench],
      workouts: [session],
      records: [record('record-1', bench.id, session.id, 80, day(1))],
    });
    renderRoute();
    expect(await screen.findByText('80 kg')).toBeVisible();

    await db.personalRecords.add(record('record-2', bench.id, session.id, 90, day(2)));

    expect(await screen.findByText('90 kg')).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
  });

  it('anime le premier jalon quand il arrive après un chargement initialement vide', async () => {
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, 'animate', {
      value: animate,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });
    const bench = exercise('bench', 'Développé couché');
    const session = workout('workout-1', 'completed', day(1));
    await seedTimeline({ exercises: [bench], workouts: [session], records: [] });
    renderRoute();
    expect(await screen.findByText('Ton premier record commencera ici')).toBeVisible();

    await db.personalRecords.add(record('record-1', bench.id, session.id, 80, day(1)));

    expect(await screen.findByText('80 kg')).toBeVisible();
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  });

  it('attend le jalon filtré quand la vue complète livre son nouvel ID en premier', async () => {
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, 'animate', {
      value: animate,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });
    const session = workout('workout-1', 'completed', day(1));
    const first: RecordTimelineEntry = {
      record: record('record-1', 'bench', session.id, 80, day(1)),
      exerciseName: 'Développé couché',
      workoutStatus: 'completed',
    };
    const inserted: RecordTimelineEntry = {
      record: record('record-2', 'bench', session.id, 90, day(2)),
      exerciseName: 'Développé couché',
      workoutStatus: 'completed',
      previousValue: 80,
    };
    const initialEntries = [first];
    const initialKnownIds = [first.record.id];
    const knownAfterInsertion = [first.record.id, inserted.record.id];
    const { rerender } = render(
      <RecordRail
        entries={initialEntries}
        knownRecordIds={initialKnownIds}
        visibleKnownRecordIds={initialKnownIds}
        onOpen={vi.fn()}
      />,
    );

    rerender(
      <RecordRail
        entries={initialEntries}
        knownRecordIds={knownAfterInsertion}
        visibleKnownRecordIds={knownAfterInsertion}
        onOpen={vi.fn()}
      />,
    );
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 10)));
    expect(animate).not.toHaveBeenCalled();

    rerender(
      <RecordRail
        entries={[inserted, first]}
        knownRecordIds={knownAfterInsertion}
        visibleKnownRecordIds={knownAfterInsertion}
        onOpen={vi.fn()}
      />,
    );
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
  });

  it('n’anime pas plus tard une insertion exclue quand la requête filtrée se résout en premier', async () => {
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, 'animate', {
      value: animate,
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: false }),
      configurable: true,
    });
    const session = workout('workout-1', 'completed', day(1));
    const first: RecordTimelineEntry = {
      record: record('record-1', 'bench', session.id, 80, day(1)),
      exerciseName: 'Développé couché',
      workoutStatus: 'completed',
    };
    const excluded: RecordTimelineEntry = {
      record: record('record-2', 'squat', session.id, 90, day(2)),
      exerciseName: 'Hack squat',
      workoutStatus: 'completed',
    };
    const initialEntries = [first];
    const filteredResult = [first];
    const initialKnownIds = [first.record.id];
    const knownAfterInsertion = [first.record.id, excluded.record.id];
    const filteredIds = [first.record.id];
    const { rerender } = render(
      <RecordRail
        entries={initialEntries}
        knownRecordIds={initialKnownIds}
        visibleKnownRecordIds={filteredIds}
        onOpen={vi.fn()}
      />,
    );

    // The filtered query resolves first with a fresh array but the same visible marks.
    rerender(
      <RecordRail
        entries={filteredResult}
        knownRecordIds={initialKnownIds}
        visibleKnownRecordIds={filteredIds}
        onOpen={vi.fn()}
      />,
    );
    rerender(
      <RecordRail
        entries={filteredResult}
        knownRecordIds={knownAfterInsertion}
        visibleKnownRecordIds={filteredIds}
        onOpen={vi.fn()}
      />,
    );
    expect(animate).not.toHaveBeenCalled();

    rerender(
      <RecordRail
        entries={[excluded, first]}
        knownRecordIds={knownAfterInsertion}
        visibleKnownRecordIds={knownAfterInsertion}
        onOpen={vi.fn()}
      />,
    );
    expect(animate).not.toHaveBeenCalled();
  });
});
