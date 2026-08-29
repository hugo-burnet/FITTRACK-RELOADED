import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import {
  CATALOGUE_SIZE,
  seedDatabase,
} from '@/data/seed/seedDatabase';
import { parseHevyCsv } from '@/lib/hevyCsv';
import { resetDb } from '@/test/resetDb';
import fixture from './__fixtures__/hevy-workout-data-real-anonymized.csv?raw';
import { HevyImportScreen } from './HevyImportScreen';

/**
 * Le rattrapage des paliers après l'import — le câblage, et lui seul.
 *
 * **Pourquoi une espionne et pas un décompte de la table `milestones`.** La
 * fixture anonymisée ne porte que six séances à 20 kg × 10 répétitions : elle ne
 * franchit délibérément aucun seuil, et compter ses lignes affirmerait « zéro »
 * aussi bien avec l'appel que sans lui. C'est donc l'appel qu'on observe, avec
 * son argument — qui est tout le sujet.
 *
 * **Ce que son absence donnait.** L'import écrivait dix ans de séances sans
 * jamais recalculer les paliers. Ils tombaient alors tous ensemble à la fin de
 * la séance suivante, celle-là avec `celebrate: true`, et l'accueil ouvrait une
 * carte de félicitations de quarante lignes. `syncMilestones` documente cette
 * exacte situation comme celle que `celebrate: false` existe pour éviter ; il
 * manquait seulement quelqu'un pour l'appeler.
 */
const syncMilestones = vi.hoisted(() => vi.fn(async () => []));

vi.mock('@/data/repositories/milestones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/repositories/milestones')>()),
  syncMilestones,
}));

const EXPECTED_CATALOGUE_SLUGS = {
  'Abduction Hanche': 'hip-abduction-machine',
  'Adduction Hanche': 'hip-adduction-machine',
  'Chest Press (Machine)': 'machine-chest-press',
  'Curl Biceps (Haltère)': 'dumbbell-curl',
  'Curl Marteau (Haltère)': 'hammer-curl',
  'Dead Hang': 'dead-hang',
  'Développé Couché (Haltère)': 'dumbbell-bench-press',
  'Développé Couché Incliné (Haltère)':
    'dumbbell-incline-bench-press',
  'Développé Debout Poulie Centrée': 'pallof-press',
  'Élévation Latérale (Poulie)': 'cable-lateral-raise',
  'Extension Dos (Hyperextension Lestée)':
    'weighted-back-extension',
  'Extension Jambes': 'leg-extension',
  'Extension Triceps Corde': 'cable-triceps-pushdown-rope',
  'Hip Thrust (Dumbbell)': 'dumbbell-hip-thrust',
  'Kickbacks Poulie': 'cable-glute-kickback',
  'Leg Curl Assis': 'seated-leg-curl',
  Planche: 'plank',
  'Planche Latérale': 'side-plank',
  'Presse à Cuisses Horizontal': 'leg-press',
  'Presse Épaules Assis (Machine)': 'machine-shoulder-press',
  'Rotation Externe Poulie': 'cable-external-rotation',
  'Tirage bas iso-latéral': 'seated-cable-row',
  'Tirage Poitrine (Poulie)': 'lat-pulldown',
  'Tirage vers Visage': 'face-pull',
} as const;

