import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Program } from '@/data/types';
import type { ProgramAdherence, ProgramPosition } from '@/lib/programs';
import { ProgramProgressTiles } from './ProgramProgressTiles';

const program = (status: Program['status']): Program =>
  ({
    id: 'p',
    name: 'Bloc',
    status,
    startsAt: new Date(2026, 9, 5).getTime(),
    durationWeeks: 6,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
  }) as Program;

const adherence: ProgramAdherence = {
  doneToDate: 12,
  plannedToDate: 14,
  doneTotal: 12,
  plannedTotal: 24,
};

const renderTiles = (status: Program['status'], position: ProgramPosition) =>
  render(
    <ProgramProgressTiles
      program={program(status)}
      position={position}
      week={null}
      nextWeek={undefined}
      adherence={adherence}
      weeklyTonnage={[0, 0, 0, 0, 0, 0]}
      displayWeekIndex={2}
      hasWorkouts={false}
    />,
  );

const adherenceTile = (container: HTMLElement): HTMLElement => {
  const found = [...container.querySelectorAll<HTMLElement>('[data-part="tile"]')].find((tile) =>
    tile.textContent?.includes('Assiduité'),
  );
  if (found === undefined) throw new Error('aucune tuile Assiduité');
  return found;
};

describe('ProgramProgressTiles — assiduité', () => {
  it('« 12 / 24 » fait sept signes : la tuile est large, pas petite', () => {
    const { container } = renderTiles('active', { phase: 'active', weekIndex: 2, dayOfWeek: 3 });

    expect(adherenceTile(container)).toHaveAttribute('data-size', 'L');
  });

  it('en cours, dit les deux mesures : à ce jour et sur le programme', () => {
    const { container } = renderTiles('active', { phase: 'active', weekIndex: 2, dayOfWeek: 3 });

    const text = adherenceTile(container).textContent ?? '';
    expect(text).toContain('12 / 14');
    expect(text).toContain('12 sur 24 sur tout le programme');
  });

  it('un programme clos avant terme ne montre que « à ce jour » : les semaines non jouées n’étaient plus dues', () => {
    const { container } = renderTiles('completed', { phase: 'active', weekIndex: 2, dayOfWeek: 3 });

    const text = adherenceTile(container).textContent ?? '';
    expect(text).toContain('12 / 14');
    expect(text).not.toContain('24');
  });
});
