import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, MuscleGroup } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { seedWorkout } from '@/test/factories';
import { HomeMuscleMap } from './HomeMuscleMap';

function exercise(id: string, name: string, primaryMuscle: MuscleGroup): Exercise {
  return {
    ...newEntity<Exercise>({
      name,
      primaryMuscle,
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    }),
    id,
  };
}

/** Dans la fenêtre de douze semaines que le dessin lit, quel que soit le jour. */
const RECENT = Date.now() - 3 * 86_400_000;

function renderMap() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomeMuscleMap onResolved={() => {}} />
    </MemoryRouter>,
  );
}

/** Le path du muscle, une fois le dessin arrivé. */
async function muscle(container: HTMLElement, id: string): Promise<Element> {
  return await waitFor(() => {
    const path = container.querySelector(`path[data-muscle="${id}"]`);
    if (path === null) throw new Error(`aucun path pour ${id}`);
    return path;
  });
}

beforeEach(async () => {
  await resetDb();
  await db.exercises.bulkAdd([
    exercise('bench', 'Développé couché', 'chest'),
    exercise('fly', 'Écarté à la poulie', 'chest'),
    exercise('squat', 'Squat', 'quads'),
  ]);
  await seedWorkout({ exerciseId: 'bench', performedAt: RECENT, sets: [[80, 8]] });
});

describe('HomeMuscleMap', () => {
  it('ouvre les exercices du muscle touché', async () => {
    const { container } = renderMap();

    fireEvent.click(await muscle(container, 'pectoralis_major'));

    expect(await screen.findByText('Pectoraux')).toBeInTheDocument();
    expect(await screen.findByText('Écarté à la poulie')).toBeInTheDocument();
  });

  it('répond aussi pour un muscle que rien n’a travaillé', async () => {
    // Le dessin sert d'abord à voir les trous : un muscle éteint est justement
    // celui qu'on touche pour trouver quoi lui donner.
    const { container } = renderMap();

    fireEvent.click(await muscle(container, 'quadriceps'));

    expect(await screen.findByText('Quadriceps')).toBeInTheDocument();
    expect(await screen.findByText('Squat')).toBeInTheDocument();
  });
});