function renderImportScreen() {
  return render(
    <MemoryRouter initialEntries={['/history/import-hevy']}>
      <Routes>
        <Route path="/history/import-hevy" element={<HevyImportScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

function exactTextPattern(value: string): RegExp {
  return new RegExp(
    `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:À confirmer|Confirmé)`,
  );
}

function startingWith(value: string): RegExp {
  return new RegExp(
    `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  );
}

async function chooseFixture(user: ReturnType<typeof userEvent.setup>) {
  // Sur une base déjà remplie, l'écran demande d'abord d'aller vider — c'est
  // exactement le second import de ce test, qui vérifie le dédoublonnage.
  // Ajouter à un historique existant reste possible, d'un cran de plus.
  await waitFor(() =>
    expect(
      document.querySelector('input[type="file"]') ??
        screen.queryByRole('button', { name: 'Importer quand même' }),
    ).not.toBeNull(),
  );
  const bypass = screen.queryByRole('button', { name: 'Importer quand même' });
  if (bypass !== null) {
    await user.click(bypass);
    await screen.findByRole('heading', { name: 'Choisir l’export' });
  }

  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('champ de fichier introuvable');
  await user.upload(
    input,
    new File([fixture], 'workout_data.csv', { type: 'text/csv' }),
  );
}

async function importedTableCounts() {
  return {
    exercises: await db.exercises.count(),
    externalExerciseBindings: await db.externalExerciseBindings.count(),
    workouts: await db.workouts.count(),
    workoutExercises: await db.workoutExercises.count(),
    workoutSets: await db.workoutSets.count(),
    routineFolders: await db.routineFolders.count(),
    routines: await db.routines.count(),
    routineExercises: await db.routineExercises.count(),
    routineSets: await db.routineSets.count(),
  };
}

describe('HevyImportScreen — parcours CSV réel', () => {
  beforeEach(resetDb);

  afterEach(() => vi.restoreAllMocks());

  it('ne conserve que des performances synthétiques dans la fixture anonymisée', () => {
    const parsed = parseHevyCsv(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const sets = parsed.data.workouts.flatMap((workout) =>
      workout.exercises.flatMap((exercise) => exercise.sets),
    );

    expect(new Set(sets.flatMap((set) => set.weight === undefined ? [] : [set.weight]))).toEqual(
      new Set([20]),
    );
    expect(new Set(sets.flatMap((set) => set.reps === undefined ? [] : [set.reps]))).toEqual(
      new Set([10]),
    );
    expect(
      new Set(
        sets.flatMap((set) =>
          set.durationSeconds === undefined ? [] : [set.durationSeconds],
        ),
      ),
    ).toEqual(new Set([30]));
    expect(parsed.data.workouts.every((workout) => workout.notes === undefined)).toBe(true);
  });

  it('garde les confirmations après rollback et ne duplique pas la reprise', async () => {
    const parsed = parseHevyCsv(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data).toMatchObject({
      workoutCount: 6,
      exerciseCount: 25,
      setCount: 136,
    });
    expect(parsed.data.sourceExercises.map((source) => source.sourceTitle)).toEqual(
      expect.arrayContaining([
        'Développé Debout Poulie Centrée',
        'Oiseau (Machine)',
      ]),
    );

    await seedDatabase();
    const catalogue = await db.exercises.toArray();
    expect(catalogue).toHaveLength(CATALOGUE_SIZE);

    const user = userEvent.setup();
    const mounted = renderImportScreen();

    await chooseFixture(user);
    await screen.findByRole('heading', { name: 'Associer les exercices' });

    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();

    for (const source of parsed.data.sourceExercises) {
      await user.click(
        screen.getByRole('button', { name: exactTextPattern(source.sourceTitle) }),
      );
      const dialog = screen.getByRole('dialog', {
        name: source.sourceTitle,
      });
      if (source.sourceTitle === 'Oiseau (Machine)') {
        await user.click(
          within(dialog).getByRole('button', {
            name: `Créer « ${source.sourceTitle} »`,
          }),
        );
        continue;
      }
      const slug =
        EXPECTED_CATALOGUE_SLUGS[
          source.sourceTitle as keyof typeof EXPECTED_CATALOGUE_SLUGS
        ];
      if (slug === undefined) {
        throw new Error(`Suggestion catalogue manquante: ${source.sourceTitle}`);
      }
      const target = catalogue.find((exercise) => exercise.slug === slug);
      if (target === undefined) {
        throw new Error(`Exercice catalogue manquant: ${slug}`);
      }
      await user.click(
        within(dialog).getByRole('button', {
          name: startingWith(target.name),
        }),
      );
    }

    fireEvent.transitionEnd(screen.getByRole('dialog'));
    expect(screen.getAllByText('Confirmé')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('heading', { name: 'Vérifier l’import' });

    const wroteWorkoutSets = vi.spyOn(db.workoutSets, 'bulkAdd');
    const failLate = vi
      .spyOn(db.routineSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));
    await user.click(screen.getByRole('button', { name: 'Importer' }));

    await waitFor(
      () => expect(wroteWorkoutSets).toHaveBeenCalled(),
      { timeout: 10_000 },
    );
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent(
      'Aucune donnée n’a été écrite. Réessaie.',
    );
    expect(failLate).toHaveBeenCalledOnce();
    await waitFor(async () => {
      expect(await importedTableCounts()).toEqual({
        exercises: CATALOGUE_SIZE,
        externalExerciseBindings: 0,
        workouts: 0,
        workoutExercises: 0,
        workoutSets: 0,
        routineFolders: 0,
        routines: 0,
        routineExercises: 0,
        routineSets: 0,
      });
    });
    wroteWorkoutSets.mockRestore();
    failLate.mockRestore();

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await screen.findByRole('heading', { name: 'Associer les exercices' });
    expect(screen.getAllByText('Confirmé')).toHaveLength(25);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Importer' }));
    await screen.findByRole('heading', { name: 'Import terminé' });

    // `celebrate: false` est la moitié qui compte : un rattrapage entre acquis,
    // il ne se fête pas.
    await waitFor(() => expect(syncMilestones).toHaveBeenCalledWith({ celebrate: false }));

    await waitFor(async () => {
      expect(await importedTableCounts()).toEqual({
        exercises: CATALOGUE_SIZE + 1,
        externalExerciseBindings: 25,
        workouts: 6,
        workoutExercises: 53,
        workoutSets: 136,
        routineFolders: 1,
        routines: 6,
        routineExercises: 53,
        routineSets: 136,
      });
    });
    const pallof = (await db.exercises.toArray()).find(
      (exercise) => exercise.slug === 'pallof-press',
    );
    const cableShoulderPress = (await db.exercises.toArray()).find(
      (exercise) => exercise.slug === 'cable-shoulder-press',
    );
    expect(pallof).toMatchObject({
      primaryMuscle: 'abs',
      equipment: 'cable',
      measurementType: 'weight_reps',
    });
    expect(cableShoulderPress).toBeDefined();
    const pallofRows = await db.workoutExercises
      .where('exerciseId')
      .equals(pallof!.id)
      .toArray();
    expect(pallofRows).toHaveLength(2);
    for (const row of pallofRows) {
      expect(row).toMatchObject({
        exercisePrimaryMuscle: 'abs',
        exerciseEquipment: 'cable',
        exerciseMeasurementType: 'weight_reps',
      });
    }
    expect(
      await db.workoutSets
        .where('exerciseId')
        .equals(pallof!.id)
        .count(),
    ).toBe(4);
    expect(
      await db.workoutExercises
        .where('exerciseId')
        .equals(cableShoulderPress!.id)
        .count(),
    ).toBe(0);
    expect(
      await db.workoutSets
        .where('exerciseId')
        .equals(cableShoulderPress!.id)
        .count(),
    ).toBe(0);
    const countsAfterFirstImport = await importedTableCounts();

    mounted.unmount();
    renderImportScreen();
    await chooseFixture(user);
    await screen.findByRole('heading', { name: 'Vérifier l’import' });
    await user.click(screen.getByRole('button', { name: 'Importer' }));
    await screen.findByRole('heading', { name: 'Import terminé' });
    expect(screen.getByText('0 séances importées, 6 ignorées.')).toBeVisible();
    expect(await importedTableCounts()).toEqual(countsAfterFirstImport);
  }, 60_000);
});
