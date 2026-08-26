import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentationExercise } from '@/features/knowledge/exerciseDocumentation';
import { ExerciseDocumentationView } from './ExerciseDocumentationView';

// La vue ne doit jamais retomber sur la recherche globale pour combler un trou :
// c'est exactement la seam que la mesure du 2026-08-26 a fait retirer.
vi.mock('@/features/knowledge/searchEvidence', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchEvidence: vi.fn(() => {
    throw new Error('la vue Documentation ne doit pas chercher');
  }),
}));

function renderView(exercise: DocumentationExercise) {
  render(
    <MemoryRouter>
      <ExerciseDocumentationView exercise={exercise} />
    </MemoryRouter>,
  );
}

const pushdown: DocumentationExercise = {
  primaryMuscle: 'triceps',
  secondaryMuscles: ['shoulders'],
  movementPattern: 'isolation_coude',
  slug: 'cable-triceps-pushdown-rope',
};

describe('ExerciseDocumentationView', () => {
  it('montre le muscle principal, le mouvement et l’article propre à l’exercice', () => {
    renderView(pushdown);

    expect(screen.getByRole('heading', { name: 'Triceps' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Isolation du coude' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Extensions du triceps' })).toBeVisible();
  });

  it('annonce l’absence de relation sur un exercice personnel sans famille', () => {
    renderView({ primaryMuscle: 'triceps', secondaryMuscles: ['shoulders'] });

    expect(screen.getByText(/Aucune relation de mouvement n’est déclarée/u)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Isolation du coude' })).toBeNull();
    // Les muscles restent documentés : c'est la relation qui manque, pas la fiche.
    expect(screen.getByRole('heading', { name: 'Triceps' })).toBeVisible();
  });

  it('n’explique un muscle secondaire que si le corpus a balisé son rôle', () => {
    renderView({
      primaryMuscle: 'biceps',
      secondaryMuscles: ['calves'],
      movementPattern: 'isolation_coude',
    });

    expect(screen.getByText(/Le corpus ne documente pas le rôle de ce muscle/u)).toBeVisible();
  });

});
