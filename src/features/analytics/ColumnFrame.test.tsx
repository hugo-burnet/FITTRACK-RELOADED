import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeekBucket } from '@/lib/analytics/weeks';
import { WeeklyChart } from './WeeklyChart';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';

/**
 * The two column charts have to draw the same frame — reported from the phone as
 * two screens that do not look like the same app.
 *
 * They had drifted on all three shared marks: baseline, zero stub, selection.
 * Making them share `ColumnFrame` fixes today; this test is what keeps them
 * fixed, because it fails the moment one of them grows a frame of its own.
 */

/** Same shape of data through both charts: three buckets, the middle one empty. */
const COUNTS = [2, 0, 3];
const SELECTED = 2;

const buckets: WeekBucket[] = COUNTS.map((sessions, index) => ({
  weekStart: Date.UTC(2026, 6, 13 + index * 7),
  sessions,
  goal: null,
}));

/**
 * Every mark that is not a data bar: the axis, the stub, the cursor.
 *
 * A bar is recognised by its ink, and both data inks are excluded — the muted
 * one and the full accent. Naming them here rather than the frame's own colours
 * is deliberate: the test has to keep failing when a chart grows a frame mark of
 * a colour nobody has thought of yet, which is exactly the drift it exists to
 * catch.
 */
const DATA_INKS = ['var(--accent-data)', 'var(--accent-ink)'];

const frameOf = (container: HTMLElement) =>
  [...container.querySelectorAll('line, rect')]
    .filter((node) => !DATA_INKS.includes(node.getAttribute('fill') ?? ''))
    .map((node) => node.outerHTML);

// Rendus dans le test et pas dans le corps du `describe` : le nettoyage
// automatique de Testing Library démonte entre deux tests, et un conteneur
// capturé plus haut serait vide dès le deuxième.
const sessionsFrame = () =>
  frameOf(
    render(
      <WeeklyChart
        buckets={buckets}
        ceiling={3}
        selectedIndex={SELECTED}
        onSelect={() => {}}
        summary="s"
      />,
    ).container,
  );

const volumeFrame = () =>
  frameOf(
    render(
      <WeeklyVolumeChart
        values={COUNTS}
        ceiling={3}
        selectedIndex={SELECTED}
        onSelect={() => {}}
        summary="v"
      />,
    ).container,
  );

describe('les deux graphiques en colonnes', () => {
  it('dessinent exactement le même cadre', () => {
    expect(sessionsFrame()).toEqual(volumeFrame());
  });

  it('posent la ligne de base et le moignon de zéro dans le ton de l’axe', () => {
    const frame = sessionsFrame();

    expect(frame.filter((mark) => mark.includes('var(--axis)'))).toHaveLength(2);
    // Ni --border (1,35:1 sur une carte claire) ni --text-2 (plus lourd que la donnée).
    expect(frame.join('')).not.toContain('var(--border)');
  });

  it('marquent la sélection sous la ligne de base, jamais avec l’accent', () => {
    const cursor = volumeFrame().find((mark) => mark.includes('var(--text-1)'));

    expect(cursor).toBeDefined();
    // Sous l'axe (y = 120) : un curseur qui traverse le tracé se lit comme une valeur.
    expect(cursor).toContain('y="122"');
    // L'accent dit « objectif atteint » sur le graphique des séances : une encre,
    // un sens.
    expect(cursor).not.toContain('accent');
  });

  it('marquent une semaine vide, qui reste sélectionnable', () => {
    // La semaine du milieu est à zéro : elle a un moignon, pas rien du tout.
    const stubs = sessionsFrame().filter((mark) => mark.includes('height="4"'));

    expect(stubs).toHaveLength(1);
  });
});
