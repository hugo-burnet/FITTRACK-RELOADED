import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Milestone } from '@/data/types';
import { newEntity } from '@/data/repositories/base';
import { retrospectiveKey } from '@/lib/milestones/retrospective';
import { resetDb } from '@/test/resetDb';
import { HomeMilestoneCard } from './HomeMilestoneCard';

const DAY = 86_400_000;

/**
 * Il y a N années, moins deux jours.
 *
 * Les deux jours ne sont pas une approximation : ils placent l'anniversaire au
 * milieu de sa fenêtre d'une semaine plutôt qu'à son bord. Compté en
 * millisecondes — `now - 365 jours` — le test aurait échoué une année sur
 * quatre, et un 29 février il aurait échoué tout court.
 */
function yearsAgo(years: number): number {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.getTime() - 2 * DAY;
}

async function seedMilestone(input: {
  definitionId: string;
  value: number;
  achievedAt: number;
  acknowledgedAt: number;
}): Promise<Milestone> {
  const row = newEntity<Milestone>({ workoutId: 'w-1', ...input });
  await db.milestones.add(row);
  return row;
}

/**
 * Laisse les `useLiveQuery` se poser.
 *
 * Nécessaire pour les cas où l'on affirme qu'il **ne** s'affiche rien : sans
 * attente, le test passerait sur la première frame, avant même que la lecture
 * ait eu lieu, et ne prouverait donc rien.
 */
async function settle(): Promise<void> {
  await db.milestones.count();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(resetDb);

describe('la carte des paliers sur l’accueil', () => {
  it('ne rend rien quand il n’y a rien à dire — son état le plus fréquent', async () => {
    const { container } = render(<HomeMilestoneCard />);
    await settle();

    // Rien du tout, pas même un cadre vide : l'accueil ne garde pas une place
    // pour une carte qui n'apparaît que quelques jours par an.
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce un palier qui vient de tomber', async () => {
    await seedMilestone({
      definitionId: 'bench-100',
      value: 102.5,
      achievedAt: Date.now(),
      acknowledgedAt: 0,
    });
    render(<HomeMilestoneCard />);

    expect(await screen.findByText('Palier franchi')).toBeInTheDocument();
    expect(screen.getByText('Développé couché à 100 kg')).toBeInTheDocument();
    expect(screen.getByText('Franchi à 102,5 kg')).toBeInTheDocument();
  });

  it('ne se ferme qu’au doigt, jamais toute seule', async () => {
    const row = await seedMilestone({
      definitionId: 'bench-100',
      value: 100,
      achievedAt: Date.now(),
      acknowledgedAt: 0,
    });
    render(<HomeMilestoneCard />);

    await screen.findByText('Palier franchi');
    // Acquitter au montage aurait fait disparaître la carte pendant que l'écran
    // finit de charger : un palier franchi une fois dans une vie ne se rate pas
    // à cause d'un rendu.
    expect((await db.milestones.get(row.id))?.acknowledgedAt).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    await settle();
    expect((await db.milestones.get(row.id))?.acknowledgedAt).not.toBe(0);
  });

  it('montre l’anniversaire d’un ancien palier', async () => {
    await seedMilestone({
      definitionId: 'pullup-1',
      value: 1,
      achievedAt: yearsAgo(1),
      acknowledgedAt: yearsAgo(1),
    });
    render(<HomeMilestoneCard />);

    expect(await screen.findByText('Il y a un an')).toBeInTheDocument();
    expect(screen.getByText('Ta première traction pronation')).toBeInTheDocument();
    expect(
      screen.getByText('Tu franchissais ce palier. Il est toujours à toi.'),
    ).toBeInTheDocument();
  });

  it('ne montre jamais deux cartes à la fois', async () => {
    await seedMilestone({
      definitionId: 'pullup-1',
      value: 1,
      achievedAt: yearsAgo(1),
      acknowledgedAt: yearsAgo(1),
    });
    await seedMilestone({
      definitionId: 'bench-100',
      value: 100,
      achievedAt: Date.now(),
      acknowledgedAt: 0,
    });
    render(<HomeMilestoneCard />);

    // Le neuf passe devant : il est arrivé aujourd'hui. Deux cartes de
    // félicitations le même matin, c'est zéro carte lue.
    expect(await screen.findByText('Palier franchi')).toBeInTheDocument();
    expect(screen.queryByText('Il y a un an')).not.toBeInTheDocument();
  });

  it('oublie un anniversaire déjà fermé', async () => {
    await seedMilestone({
      definitionId: 'pullup-1',
      value: 1,
      achievedAt: yearsAgo(1),
      acknowledgedAt: yearsAgo(1),
    });
    await db.settings.put({
      key: 'milestoneRetrospectivesSeen',
      value: [retrospectiveKey('pullup-1', 1)],
      updatedAt: Date.now(),
    });

    const { container } = render(<HomeMilestoneCard />);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('saute un palier retiré du catalogue plutôt que d’afficher son identifiant', async () => {
    await seedMilestone({
      definitionId: 'palier-supprime',
      value: 1,
      achievedAt: Date.now(),
      acknowledgedAt: 0,
    });

    const { container } = render(<HomeMilestoneCard />);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Le cas qui a motivé la correction.
   *
   * Retirer un seuil du catalogue est une opération prévue — le commentaire de
   * `MilestoneDefinition.id` la décrit. La ligne qu'il laisse en base reste non
   * acquittée, parce que plus aucune carte ne peut l'afficher et donc plus
   * aucun doigt ne peut la fermer. Elle comptait pourtant comme « un palier à
   * célébrer », et coupait l'anniversaire d'un autre palier avant même qu'il
   * soit cherché. Un seuil retiré n'a aucune raison de faire taire dix ans de
   * pratique.
   */
  it('laisse passer un anniversaire malgré un palier retiré resté non acquitté', async () => {
    await seedMilestone({
      definitionId: 'palier-supprime',
      value: 1,
      achievedAt: Date.now(),
      acknowledgedAt: 0,
    });
    await seedMilestone({
      definitionId: 'pullup-1',
      value: 1,
      achievedAt: yearsAgo(1),
      acknowledgedAt: yearsAgo(1),
    });

    render(<HomeMilestoneCard />);

    expect(await screen.findByText('Il y a un an')).toBeInTheDocument();
  });
});
