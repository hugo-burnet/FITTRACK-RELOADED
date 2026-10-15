import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import { saveBodyWeight } from '@/data/repositories/bodyMeasurements';
import type { BodyMeasurement, Exercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import { MeasurementDetailScreen } from './MeasurementDetailScreen';

/** Midi, `days` jours avant aujourd'hui, en jour local. */
const daysAgo = (days: number, hour = 12): number => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const reading = (type: string, value: number, measuredAt: number, unit = 'cm'): BodyMeasurement =>
  newEntity<BodyMeasurement>({ type, value, unit, measuredAt });

function renderScreen(path = '/analytics/measurements/waist') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/analytics/measurements/:type" element={<MeasurementDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Les lignes de l'historique, la plus récente d'abord, lues comme « date — valeur ». */
function historyRows(): string[] {
  const section = screen.getByText('Historique').parentElement!;
  return within(section)
    .getAllByRole('button')
    .map((row) => row.textContent ?? '');
}

describe('MeasurementDetailScreen', () => {
  beforeEach(resetDb);

  it('lit la dernière mesure, la courbe et l’écart sur la période', async () => {
    await db.bodyMeasurements.bulkAdd([
      reading('waist', 84, daysAgo(40)),
      reading('waist', 83.2, daysAgo(20)),
      reading('waist', 82.5, daysAgo(1)),
    ]);
    renderScreen();

    // Le titre de l'écran et l'intitulé de la carte disent la même chose : le nom de la mesure.
    expect(await screen.findByRole('heading', { level: 1, name: 'Tour de taille' })).toBeInTheDocument();
    // Le titre vient de l'adresse, avant que les mesures aient répondu : on attend le chiffre.
    expect((await screen.findAllByText('82,5 cm')).length).toBeGreaterThan(0);
    expect(screen.getByText(/−1,5 cm depuis le/)).toBeInTheDocument();
    // La courbe est une image décrite à voix haute : trois mesures, bornes et dernière valeur.
    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/Tour de taille sur 3 mesures/);
    expect(chart).toHaveAccessibleName(/Minimum 82,5 cm, maximum 84 cm, dernière valeur 82,5 cm/);
  });

  it('range l’historique de la plus récente à la plus ancienne, avec l’écart de chaque mesure', async () => {
    await db.bodyMeasurements.bulkAdd([
      reading('waist', 84, daysAgo(40)),
      reading('waist', 83.2, daysAgo(20)),
      reading('waist', 82.5, daysAgo(1)),
    ]);
    renderScreen();
    await screen.findByText('Historique');

    const rows = historyRows();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain(longDate(daysAgo(1)));
    expect(rows[0]).toContain('82,5 cm');
    expect(rows[0]).toContain('−0,7 cm');
    expect(rows[1]).toContain('83,2 cm');
    expect(rows[1]).toContain('−0,8 cm');
    // La première mesure n'a pas de précédente : aucun écart à afficher.
    expect(rows[2]).toContain('84 cm');
    expect(rows[2]).not.toMatch(/[+−]\d/);
  });

  it('dit qu’une courbe demande deux mesures, sans inventer d’échelle ni d’écart', async () => {
    await db.bodyMeasurements.add(reading('waist', 82.5, daysAgo(1)));
    renderScreen();

    expect(
      await screen.findByText(
        'Une seule mesure sur cette période : la courbe commencera à la suivante.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/depuis le/)).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/une seule mesure/);
  });

  it('lit le nom d’un champ libre dans l’adresse, espaces et barre oblique compris', async () => {
    await db.bodyMeasurements.bulkAdd([
      reading('custom:Tour de poignet / gauche', 17, daysAgo(10)),
      reading('custom:Tour de poignet / gauche', 17.5, daysAgo(2)),
    ]);
    renderScreen(
      `/analytics/measurements/${encodeURIComponent('custom:Tour de poignet / gauche')}`,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tour de poignet / gauche' }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('17,5 cm')).length).toBeGreaterThan(0);
  });

  it('dit qu’il n’y a rien pour un type que personne n’a mesuré', async () => {
    renderScreen('/analytics/measurements/neck');

    expect(await screen.findByText('Aucune mesure de ce type pour l’instant.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une mesure' })).toBeInTheDocument();
    expect(screen.queryByText('Historique')).not.toBeInTheDocument();
  });

  it('restreint la période, et propose de tout revoir quand elle est vide', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.bulkAdd([
      reading('waist', 90, daysAgo(400)),
      reading('waist', 88, daysAgo(300)),
    ]);
    renderScreen();
    await screen.findByText('Historique');
    expect(historyRows()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: /Tout/ }));
    await user.click(await screen.findByRole('radio', { name: '4 semaines' }));

    expect(await screen.findByText('Aucune mesure sur cette période.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voir tout l’historique' }));
    expect(await screen.findByText('Historique')).toBeInTheDocument();
    expect(historyRows()).toHaveLength(2);
  });

  it('corrige la valeur d’une mesure à sa date, sans en ajouter une', async () => {
    const user = userEvent.setup();
    const target = reading('waist', 84, daysAgo(20, 8));
    await db.bodyMeasurements.bulkAdd([target, reading('waist', 82.5, daysAgo(1))]);
    renderScreen();
    await screen.findByText('Historique');

    await user.click(within(screen.getByText('Historique').parentElement!).getByText('84 cm'));
    await user.click(await screen.findByRole('button', { name: /Corriger la valeur/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Corriger la mesure' });

    // La valeur de la mesure est déjà dans le champ, sa date n'est plus un champ.
    expect(within(sheet).getByLabelText('Valeur')).toHaveValue('84');
    expect(within(sheet).queryByLabelText('Date')).not.toBeInTheDocument();
    expect(within(sheet).getByText(longDate(target.measuredAt))).toBeInTheDocument();
    expect(within(sheet).queryByText(/sera remplacée/)).not.toBeInTheDocument();

    const field = within(sheet).getByLabelText('Valeur');
    await user.clear(field);
    await user.type(field, '83,5');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => expect((await db.bodyMeasurements.get(target.id))?.value).toBe(83.5));
    expect(await db.bodyMeasurements.count()).toBe(2);
    expect((await db.bodyMeasurements.get(target.id))?.measuredAt).toBe(target.measuredAt);
  });

  it('supprime une mesure après confirmation, et refait la courbe sans elle', async () => {
    const user = userEvent.setup();
    const target = reading('waist', 83.2, daysAgo(20));
    await db.bodyMeasurements.bulkAdd([
      reading('waist', 84, daysAgo(40)),
      target,
      reading('waist', 82.5, daysAgo(1)),
    ]);
    renderScreen();
    await screen.findByText('Historique');

    await user.click(within(screen.getByText('Historique').parentElement!).getByText('83,2 cm'));
    await user.click(await screen.findByRole('button', { name: /Supprimer cette mesure/ }));

    const confirm = await screen.findByRole('dialog', { name: 'Supprimer cette mesure ?' });
    expect(within(confirm).getByText(/Tour de taille du .* : 83,2 cm/)).toBeInTheDocument();
    // Ce n'est pas un poids : aucun record n'est concerné, la phrase ne le prétend pas.
    expect(within(confirm).queryByText(/records/)).not.toBeInTheDocument();
    // Rien n'est supprimé avant la confirmation.
    expect((await db.bodyMeasurements.get(target.id))?.deletedAt).toBe(0);

    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));

    await waitFor(async () =>
      expect((await db.bodyMeasurements.get(target.id))?.deletedAt).toBeGreaterThan(0),
    );
    await waitFor(() => expect(historyRows()).toHaveLength(2));
    expect(screen.getByRole('img')).toHaveAccessibleName(/sur 2 mesures/);
  });

  it('annule la suppression sans rien écrire', async () => {
    const user = userEvent.setup();
    const target = reading('waist', 82.5, daysAgo(1));
    await db.bodyMeasurements.add(target);
    renderScreen();
    await screen.findByText('Historique');

    await user.click(within(screen.getByText('Historique').parentElement!).getByText('82,5 cm'));
    await user.click(await screen.findByRole('button', { name: /Supprimer cette mesure/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Supprimer cette mesure ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }));

    expect((await db.bodyMeasurements.get(target.id))?.deletedAt).toBe(0);
  });

  it('prévient qu’un poids supprimé refait les records, et les refait', async () => {
    const user = userEvent.setup();
    const pullUp = {
      ...newEntity<Exercise>({
        name: 'Traction',
        primaryMuscle: 'lats',
        secondaryMuscles: [],
        equipment: 'bodyweight',
        measurementType: 'reps_only',
        isCustom: 1,
        isUnilateral: 0,
        bodyweightLoadFactor: 1,
      }),
      id: 'pull-up',
    };
    await db.exercises.add(pullUp);
    const workout = await seedWorkout({
      exerciseId: pullUp.id,
      performedAt: daysAgo(3, 18),
      sets: [[0, 5]],
    });
    // Par le dépôt du poids, pour que la projection des records existe : 5 répétitions à 80 kg.
    await saveBodyWeight(80, daysAgo(3, 8));
    const volume = async () =>
      (await db.personalRecords.toArray())
        .filter(
          (record) =>
            record.deletedAt === 0 &&
            record.workoutId === workout.id &&
            record.type === 'max_volume_session',
        )
        .map((record) => record.value);
    expect(await volume()).toEqual([400]);

    renderScreen('/analytics/measurements/body_weight');
    await screen.findByText('Historique');
    await user.click(within(screen.getByText('Historique').parentElement!).getByText('80 kg'));
    await user.click(await screen.findByRole('button', { name: /Supprimer cette mesure/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Supprimer cette mesure ?' });
    expect(
      within(confirm).getByText(/Les records au poids du corps sont recalculés\./),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }));

    await waitFor(async () => expect(await volume()).toEqual([]));
  });

  it('ajoute une mesure du type de la fiche, sans redemander laquelle', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('waist', 82.5, daysAgo(1)));
    renderScreen();
    await screen.findByText('Historique');

    await user.click(screen.getByRole('button', { name: 'Ajouter une mesure' }));
    const sheet = await screen.findByRole('dialog', { name: 'Nouvelle mesure' });
    expect(within(sheet).getByText('Tour de taille')).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText('Valeur'), '82');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(historyRows()).toHaveLength(2));
  });
});
