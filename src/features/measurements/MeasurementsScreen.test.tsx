import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { BodyMeasurement } from '@/data/types';
import { dayInputValue } from '@/lib/bodyMeasurements';
import { resetDb } from '@/test/resetDb';
import { MeasurementsScreen } from './MeasurementsScreen';

/** Midi, `days` jours avant aujourd'hui, en jour local. */
const daysAgo = (days: number, hour = 12): number => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

const reading = (type: string, value: number, measuredAt: number, unit = 'cm'): BodyMeasurement =>
  newEntity<BodyMeasurement>({ type, value, unit, measuredAt });

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/analytics/measurements']}>
      <Routes>
        <Route path="/analytics/measurements" element={<MeasurementsScreen />} />
        <Route path="/analytics/measurements/:type" element={<p>fiche</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** « Ajouter une mesure » › la mesure choisie › la feuille de saisie, ouverte. */
async function openSheetFor(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: 'Ajouter une mesure' }));
  await user.click(await screen.findByRole('radio', { name: label }));
  return screen.findByRole('dialog', { name: 'Nouvelle mesure' });
}

describe('MeasurementsScreen', () => {
  beforeEach(resetDb);

  it('dit comment commencer tant que rien n’est mesuré', async () => {
    renderScreen();

    expect(await screen.findByText(/Aucune mesure pour l’instant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter une mesure' })).toBeInTheDocument();
    expect(screen.queryByText('Suivies')).not.toBeInTheDocument();
  });

  it('liste les mesures suivies : la dernière valeur, sa date, l’écart avec la précédente', async () => {
    await db.bodyMeasurements.bulkAdd([
      reading('waist', 84, daysAgo(30)),
      reading('waist', 82.5, daysAgo(2)),
      reading('body_weight', 80, daysAgo(1), 'kg'),
      reading('custom:Poignet', 17, daysAgo(5)),
    ]);
    renderScreen();

    expect(await screen.findByText('Suivies')).toBeInTheDocument();
    const rows = screen.getAllByRole('button').filter((button) => button.dataset.part === 'row');
    expect(rows.map((row) => row.querySelector('span > span')?.textContent)).toEqual([
      'Poids de corps',
      'Tour de taille',
      'Poignet',
    ]);
    expect(screen.getByText('80 kg')).toBeInTheDocument();
    expect(screen.getByText('82,5 cm')).toBeInTheDocument();
    expect(screen.getByText('17 cm')).toBeInTheDocument();
    // Deux mesures de taille : l'écart se lit sous le nom. Une seule de poignet : la date seule.
    expect(screen.getByText(/· −1,5 cm$/)).toBeInTheDocument();
    expect(within(rows[2]!).queryByText(/·/)).not.toBeInTheDocument();
  });

  it('ouvre la fiche d’une mesure, son type encodé dans l’adresse', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('waist', 82, daysAgo(1)));
    renderScreen();

    await user.click(await screen.findByText('Tour de taille'));

    expect(await screen.findByText('fiche')).toBeInTheDocument();
  });

  it('encode le nom d’un champ libre dans l’adresse : une barre oblique n’y coupe pas le chemin', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('custom:Bras G/D', 38, daysAgo(1)));
    renderScreen();

    await user.click(await screen.findByText('Bras G/D'));

    expect(await screen.findByText('fiche')).toBeInTheDocument();
  });

  it('ajoute une mesure du catalogue : choisir, saisir, enregistrer', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');

    // Le nom de la mesure est rappelé, son unité gravée dans le champ.
    expect(within(sheet).getByText('Tour de taille')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    await user.type(within(sheet).getByLabelText('Valeur'), '84,5');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () =>
      expect(await db.bodyMeasurements.toArray()).toMatchObject([
        { type: 'waist', value: 84.5, unit: 'cm', deletedAt: 0 },
      ]),
    );
    // La feuille se ferme, et la valeur apparaît dans la liste derrière.
    expect(await screen.findByText('84,5 cm')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nouvelle mesure' })).not.toBeInTheDocument(),
    );
  });

  it('range le poids de corps en kilogrammes et rappelle à quoi il sert', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Poids de corps');

    expect(within(sheet).getByText(/tonnage des exercices au poids du corps/)).toBeInTheDocument();
    await user.type(within(sheet).getByLabelText('Valeur'), '82,4');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () =>
      expect(await db.bodyMeasurements.toArray()).toMatchObject([
        { type: 'body_weight', value: 82.4, unit: 'kg' },
      ]),
    );
  });

  it('enregistre à une date passée : le début de ce jour local', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');
    const past = daysAgo(10);

    await user.type(within(sheet).getByLabelText('Valeur'), '86');
    fireEvent.change(within(sheet).getByLabelText('Date'), {
      target: { value: dayInputValue(past) },
    });
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    const startOfDay = new Date(past);
    startOfDay.setHours(0, 0, 0, 0);
    await waitFor(async () =>
      expect(await db.bodyMeasurements.toArray()).toMatchObject([
        { type: 'waist', value: 86, measuredAt: startOfDay.getTime() },
      ]),
    );
  });

  it('annonce, avant d’enregistrer, qu’une mesure du même jour sera remplacée', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('waist', 84, daysAgo(0, 8)));
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');

    expect(
      await within(sheet).findByText('Une mesure existe déjà ce jour-là (84 cm) : elle sera remplacée.'),
    ).toBeInTheDocument();

    await user.type(within(sheet).getByLabelText('Valeur'), '83');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => {
      const rows = await db.bodyMeasurements.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ value: 83 });
    });
  });

  it('montre la mesure d’avant en gris dans le champ, sans la mettre dedans', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('waist', 84.5, daysAgo(7)));
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');

    const field = within(sheet).getByLabelText('Valeur');
    expect(field).toHaveValue('');
    expect(field).toHaveAttribute('placeholder', '84,5');
  });

  it('refuse une valeur qui ne peut pas être juste, avec la raison', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');

    await user.type(within(sheet).getByLabelText('Valeur'), '825');

    expect(within(sheet).getByText(/ne semble pas juste/)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('refuse demain, avec la raison', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await user.type(within(sheet).getByLabelText('Valeur'), '84');
    fireEvent.change(within(sheet).getByLabelText('Date'), {
      target: { value: dayInputValue(tomorrow.getTime()) },
    });

    expect(within(sheet).getByText('Choisis un jour qui n’est pas dans le futur.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('ajoute un champ libre : un nom, une unité, une valeur', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Autre mesure…');

    // Rien à enregistrer tant que le champ n'a pas de nom.
    await user.type(within(sheet).getByLabelText('Valeur'), '3,2');
    expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

    await user.type(within(sheet).getByLabelText('Nom de la mesure'), '  Tour de   poignet ');
    await user.click(within(sheet).getByRole('button', { name: 'kg' }));
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () =>
      expect(await db.bodyMeasurements.toArray()).toMatchObject([
        { type: 'custom:Tour de poignet', value: 3.2, unit: 'kg' },
      ]),
    );
    expect(await screen.findByText('Tour de poignet')).toBeInTheDocument();
  });

  it('propose les champs libres déjà suivis à côté du catalogue, avec leur unité', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('custom:Lest', 12, daysAgo(3), 'kg'));
    renderScreen();

    const sheet = await openSheetFor(user, 'Lest');

    // L'unité de la série est reprise : on ne rouvre pas le choix et la courbe ne mélange rien.
    expect(within(sheet).queryByRole('button', { name: 'cm' })).not.toBeInTheDocument();
    expect(within(sheet).getByText('kg')).toBeInTheDocument();
  });

  it('reprend l’unité d’une série déjà suivie quand on retape son nom', async () => {
    const user = userEvent.setup();
    await db.bodyMeasurements.add(reading('custom:Lest', 12, daysAgo(3), 'kg'));
    renderScreen();
    const sheet = await openSheetFor(user, 'Autre mesure…');

    await user.type(within(sheet).getByLabelText('Nom de la mesure'), 'Lest');
    await user.type(within(sheet).getByLabelText('Valeur'), '14');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () =>
      expect(await db.bodyMeasurements.count()).toBe(2),
    );
    const stored = await db.bodyMeasurements.toArray();
    expect(stored.every((row) => row.type === 'custom:Lest' && row.unit === 'kg')).toBe(true);
  });

  it('garde la feuille ouverte et la valeur tapée quand l’écriture échoue', async () => {
    const user = userEvent.setup();
    renderScreen();
    const sheet = await openSheetFor(user, 'Tour de taille');
    // Un nom de type impossible à écrire : la table refuse tout.
    const originalAdd = db.bodyMeasurements.add.bind(db.bodyMeasurements);
    db.bodyMeasurements.add = (() => Promise.reject(new Error('disk full'))) as never;

    try {
      await user.type(within(sheet).getByLabelText('Valeur'), '84');
      await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

      expect(await within(sheet).findByRole('alert')).toHaveTextContent(
        'La mesure n’a pas pu être enregistrée. Réessaie.',
      );
      expect(within(sheet).getByLabelText('Valeur')).toHaveValue('84');
      expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
    } finally {
      db.bodyMeasurements.add = originalAdd;
    }
  });
});
