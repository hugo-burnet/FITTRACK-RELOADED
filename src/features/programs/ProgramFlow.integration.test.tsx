import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { createCustomExercise } from '@/data/repositories/exercises';
import * as programsRepository from '@/data/repositories/programs';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getProgramDetail,
  listPrograms,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import * as routinesRepository from '@/data/repositories/routines';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import { finishWorkout, getActiveWorkout, startWorkout } from '@/data/repositories/workouts';
import * as programWorkoutRepository from '@/data/repositories/programWorkout';
import { startWorkoutFromProgram } from '@/data/repositories/programWorkout';
import { resetDb } from '@/test/resetDb';
import { ProgramDetailScreen } from './ProgramDetailScreen';
import { ProgramEditorScreen } from './ProgramEditorScreen';
import { ProgramListScreen } from './ProgramListScreen';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="route actuelle">{location.pathname}</output>;
}

/**
 * Attendre la route, **exactement**.
 *
 * `toHaveTextContent` cherche une sous-chaîne : `/programs/<id>` est contenu
 * dans `/programs/<id>/edit`, donc l'attente rendait la main immédiatement,
 * encore sur l'éditeur. Le test lisait alors la base avant que l'écriture
 * déclenchée par le bouton ne soit terminée — et comparait l'état d'avant.
 */
const expectRoute = async (pathname: string): Promise<void> => {
  await waitFor(() =>
    expect(screen.getByRole('status', { name: 'route actuelle' })).toHaveTextContent(
      new RegExp(`^${pathname}$`),
    ),
  );
};

