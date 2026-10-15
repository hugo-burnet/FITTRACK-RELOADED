import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { setCoachVolumeBounds } from '@/data/repositories/settings';
import { resetDb } from '@/test/resetDb';
import { seedMuscleWeeks } from '@/test/volumeHistory';
import { HomeVolumeCard } from './HomeVolumeCard';

function renderCard() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<HomeVolumeCard />} />
        <Route path="/settings/volume" element={<p>bornes de volume</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Une séance de dos par semaine : les deux semaines comptent comme travaillées. */
const train = () => seedMuscleWeeks('lats', [6, 6, 6, 6, 6, 6]);

describe('HomeVolumeCard', () => {
  beforeEach(resetDb);

  it('ne rend rien tant que la personne n’a posé aucun plancher, même à deux séries par semaine', async () => {
    await train();
    await seedMuscleWeeks('hamstrings', [0, 0, 0, 0, 2, 2]);
    const { container } = renderCard();

    // Le temps que la requête réponde : une carte qui n'existe pas ne s'annonce pas.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(container).toBeEmptyDOMElement();
  });

  it('nomme le muscle, ses deux semaines et le plancher posé', async () => {
    await train();
    await seedMuscleWeeks('hamstrings', [0, 0, 0, 0, 3, 4]);
    await setCoachVolumeBounds('hamstrings', { floor: 8 });
    renderCard();

    expect(await screen.findByRole('heading', { name: 'Volume bas' })).toBeInTheDocument();
    expect(screen.getByText('Ischio-jambiers : 3 puis 4 séries — ton plancher est 8.')).toBeInTheDocument();
  });

  it('mène aux bornes par « Régler »', async () => {
    const user = userEvent.setup();
    await train();
    await setCoachVolumeBounds('hamstrings', { floor: 8 });
    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Régler' }));

    expect(await screen.findByText('bornes de volume')).toBeInTheDocument();
  });

  it('se tait quand le plancher est tenu', async () => {
    await train();
    await seedMuscleWeeks('hamstrings', [0, 0, 0, 0, 6, 8]);
    await setCoachVolumeBounds('hamstrings', { floor: 8 });
    const { container } = renderCard();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(container).toBeEmptyDOMElement();
  });

  it('se tait pendant des vacances : une semaine sans séance n’est pas un volume bas', async () => {
    await seedMuscleWeeks('lats', [6, 6, 6, 6, 0, 0]);
    await seedMuscleWeeks('hamstrings', [8, 8, 8, 8, 0, 0]);
    await setCoachVolumeBounds('hamstrings', { floor: 8 });
    const { container } = renderCard();

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(container).toBeEmptyDOMElement();
  });

  it('s’arrête à quatre lignes et dit combien d’autres il y a', async () => {
    await train();
    for (const muscle of ['chest', 'quads', 'calves', 'biceps', 'triceps', 'glutes'] as const) {
      await setCoachVolumeBounds(muscle, { floor: 9 });
    }
    renderCard();

    expect(await screen.findByText('Et 2 de plus.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
