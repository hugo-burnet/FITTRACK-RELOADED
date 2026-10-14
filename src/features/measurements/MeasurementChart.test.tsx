import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MeasurementReading } from '@/data/repositories/measurements';
import { MeasurementChart } from './MeasurementChart';

const DAY = 86_400_000;

const series = (count: number): MeasurementReading[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    type: 'body_weight',
    value: 80 + (index % 5) * 0.3,
    unit: 'kg',
    measuredAt: Date.UTC(2026, 0, 1) + index * DAY,
  }));

const renderChart = (points: MeasurementReading[], selectedIndex = 0) =>
  render(
    <MeasurementChart
      points={points}
      selectedIndex={selectedIndex}
      onSelect={vi.fn()}
      summary="Poids de corps"
    />,
  );

describe('MeasurementChart', () => {
  it('trace chaque point, et l’anneau du point touché', () => {
    const { container } = renderChart(series(5), 2);

    // Cinq points, plus l'anneau de sélection.
    expect(container.querySelectorAll('circle')).toHaveLength(6);
    expect(container.querySelector('path')).not.toBeNull();
  });

  it('ne trace pas de trait vers nulle part avec une seule mesure', () => {
    const { container } = renderChart(series(1));

    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('ne garde que le point touché quand il y en a trop pour rester lisibles', () => {
    const { container } = renderChart(series(200), 150);

    // Un an de pesées quotidiennes serait une barre épaisse : le trait dit la tendance.
    expect(container.querySelector('path')).not.toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('colore tous les points de la même teinte : aucun n’est « le record »', () => {
    const { container } = renderChart(series(6), 3);

    const fills = new Set(
      [...container.querySelectorAll('circle')]
        .map((circle) => circle.getAttribute('fill'))
        .filter((fill) => fill !== 'none'),
    );
    expect(fills).toEqual(new Set(['var(--accent-data)']));
  });

  it('se décrit à voix haute par la phrase qu’on lui donne', () => {
    const { container } = renderChart(series(3));

    expect(container.querySelector('svg')).toHaveAttribute('aria-label', 'Poids de corps');
    expect(container.querySelector('svg')).toHaveAttribute('role', 'img');
  });
});