function renderProgramFlow(initialEntry = '/programs/new') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/programs" element={<ProgramListScreen />} />
        <Route path="/programs/new" element={<ProgramEditorScreen />} />
        <Route
          path="/programs/:id/edit"
          element={
            <>
              <ProgramEditorScreen />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/programs/:id"
          element={
            <>
              <ProgramDetailScreen />
              <LocationProbe />
            </>
          }
        />
        <Route path="/workout" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Monday of the civil week `weeksBack` weeks ago, at local midnight. */
function mondayWeeksAgo(weeksBack: number): number {
  const today = new Date();
  const isoDay = today.getDay() === 0 ? 7 : today.getDay();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  monday.setDate(monday.getDate() - (isoDay - 1) - weeksBack * 7);
  return monday.getTime();
}

/**
 * An eight-week block already in its fifth week: the editor seals S1–S4 and
 * offers S5 as the first effective week. Levels are unique per week so a row
 * can be recognised by its own number.
 */
async function createEditableActiveProgram() {
  const routine = await createRoutine('Force en cours');
  const program = await createProgramDraft({
    name: 'Bloc en cours',
    startsAt: mondayWeeksAgo(4),
    durationWeeks: 8,
  });
  await createScheduleRevision(program.id, 0, [{ routineId: routine.id, dayOfWeek: 1, order: 0 }]);
  await replaceProgramWeeks(
    program.id,
    Array.from({ length: 8 }, (_, weekIndex) => ({
      weekIndex,
      loadIndex: 70 + weekIndex * 5,
      phase: 'construction' as const,
    })),
  );
  await activateProgram(program.id);
  return { program, routine };
}

describe('parcours de création d’un programme', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it('active un bloc de huit semaines avec un split lundi/jeudi et une décharge en semaine 5', async () => {
    const mondayRoutine = await createRoutine('Force A');
    const thursdayRoutine = await createRoutine('Force B');
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Bloc force');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durée' }), '8');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Le jour est une pastille, pas un menu : sept cibles visibles, la semaine
    // se lit pendant qu'on la pose.
    await user.click(
      within(await screen.findByRole('group', { name: 'Jour de la séance 1' })).getByRole(
        'button',
        { name: 'Lundi' },
      ),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 1' }),
      mondayRoutine.id,
    );
    await user.click(screen.getByRole('button', { name: 'Ajouter une séance' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Jour de la séance 2' })).getByRole('button', {
        name: 'Jeudi',
      }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 2' }),
      thursdayRoutine.id,
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Étape 3 sur 3 · Semaines')).toBeVisible();
    // L'étape se lit une fois : la phrase la nomme, le rail la situe. Pas de
    // seconde liste de noms à relire, et rien de cliquable.
    const stepper = screen.getByRole('navigation', { name: 'Étape 3 sur 3 · Semaines' });
    expect(within(stepper).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(stepper).getByText('Étape 3 sur 3 · Semaines')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cadre' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Split' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Semaines' })).not.toBeInTheDocument();

    // Le trajet de départ est déjà la recette Hypertrophie : le bouton doit le
    // refléter dès le premier affichage, sans imposer un clic redondant.
    expect(
      screen.getByRole('button', { name: 'Appliquer la recette Hypertrophie' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Une recette pose le trajet — puis la semaine 5 le corrige à la main, ce
    // qui relâche la recette : elle n'est pas un état, juste un point de départ.
    await user.click(screen.getByRole('button', { name: 'Appliquer la recette Hypertrophie' }));
    expect(
      screen.getByRole('button', { name: 'Modifier la semaine 4, 04 — 60 % · Décharge' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Appliquer la recette Hypertrophie' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await user.click(await screen.findByRole('button', { name: /Modifier la semaine 5/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Phase' }), 'deload');
    await user.click(screen.getByRole('button', { name: 'Enregistrer la semaine' }));
    expect(
      screen.getByRole('button', { name: 'Appliquer la recette Hypertrophie' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      screen.getByRole('button', {
        name: 'Modifier la semaine 5, 05 — 60 % · Décharge',
      }),
    ).toBeVisible();
    await user.click(await screen.findByRole('button', { name: 'Activer le bloc' }));

    const programs = await waitFor(async () => {
      const stored = await listPrograms();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.program.status).toBe('active');
      return stored;
    });
    const programId = programs[0]!.program.id;
    const detail = await getProgramDetail(programId);

    expect(detail?.program).toMatchObject({
      name: 'Bloc force',
      durationWeeks: 8,
      status: 'active',
    });
    expect(detail?.weeks).toHaveLength(8);
    expect(detail?.weeks[4]).toMatchObject({ phase: 'deload', loadIndex: 60 });
    expect(detail?.revisions[0]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routineId: mondayRoutine.id, dayOfWeek: 1, order: 0 }),
        expect.objectContaining({ routineId: thursdayRoutine.id, dayOfWeek: 4, order: 0 }),
      ]),
    );
    await expectRoute(`/programs/${programId}`);
  });

  it('repersiste le cadre après un retour depuis le split', async () => {
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Bloc stable');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(await screen.findByRole('button', { name: 'Retour' }));

    const name = screen.getByRole('textbox', { name: 'Nom du bloc' });
    await user.clear(name);
    await user.type(name, 'Bloc durable');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durée' }), '10');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(async () => {
      const stored = await listPrograms();
      expect(stored[0]?.program).toMatchObject({ name: 'Bloc durable', durationWeeks: 10 });
    });
  });

  it('publie le split modifié d’un bloc actif à la semaine suivante sûre', async () => {
    const routine = await createRoutine('Force active');
    const replacement = await createRoutine('Force suivante');
    const today = new Date();
    const isoDay = today.getDay() === 0 ? 7 : today.getDay();
    const startsAtDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startsAtDate.setDate(startsAtDate.getDate() - (isoDay - 1));
    const startsAt = startsAtDate.getTime();
    const program = await createProgramDraft({ name: 'Bloc actif', startsAt, durationWeeks: 4 });
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 70,
        phase: 'construction' as const,
      })),
    );
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}/edit`);

    const effectiveWeek = await screen.findByRole('combobox', {
      name: 'Semaine d’entrée en vigueur',
    });
    expect(effectiveWeek).toHaveValue('0');
    expect(screen.getByRole('option', { name: 'Semaine 1' })).toBeVisible();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 1' }),
      replacement.id,
    );
    await user.click(screen.getByRole('button', { name: 'Utiliser à partir de la semaine 1' }));
    await expectRoute(`/programs/${program.id}`);
    const detail = await getProgramDetail(program.id);
    expect(detail?.revisions).toHaveLength(1);
    expect(detail?.revisions[0]?.revision.effectiveFromWeekIndex).toBe(0);
    expect(detail?.revisions[0]?.entries[0]?.routineId).toBe(replacement.id);
    expect(detail?.weeks).toHaveLength(4);
  });

  it('exclut la semaine courante déjà enregistrée des choix effectifs', async () => {
    const routine = await createRoutine('Force active');
    const today = new Date();
    const isoDay = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - (isoDay - 1));
    const program = await createProgramDraft({
      name: 'Bloc enregistré',
      startsAt: monday.getTime(),
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    const revision = await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(program.id);
    const entry = (await getProgramDetail(program.id))!.revisions.find(
      ({ revision: candidate }) => candidate.id === revision.id,
    )!.entries[0]!;
    const workout = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entry.id,
    });
    await finishWorkout(workout.workout.id);

    renderProgramFlow(`/programs/${program.id}/edit`);

    const effectiveWeek = await screen.findByRole('combobox', {
      name: 'Semaine d’entrée en vigueur',
    });
    expect(effectiveWeek).toHaveValue('1');
    expect(screen.queryByRole('option', { name: 'Semaine 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semaine 2' })).toBeVisible();
  });

  it('permet de remplacer explicitement une révision future existante', async () => {
    const initial = await createRoutine('Force initiale');
    const future = await createRoutine('Force future');
    const replacement = await createRoutine('Force future corrigée');
    const today = new Date();
    const isoDay = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - (isoDay - 1));
    const program = await createProgramDraft({
      name: 'Bloc futur',
      startsAt: monday.getTime(),
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: initial.id, dayOfWeek: 1, order: 0 },
    ]);
    await createScheduleRevision(program.id, 2, [{ routineId: future.id, dayOfWeek: 1, order: 0 }]);
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}/edit`);

    const effectiveWeek = await screen.findByRole('combobox', {
      name: 'Semaine d’entrée en vigueur',
    });
    expect(effectiveWeek).toHaveValue('2');
    expect(screen.queryByRole('option', { name: 'Semaine 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semaine 3' })).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 1' }),
      replacement.id,
    );
    await user.click(screen.getByRole('button', { name: 'Utiliser à partir de la semaine 3' }));

    const detail = await getProgramDetail(program.id);
    expect(detail?.revisions).toHaveLength(2);
    expect(detail?.revisions[1]?.revision.effectiveFromWeekIndex).toBe(2);
    expect(detail?.revisions[1]?.entries[0]?.routineId).toBe(replacement.id);
  });

  it('édite un actif par sections empilées, sans nav d’étapes', async () => {
    const { program } = await createEditableActiveProgram();
    renderProgramFlow(`/programs/${program.id}/edit`);

    // Modifier n'est pas créer : les trois sections sont déjà là, il n'y a plus
    // d'étape à compter. Le rail et la phrase « Étape n sur 3 » restent sur
    // /programs/new.
    expect(
      await screen.findByRole('combobox', { name: 'Semaine d’entrée en vigueur' }),
    ).toBeVisible();
    expect(screen.queryByRole('navigation', { name: /^Étape/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Étape \d sur 3/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Split' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Semaines' })).toBeVisible();
    // Le cadre d'un actif est posé : son nom et sa durée ne se rejouent pas ici.
    expect(screen.queryByRole('textbox', { name: 'Nom du bloc' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Routine de la séance 1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Utiliser à partir de la semaine 5' })).toBeVisible();
  });

  it('applique une recette à partir de la semaine 5 sans toucher aux quatre premières', async () => {
    const { program } = await createEditableActiveProgram();
    const before = await getProgramDetail(program.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}/edit`);

    await user.click(
      await screen.findByRole('button', { name: 'Appliquer la recette Hypertrophie' }),
    );

    // À l'écran : les semaines scellées gardent leur niveau et ne s'ouvrent pas.
    for (const [index, level] of ['70 %', '75 %', '80 %', '85 %'].entries()) {
      expect(screen.getByText(level)).toBeVisible();
      expect(
        screen.queryByRole('button', { name: new RegExp(`Modifier la semaine ${index + 1},`) }),
      ).not.toBeInTheDocument();
    }
    // Le motif est ancré au bloc, pas à la retouche : S5 reprend au début du
    // motif de quatre semaines, S8 est la Décharge.
    expect(
      screen.getByRole('button', { name: 'Modifier la semaine 5, 05 — 100 % · Construction' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Modifier la semaine 8, 08 — 60 % · Décharge' }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Utiliser à partir de la semaine 5' }));
    await expectRoute(`/programs/${program.id}`);

    // En base : les lignes des quatre premières semaines ne sont même pas
    // réécrites — mêmes identités, mêmes valeurs.
    const after = await getProgramDetail(program.id);
    expect(after?.weeks).toHaveLength(8);
    expect(after?.weeks.slice(0, 4)).toEqual(before?.weeks.slice(0, 4));
    expect(after?.weeks.slice(4).map(({ phase, loadIndex }) => ({ phase, loadIndex }))).toEqual([
      { phase: 'construction', loadIndex: 100 },
      { phase: 'progression', loadIndex: 105 },
      { phase: 'overload', loadIndex: 110 },
      { phase: 'deload', loadIndex: 60 },
    ]);
  });

  it('enregistre le brouillon sans l’activer, puis l’active depuis la fiche', async () => {
    const routine = await createRoutine('Force brouillon');
    const program = await createProgramDraft({
      name: 'Bloc à finir',
      startsAt: mondayWeeksAgo(-1),
      durationWeeks: 4,
    });
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    // Sans split ni semaines, le brouillon ne s'active pas : il se termine.
    await user.click(await screen.findByRole('button', { name: 'Continuer la création' }));
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Routine de la séance 1' }),
      routine.id,
    );
    await user.click(screen.getByRole('button', { name: 'Appliquer la recette Force' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(async () => {
      const saved = await getProgramDetail(program.id);
      expect(saved?.program.status).toBe('draft');
      expect(saved?.weeks).toHaveLength(4);
      expect(saved?.revisions[0]?.entries[0]?.routineId).toBe(routine.id);
    });

    // L'activation vit sur la fiche, là où l'on voit ce qu'on lance.
    await user.click(await screen.findByRole('button', { name: 'Activer le bloc' }));
    await waitFor(async () => {
      expect((await getProgramDetail(program.id))?.program.status).toBe('active');
    });
  });

  it('distingue une erreur de lecture de l’absence et du chargement', async () => {
    const read = vi
      .spyOn(programsRepository, 'getProgramDetail')
      .mockRejectedValueOnce(new Error('read failed'));

    renderProgramFlow('/programs/unreadable/edit');

    expect(
      await screen.findByText('Le bloc n’a pas pu être lu. Tes données restent sur cet appareil.'),
    ).toBeVisible();
    read.mockRestore();
  });

  it('distingue une erreur de lecture des routines de leur chargement et de leur absence', async () => {
    vi.spyOn(routinesRepository, 'listRoutineSummaries').mockRejectedValue(
      new Error('routine read failed'),
    );
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Bloc cassé');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(
      await screen.findByText(
        'Les routines n’ont pas pu être lues. Réessaie avant de composer le split.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  });

  it('nomme le champ qui manque, et écrit la règle du lundi', async () => {
    await createRoutine('Full-body');
    const user = userEvent.setup();
    renderProgramFlow();

    // La contrainte est lisible avant d'être enfreinte.
    expect(await screen.findByText(/les semaines du bloc se comptent du lundi/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Donne un nom au bloc.');

    await user.type(screen.getByRole('textbox', { name: 'Nom du bloc' }), 'Bloc force');
    // Un mercredi : seule la date est en cause, et c'est la seule chose que dit
    // le message. Avant, il redemandait le nom et la durée, tous deux corrects.
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-19');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le départ tombe un lundi : un bloc se compte en semaines pleines.',
    );
  });

  it('crée la routine qui manque depuis le split, sans quitter l’assistant', async () => {
    // Bibliothèque vide : l'étape était une impasse — sortir, composer, revenir.
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Premier bloc');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await user.click(await screen.findByRole('button', { name: 'Nouvelle routine' }));
    await user.type(await screen.findByRole('textbox', { name: 'Nom de la routine' }), 'Poussée');
    await user.click(screen.getByRole('button', { name: 'Créer et placer' }));

    // Créée, et déjà choisie pour cette séance : on continue sans rien retaper.
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Routine de la séance 1' })).toHaveDisplayValue(
        'Poussée',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Étape 3 sur 3 · Semaines')).toBeVisible();
    const stored = await routinesRepository.listRoutineSummaries();
    expect(stored.map(({ routine }) => routine.name)).toEqual(['Poussée']);
  });
});

const TRACKING_NOW = new Date(2026, 7, 13, 12).getTime();
const TRACKING_START = new Date(2026, 7, 3, 0).getTime();

async function createTrackingProgram(name = 'Bloc suivi') {
  const routines = await Promise.all([
    createRoutine('Force terminée'),
    createRoutine('Jambes en retard'),
    createRoutine('Poussée du jour'),
    createRoutine('Tirage à venir'),
  ]);
  const program = await createProgramDraft({
    name,
    startsAt: TRACKING_START,
    durationWeeks: 4,
  });
  await replaceProgramWeeks(
    program.id,
    Array.from({ length: 4 }, (_, weekIndex) => ({
      weekIndex,
      loadIndex: 70 + weekIndex * 5,
      phase: weekIndex === 3 ? ('deload' as const) : ('construction' as const),
    })),
  );
  await createScheduleRevision(
    program.id,
    0,
    [1, 2, 4, 6].map((dayOfWeek, index) => ({
      routineId: routines[index]!.id,
      dayOfWeek,
      order: 0,
    })),
  );
  await activateProgram(program.id);
  const detail = await getProgramDetail(program.id);
  return { program, routines, entries: detail!.revisions[0]!.entries };
}

describe('suivi du bloc courant', () => {
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(TRACKING_NOW);
    await resetDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lit la semaine courante puis distingue les séances terminée, manquée, du jour et à venir', async () => {
    const { program, entries } = await createTrackingProgram();
    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entries[0]!.id,
      at: TRACKING_NOW,
    });
    await finishWorkout(workout.id);

    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByText('Semaine 2 / 4')).toBeVisible();
    expect(screen.getByText('02 — 75 % · Construction')).toBeVisible();
    expect(screen.getByText('Force terminée')).toBeVisible();
    expect(screen.getByText('Terminée')).toBeVisible();
    expect(screen.getByText('Jambes en retard')).toBeVisible();
    expect(screen.getByText('Manquée')).toBeVisible();
    expect(screen.getByText('Poussée du jour')).toBeVisible();
    expect(screen.getByText('Aujourd’hui')).toBeVisible();
    expect(screen.getByText('Tirage à venir')).toBeVisible();
    expect(screen.getByText('À venir')).toBeVisible();
    expect(screen.getByText('03 — 80 % · Construction')).toBeVisible();
    expect(screen.getByText('04 — 85 % · Décharge')).toBeVisible();
  });

  it('démarre la séance choisie via le programme puis ouvre la séance en direct', async () => {
    const { program } = await createTrackingProgram();
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    await user.click(await screen.findByRole('button', { name: 'Poussée du jour, Aujourd’hui' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer Poussée du jour' }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'route actuelle' })).toHaveTextContent('/workout');
    });
    expect(await getActiveWorkout()).toMatchObject({
      programId: program.id,
      programWeekIndex: 1,
    });
  });

  it('laisse une séance terminée sélectionnable pour la refaire', async () => {
    const { program, entries } = await createTrackingProgram();
    const first = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entries[0]!.id,
      at: TRACKING_NOW,
    });
    await finishWorkout(first.workout.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    const completed = await screen.findByRole('button', {
      name: 'Force terminée, Terminée',
    });
    expect(completed).toBeEnabled();
    await user.click(completed);
    await user.click(screen.getByRole('button', { name: 'Démarrer Force terminée' }));

    await waitFor(async () => {
      expect(await getActiveWorkout()).toMatchObject({
        programId: program.id,
        programScheduleEntryId: entries[0]!.id,
      });
    });
  });

  it('affiche l’historique par contexte sur le détail d’un bloc terminé', async () => {
    const { program, entries } = await createTrackingProgram();
    const completed = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entries[0]!.id,
      at: TRACKING_NOW,
    });
    await finishWorkout(completed.workout.id);
    await programsRepository.completeProgram(program.id);

    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByRole('button', { name: 'Force terminée, Terminée' })).toBeDisabled();
  });

  it('supprime le bloc depuis la fiche sans toucher aux séances de l’historique', async () => {
    const { program, entries } = await createTrackingProgram();
    const { workout } = await startWorkoutFromProgram({
      programId: program.id,
      programScheduleEntryId: entries[0]!.id,
      at: TRACKING_NOW,
    });
    await finishWorkout(workout.id);

    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    await user.click(await screen.findByRole('button', { name: 'Options du bloc' }));
    await user.click(await screen.findByRole('button', { name: /Supprimer le bloc/ }));
    // La feuille de confirmation dit ce qui reste avant de demander de confirmer.
    expect(
      await screen.findByText(/Les séances déjà faites restent dans ton historique/),
    ).toBeVisible();
    const sheet = await screen.findByRole('dialog', { name: 'Supprimer le bloc' });
    await user.click(within(sheet).getByRole('button', { name: 'Supprimer le bloc' }));

    await waitFor(async () => {
      expect(await listPrograms()).toHaveLength(0);
    });
    const stored = await db.workouts.get(workout.id);
    expect(stored).toMatchObject({ id: workout.id, deletedAt: 0, programId: program.id });
    // Retour à la liste, désormais vide — la fiche du bloc n'existe plus.
    expect(await screen.findByText(/Aucun bloc pour l’instant/)).toBeVisible();
  });

  it('démarre sans repli 1RM : identity copie les cibles de la routine', async () => {
    const movement = await createCustomExercise({
      name: 'Squat sans record',
      primaryMuscle: 'quads',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Force avertie');
    await addExercisesToRoutine(routine.id, [movement.id]);
    const program = await createProgramDraft({
      name: 'Bloc averti',
      startsAt: TRACKING_START,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 75,
        phase: 'construction' as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 4, order: 0 },
    ]);
    await activateProgram(program.id);
    const entry = (await getProgramDetail(program.id))!.revisions[0]!.entries[0]!;
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    await user.click(await screen.findByRole('button', { name: 'Force avertie, Aujourd’hui' }));
    await user.click(screen.getByRole('button', { name: 'Démarrer Force avertie' }));

    expect(screen.queryByRole('dialog', { name: 'Cibles conservées' })).not.toBeInTheDocument();
    await waitFor(async () => {
      expect(await getActiveWorkout()).toMatchObject({
        programScheduleEntryId: entry.id,
      });
    });
  });

  it('ignore un double appui pendant le démarrage depuis le détail', async () => {
    const { program } = await createTrackingProgram();
    let release!: (
      value: Awaited<ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>>,
    ) => void;
    const pending = new Promise<
      Awaited<ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>>
    >((resolve) => {
      release = resolve;
    });
    const start = vi
      .spyOn(programWorkoutRepository, 'startWorkoutFromProgram')
      .mockReturnValue(pending);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);
    const action = await screen.findByRole('button', { name: 'Démarrer Poussée du jour' });

    await user.dblClick(action);

    expect(start).toHaveBeenCalledTimes(1);
    expect(action).toBeDisabled();
    release({
      workout: {} as Awaited<
        ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>
      >['workout'],
    });
  });

  it('propose d’abord la première séance ordonnée lorsque deux séances tombent aujourd’hui', async () => {
    const { program, entries, routines } = await createTrackingProgram();
    const todayEntries = [entries[2]!, entries[3]!];
    const later =
      todayEntries[0]!.id.localeCompare(todayEntries[1]!.id) < 0
        ? todayEntries[0]!
        : todayEntries[1]!;
    const first = later.id === todayEntries[0]!.id ? todayEntries[1]! : todayEntries[0]!;
    await db.programScheduleEntries.update(later.id, { dayOfWeek: 4, order: 1 });
    await db.programScheduleEntries.update(first.id, { dayOfWeek: 4, order: 0 });
    const firstName = first.routineId === routines[2]!.id ? 'Poussée du jour' : 'Tirage à venir';

    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByRole('button', { name: `Démarrer ${firstName}` })).toBeVisible();
  });

  it('neutralise toutes les actions de démarrage lorsqu’une séance est déjà active', async () => {
    const { program } = await createTrackingProgram();
    await startWorkout('', 'Séance libre');
    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByText('Une séance est déjà en cours.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Poussée du jour, Aujourd’hui' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Démarrer Poussée du jour' }),
    ).not.toBeInTheDocument();
  });

  it('confirme un décalage en semaines entières et avertit lorsque le bloc a commencé', async () => {
    const { program } = await createTrackingProgram();
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    await user.click(await screen.findByRole('button', { name: 'Options du bloc' }));
    await user.click(screen.getByRole('button', { name: /^Décaler le bloc/ }));
    expect(
      screen.getByText('Le bloc a déjà commencé. Les séances passées ne bougeront pas.'),
    ).toBeVisible();
    const weeks = screen.getByRole('spinbutton', { name: 'Nombre de semaines' });
    await user.clear(weeks);
    await user.type(weeks, '2.5');
    expect(screen.getByRole('button', { name: 'Confirmer le décalage' })).toBeDisabled();
    await user.clear(weeks);
    await user.type(weeks, '1');
    await user.click(screen.getByRole('button', { name: 'Confirmer le décalage' }));

    await waitFor(async () => {
      expect((await getProgramDetail(program.id))?.program.startsAt).toBe(
        new Date(2026, 7, 10, 0).getTime(),
      );
    });
  });

  it('termine le bloc après confirmation sans supprimer ses semaines ni son split', async () => {
    const { program } = await createTrackingProgram();
    const before = await getProgramDetail(program.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    await user.click(await screen.findByRole('button', { name: 'Options du bloc' }));
    await user.click(screen.getByRole('button', { name: /^Terminer le bloc/ }));
    expect(
      screen.getByText('Les semaines, le split et les séances restent dans ton historique.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Terminer le bloc' }));

    await waitFor(async () => {
      const after = await getProgramDetail(program.id);
      expect(after?.program.status).toBe('completed');
      expect(after?.weeks).toEqual(before?.weeks);
      expect(after?.revisions).toEqual(before?.revisions);
    });
    expect(await screen.findByText('Terminé')).toBeVisible();
    // Le menu reste, mais il ne propose plus qu'une chose : un bloc terminé ne
    // se modifie ni ne se décale, il se supprime.
    await user.click(screen.getByRole('button', { name: 'Options du bloc' }));
    expect(await screen.findByRole('button', { name: /Supprimer le bloc/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Modifier à partir de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Décaler le bloc/ })).not.toBeInTheDocument();
  });

  it('isole une routine manquante à sa ligne et garde les autres séances disponibles', async () => {
    const { program, routines } = await createTrackingProgram();
    await db.routines.update(routines[1]!.id, { deletedAt: TRACKING_NOW, updatedAt: TRACKING_NOW });
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByText('Routine indisponible')).toBeVisible();
    expect(screen.getByText('Cette séance doit être réparée dans le split.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Poussée du jour, Aujourd’hui' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Réparer le split' }));
    await expectRoute(`/programs/${program.id}/edit`);
  });
});

describe('liste des blocs', () => {
  beforeEach(resetDb);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ouvre un bloc qui n’a pas encore commencé, et le supprime depuis sa fiche', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(TRACKING_NOW);
    const routine = await createRoutine('Force à venir');
    const program = await createProgramDraft({
      name: 'Fin d’été',
      startsAt: new Date(2026, 7, 17).getTime(),
      durationWeeks: 6,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 6 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderProgramFlow('/programs');

    // Rien à démarrer avant le 17, rien à réparer : la carte du héros n'a aucun
    // bouton, et la liste ne le remet pas en rangée puisqu'il est déjà en tête.
    // Sans porte sur l'en-tête, le bloc n'était atteignable par rien — donc ni
    // modifiable, ni décalable, ni supprimable.
    expect(
      await screen.findByText('Le bloc commence le 17 août. Aucune séance ne démarre avant.'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Démarrer/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ouvrir le bloc Fin d’été' }));
    await expectRoute(`/programs/${program.id}`);

    // La semaine se lit en entier, repos compris, avant même le départ : c'est
    // le seul moment où le split peut encore être corrigé sans rien perdre.
    expect(await screen.findByText('La semaine')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Force à venir, À venir' })).toBeVisible();
    expect(screen.getByText('Lundi')).toBeVisible();
    expect(screen.getAllByText('Repos')).toHaveLength(6);
    for (const day of ['Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']) {
      expect(screen.getByText(day)).toBeVisible();
    }

    await user.click(await screen.findByRole('button', { name: 'Options du bloc' }));
    await user.click(await screen.findByRole('button', { name: /^Supprimer le bloc/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Supprimer le bloc' })).getByRole('button', {
        name: 'Supprimer le bloc',
      }),
    );

    await waitFor(async () => {
      expect(await listPrograms()).toHaveLength(0);
    });
  });

  it('affiche les statuts brouillon, actif et terminé sans transformer la liste en tableau de bord', async () => {
    const completed = await createProgramDraft({
      name: 'Bloc terminé',
      startsAt: TRACKING_START,
      durationWeeks: 4,
    });
    const routine = await createRoutine('Routine statut');
    for (const program of [completed]) {
      await replaceProgramWeeks(
        program.id,
        Array.from({ length: 4 }, (_, weekIndex) => ({
          weekIndex,
          loadIndex: 100,
          phase: 'construction' as const,
        })),
      );
      await createScheduleRevision(program.id, 0, [
        { routineId: routine.id, dayOfWeek: 1, order: 0 },
      ]);
    }
    await activateProgram(completed.id);
    await programsRepository.completeProgram(completed.id);
    const active = await createProgramDraft({
      name: 'Bloc actif',
      startsAt: TRACKING_START,
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      active.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    await createScheduleRevision(active.id, 0, [{ routineId: routine.id, dayOfWeek: 1, order: 0 }]);
    await activateProgram(active.id);
    await createProgramDraft({
      name: 'Bloc brouillon',
      startsAt: TRACKING_START,
      durationWeeks: 8,
    });

    renderProgramFlow('/programs');

    // Le bloc actif est le héros : il se nomme et dit sa semaine, sans étiquette
    // de statut — il est le seul à porter un bouton. Les autres restent des
    // rangées, avec la leur.
    expect(await screen.findByText('Bloc actif')).toBeVisible();
    expect(screen.getByText(/^Semaine \d+ sur 4$/)).toBeVisible();
    expect(screen.queryByText('Actif')).not.toBeInTheDocument();
    // Aucune séance en cours : le bouton doit être vivant. `getActiveWorkout`
    // renvoie `undefined`, et le comparer à `null` le grisait pour toujours.
    expect(screen.getByRole('button', { name: /^Démarrer/ })).toBeEnabled();

    expect(screen.getByText('Bloc brouillon')).toBeVisible();
    expect(screen.getByText('Brouillon')).toBeVisible();
    expect(screen.getByText('Bloc terminé')).toBeVisible();
    expect(screen.getByText('Terminé')).toBeVisible();
  });

  it('signale la séance à réparer quand sa routine a quitté la bibliothèque', async () => {
    const { program, routine } = await createEditableActiveProgram();
    // Permis depuis que le bloc ne gouverne plus la bibliothèque : supprimer
    // une routine ne demande pas la permission au bloc, et c'est cet écran-ci
    // qui porte la réparation.
    await routinesRepository.deleteRoutine(routine.id);
    renderProgramFlow(`/programs/${program.id}`);

    expect(await screen.findByText('Routine indisponible')).toBeVisible();
    expect(screen.getByText('Cette séance doit être réparée dans le split.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Réparer le split' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Démarrer/ })).not.toBeInTheDocument();
  });

  it('replie les semaines identiques et n’y répète pas la semaine en cours', async () => {
    const routine = await createRoutine('Full-body');
    const program = await createProgramDraft({
      name: 'Bloc plat',
      startsAt: mondayWeeksAgo(0),
      durationWeeks: 8,
    });
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 8 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    await activateProgram(program.id);
    renderProgramFlow(`/programs/${program.id}`);

    // Une seule ligne pour sept semaines qui ne changent pas, et elle démarre
    // à la 02 : la 01 est déjà écrite en grand sous « Intention de la semaine ».
    expect(await screen.findByText('02–08 — 100 % · Construction')).toBeVisible();
    // La 01 ne se lit qu'une fois, sous « Intention de la semaine » — et jamais
    // en tête de la liste de ce qui reste.
    expect(screen.getAllByText('01 — 100 % · Construction')).toHaveLength(1);
    expect(screen.queryByText('02 — 100 % · Construction')).not.toBeInTheDocument();
  });
});
