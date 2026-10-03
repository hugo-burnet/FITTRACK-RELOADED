import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Milestone } from '@/data/types';
import { t } from '@/i18n/fr';
import { resetDb } from '@/test/resetDb';
import { MilestonesScreen } from './MilestonesScreen';

async function seedMilestone(overrides: Partial<Milestone> & { definitionId: string }) {
  await db.milestones.add(
    newEntity<Milestone>({
      achievedAt: Date.UTC(2026, 9, 3, 12),
      workoutId: '',
      value: 1,
      acknowledgedAt: 1,
      ...overrides,
    }),
  );
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <MilestonesScreen />
    </MemoryRouter>,
  );
}

describe('l’écran des paliers — les secrets', () => {
  beforeEach(resetDb);

  it('range noclip sous « Secrets », avec son titre, son jeton et sa date', async () => {
    await seedMilestone({ definitionId: 'noclip' });
    renderScreen();

    const heading = await screen.findByText(t('milestone.group.secret'));
    const section = heading.closest('section');
    expect(section).not.toBeNull();

    const row = within(section as HTMLElement).getByRole('button');
    expect(within(row).getByText('noclip')).toBeInTheDocument();
    expect(within(row).getByText(/3 octobre 2026/)).toBeInTheDocument();
    expect(row.querySelector('img')?.getAttribute('src')).toMatch(/milestones\/noclip\.jpg$/);
  });

  it('ne montre aucun rayon « Secrets » tant qu’aucun secret n’est acquis', async () => {
    await seedMilestone({ definitionId: 'bench-100', value: 100, workoutId: 'w-1' });
    renderScreen();

    await screen.findByText(t('milestone.group.strength'));

    expect(screen.queryByText(t('milestone.group.secret'))).toBeNull();
  });

  it('lit un secret à côté des autres, sans rien changer à leur ordre', async () => {
    await seedMilestone({ definitionId: 'bench-100', value: 100, workoutId: 'w-1' });
    await seedMilestone({ definitionId: 'noclip' });
    renderScreen();

    const titles = (await screen.findAllByRole('heading', { level: 2 })).map(
      (node) => node.textContent,
    );
    const strength = titles.indexOf(t('milestone.group.strength'));
    const secret = titles.indexOf(t('milestone.group.secret'));

    expect(strength).toBeGreaterThanOrEqual(0);
    expect(secret).toBeGreaterThan(strength);
  });

  it('ouvre le jeton en grand avec sa légende', async () => {
    await seedMilestone({ definitionId: 'noclip' });
    renderScreen();

    await userEvent.click(await screen.findByRole('button', { name: /noclip/ }));

    expect(await screen.findByText(t('milestone.art.noclip'))).toBeInTheDocument();
  });
});
