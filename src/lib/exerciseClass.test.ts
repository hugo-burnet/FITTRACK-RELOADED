import { describe, expect, it } from 'vitest';
import { MOVEMENT_PATTERNS } from '@/data/types';
import catalogue from '@/data/seed/exercises.json';
import { exerciseClass } from './exerciseClass';

describe('exerciseClass', () => {
  it('lit les familles de poussée, de tirage, de squat, de charnière et de fente comme polyarticulaires', () => {
    for (const movementPattern of [
      'poussee_horizontale',
      'poussee_verticale',
      'tirage_horizontal',
      'tirage_vertical',
      'squat',
      'hinge',
      'fente',
    ] as const) {
      expect(exerciseClass({ movementPattern }), movementPattern).toBe('compound');
    }
  });

  it('lit les familles d’isolation comme des isolations', () => {
    for (const movementPattern of [
      'isolation_coude',
      'isolation_epaule',
      'isolation_genou',
      'isolation_hanche',
      'isolation_cheville',
      'isolation_poignet',
    ] as const) {
      expect(exerciseClass({ movementPattern }), movementPattern).toBe('isolation');
    }
  });

  it('classe une famille « autre » ou absente par ce qu’elle sollicite : deux muscles secondaires ou plus, ou le corps entier, font un polyarticulaire', () => {
    expect(exerciseClass({ movementPattern: 'autre', primaryMuscle: 'full_body', secondaryMuscles: [] })).toBe(
      'compound',
    );
    expect(
      exerciseClass({ movementPattern: 'autre', primaryMuscle: 'quads', secondaryMuscles: ['shoulders', 'traps'] }),
    ).toBe('compound');
    // Un haussement d'épaules : un muscle, un secondaire.
    expect(exerciseClass({ movementPattern: 'autre', primaryMuscle: 'traps', secondaryMuscles: ['forearms'] })).toBe(
      'isolation',
    );
    expect(exerciseClass({ primaryMuscle: 'abs', secondaryMuscles: [] })).toBe('isolation');
  });

  it('retombe sur « polyarticulaire » sans rien savoir : la lecture la plus prudente, celle qui baisse le plus la charge', () => {
    expect(exerciseClass({})).toBe('compound');
  });

  it('range tout le catalogue dans ses deux classes, sans en laisser un seul dehors', () => {
    const rows = catalogue as {
      slug: string;
      movementPattern?: string | null;
      primaryMuscle?: string;
      secondaryMuscles?: string[];
    }[];
    const classes = rows.map((row) =>
      exerciseClass({
        ...(row.movementPattern === null || row.movementPattern === undefined
          ? {}
          : { movementPattern: row.movementPattern as (typeof MOVEMENT_PATTERNS)[number] }),
        ...(row.primaryMuscle === undefined ? {} : { primaryMuscle: row.primaryMuscle as never }),
        secondaryMuscles: (row.secondaryMuscles ?? []) as never,
      }),
    );

    expect(classes.every((klass) => klass === 'compound' || klass === 'isolation')).toBe(true);
    // Le développé couché et le curl, pour ne pas ranger tout dans la même case.
    const named = (slug: string) => classes[rows.findIndex((row) => row.slug === slug)];
    expect(classes.filter((klass) => klass === 'compound').length).toBeGreaterThan(60);
    expect(classes.filter((klass) => klass === 'isolation').length).toBeGreaterThan(50);
    expect(named(rows.find((row) => row.movementPattern === 'squat')!.slug)).toBe('compound');
    expect(named(rows.find((row) => row.movementPattern === 'isolation_coude')!.slug)).toBe('isolation');
  });
});
