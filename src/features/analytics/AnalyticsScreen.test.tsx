import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { newEntity } from '@/data/repositories/base';
import { db } from '@/data/db';
import { saveMeasurement } from '@/data/repositories/measurements';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import { rebuildAllRecords } from '@/data/repositories/personalRecords';
import { setWeeklyTrainingGoal } from '@/data/repositories/settings';
import type { Workout } from '@/data/types';
import { startOfLocalWeek } from '@/lib/history';
import { day, seedWorkout } from '@/test/factories';
import { resetDb } from '@/test/resetDb';
import { seedExercise, seedRoutine } from '@/test/routineSeed';
import { AnalyticsScreen } from './AnalyticsScreen';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/analytics']}>
      <AnalyticsScreen />
      <Where />
    </MemoryRouter>,
  );

/** Les nombres français séparent les milliers d'une espace fine : on compare avec des espaces simples. */
const plain = (name: string): string => name.replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ');
const tile = (label: string) =>
  // Neuf lectures vives en parallèle : sous une suite chargée, la seconde par défaut ne suffit pas.
  screen.findByRole(
    'button',
    { name: (name) => plain(name).startsWith(label) },
    { timeout: 5_000 },
  );

async function seedProgram(): Promise<string> {
  const routine = await seedRoutine('Force A', []);
  const program = await createProgramDraft({
    name: 'Hypertrophie · automne',
    startsAt: startOfLocalWeek(Date.now()),
    durationWeeks: 6,
  });
  await replaceProgramWeeks(
    program.id,
    Array.from({ length: 6 }, (_, weekIndex) => ({
      weekIndex,
      loadIndex: 110,
      phase: 'overload' as const,
    })),
  );
  await createScheduleRevision(program.id, 0, [
    { routineId: routine.routine.id, dayOfWeek: 1, order: 0 },
  ]);
  await activateProgram(program.id);
  return program.id;
}

describe('AnalyticsScreen', () => {
  beforeEach(resetDb);

  it('affiche chaque chiffre dans sa tuile, nommée par son libellé puis sa valeur', async () => {
    const bench = await seedExercise({ name: 'Développé couché (barre)' });
    // Une séance cette semaine : 2 × 100 kg × 5 = 1 000 kg.
    await seedWorkout({ exerciseId: bench.id, performedAt: Date.now(), sets: [[100, 5], [100, 5]] });
    // Une plus ancienne, pour que le dernier record ait un écart à dire.
    await seedWorkout({ exerciseId: bench.id, performedAt: day(0), sets: [[90, 5]] });
    await rebuildAllRecords();
    await setWeeklyTrainingGoal(3);
    await saveMeasurement({ type: 'body_weight', value: 84.1, unit: 'kg', measuredAt: day(0) });
    await saveMeasurement({ type: 'body_weight', value: 82.4, unit: 'kg', measuredAt: day(7) });
    await seedProgram();

    renderScreen();

    await tile('Tonnage · 8 semaines 1 000 kg');
    const tonnage = await tile('Tonnage · 8 semaines');
    expect(plain(tonnage.textContent ?? '')).toContain('Moyenne sur 12 semaines');
    await tile('Séances 1 sur 3 cette semaine');
    await tile('Programme en cours Semaine 1 sur 6');
    expect((await tile('Programme en cours')).textContent).toContain('Hypertrophie · automne');
    expect((await tile('Programme en cours')).textContent).toContain('Surcharge, 110 %');
    expect((await tile('Dernier record')).textContent).toContain('Développé couché (barre)');
    // Tous les records de la chronologie, pas ceux d'un mois.
    expect(await tile('Records battus')).toBeVisible();
    expect(await tile('Paliers')).toBeVisible();
    expect(await tile('Sous le plancher 0')).toBeVisible();
    const weight = await tile('Poids de corps 82,4 kg');
    expect(plain(weight.textContent ?? '')).toContain('−1,7 kg depuis la pesée précédente (84,1 kg)');

    // Les trois groupes, puis la ligne du bilan ; la liste des exercices n'est plus ici.
    expect(screen.getByRole('region', { name: 'Cette semaine' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Records' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Corps et muscles' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Rapport mensuel/ })).toBeVisible();
    expect(screen.queryByText('Exercices')).toBeNull();
    expect(screen.queryByRole('button', { name: /Séances par semaine/ })).toBeNull();
  });

  it('mène chaque tuile à l’écran qui détaille son chiffre', async () => {
    const user = userEvent.setup();
    const bench = await seedExercise({ name: 'Développé couché (barre)' });
    await seedWorkout({ exerciseId: bench.id, performedAt: Date.now(), sets: [[100, 5]] });
    await rebuildAllRecords();
    const programId = await seedProgram();

    renderScreen();

    const targets: Array<[string, string]> = [
      ['Tonnage · 8 semaines', '/analytics/volume'],
      ['Séances', '/analytics/weekly'],
      ['Programme en cours', `/programs/${programId}`],
      ['Dernier record', `/exercises/${bench.id}`],
      ['Records battus', '/analytics/records'],
      ['Paliers', '/analytics/milestones'],
      ['Sous le plancher', '/analytics/muscles'],
      ['Poids de corps', '/analytics/measurements'],
      ['Rapport mensuel', '/analytics/months'],
    ];
    for (const [label, path] of targets) {
      await user.click(await tile(label));
      expect(screen.getByTestId('where')).toHaveTextContent(path);
    }
  });

  it('n’offre pas le programme sans programme actif', async () => {
    const bench = await seedExercise({ name: 'Développé couché (barre)' });
    await seedWorkout({ exerciseId: bench.id, performedAt: Date.now(), sets: [[100, 5]] });

    renderScreen();

    await tile('Tonnage · 8 semaines');
    expect(screen.queryByRole('button', { name: /Programme en cours/ })).toBeNull();
  });

  it.each(['empty', 'active-only'] as const)(
    'ne garde que records, paliers et poids quand l’historique est %s',
    async (state) => {
      if (state === 'active-only') {
        await db.workouts.add(
          newEntity<Workout>({
            routineId: '',
            name: 'En cours',
            status: 'active',
            startedAt: Date.UTC(2026, 6, 11),
            endedAt: 0,
            durationSeconds: 0,
          }),
        );
      }

      renderScreen();

      // Pas de dernier record : un tiret, que le nom accessible dit en mots.
      expect(await tile('Dernier record aucune mesure')).toBeVisible();
      expect(await tile('Records battus 0')).toBeVisible();
      expect(await tile('Paliers')).toBeVisible();
      expect(await tile('Poids de corps aucune mesure')).toBeVisible();
      expect(screen.queryByRole('button', { name: /Tonnage/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Séances/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Sous le plancher/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /Rapport mensuel/ })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Cette semaine' })).toBeNull();
    },
  );
});
