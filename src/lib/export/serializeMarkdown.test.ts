import { describe, expect, it } from 'vitest';
import type { SessionTotals } from '@/lib/volume';
import { serializeMarkdown } from './serializeMarkdown';
import type { CoachExport, ExportExercise, ExportWorkout } from './types';

const NO_TOTALS: SessionTotals = {
  workingSets: 0,
  totalReps: 0,
  tonnage: 0,
  durationSeconds: 0,
  distanceMeters: 0,
};

function exportWorkout(overrides: Partial<ExportWorkout> = {}): ExportWorkout {
  return {
    name: 'Upper A',
    startedAt: '2026-07-27T18:20:00+02:00',
    localDate: '2026-07-27',
    timezoneOffsetMinutes: 120,
    durationSeconds: 4320,
    totals: { ...NO_TOTALS, workingSets: 2, totalReps: 19, tonnage: 1520 },
    exercises: [],
    ...overrides,
  };
}

function bench(overrides: Partial<ExportExercise> = {}): ExportExercise {
  return {
    name: 'Développé couché',
    measurementType: 'weight_reps',
    primaryMuscle: 'chest',
    equipment: 'barbell',
    sets: [
      { number: 1, type: 'normal', side: 'both', weightKg: 80, reps: 10 },
      { number: 2, type: 'normal', side: 'both', weightKg: 80, reps: 9 },
    ],
    ...overrides,
  };
}

function coachExport(overrides: Partial<CoachExport> = {}): CoachExport {
  const workouts = overrides.workouts ?? [exportWorkout({ exercises: [bench()] })];
  return {
    format: 'fittrack-coach-export',
    schemaVersion: 1,
    exportedAt: '2026-07-28T09:00:00.000Z',
    scope: { kind: 'all-history' },
    workoutCount: workouts.length,
    workingSetCount: 2,
    ...overrides,
    workouts,
  };
}

const write = (overrides: Partial<CoachExport> = {}) => serializeMarkdown(coachExport(overrides));

describe('serializeMarkdown — document', () => {
  it('opens on a title and a summary', () => {
    const text = write();
    expect(text.startsWith('# Export FitTrack\n')).toBe(true);
    expect(text).toContain('Séances : 1');
    expect(text).toContain('Séries de travail : 2');
    expect(text).toContain('Export du 28 juillet 2026');
  });

  it('names the scope it covers', () => {
    expect(
      write({ scope: { kind: 'workout', workoutId: 'w1' } }),
    ).toContain('Périmètre : la séance « Upper A » du 27 juillet 2026');

    expect(
      // Local midnights, as a date picker produces them. `to` is exclusive, so
      // the header must announce the 27th and not the 28th.
      write({
        scope: {
          kind: 'period',
          from: new Date(2026, 6, 1).getTime(),
          to: new Date(2026, 6, 28).getTime(),
        },
      }),
    ).toContain('Période : 1 juillet 2026 → 27 juillet 2026');

    expect(write({ scope: { kind: 'exercise', exerciseId: 'e1' } })).toContain(
      'Périmètre : Développé couché, tout l’historique de cet exercice',
    );

    expect(write()).toContain('Périmètre : tout l’historique');
  });

  it('explains the one aggregated figure it prints', () => {
    expect(write()).toContain('Le tonnage ne compte que la charge externe');
  });

  it('says nothing about tonnage when there is none to say', () => {
    const text = write({
      workouts: [
        exportWorkout({
          totals: { ...NO_TOTALS, workingSets: 1, totalReps: 8 },
          exercises: [
            {
              name: 'Traction assistée',
              measurementType: 'assisted_weight_reps',
              sets: [{ number: 1, type: 'normal', side: 'both', weightKg: 20, reps: 8 }],
            },
          ],
        }),
      ],
    });

    expect(text).not.toContain('Tonnage');
  });

  it('states plainly when a scope holds nothing', () => {
    expect(write({ workouts: [], workoutCount: 0, workingSetCount: 0 })).toContain(
      'Aucune séance sur ce périmètre.',
    );
  });
});

describe('serializeMarkdown — a session', () => {
  it('heads each session with its name and its own local time', () => {
    expect(write()).toContain('## Upper A — 27 juillet 2026 à 18:20');
  });

  it('reads the recorded offset, not the machine running the export', () => {
    const text = write({
      workouts: [
        exportWorkout({
          startedAt: '2026-07-27T11:20:00-05:00',
          timezoneOffsetMinutes: -300,
          exercises: [bench()],
        }),
      ],
    });

    expect(text).toContain('## Upper A — 27 juillet 2026 à 11:20');
  });

  it('prints duration and tonnage as the app prints them', () => {
    // The thousands separator is whatever `fr-FR` grouping produces — a narrow
    // no-break space today. Asserting the character would pin an ICU detail.
    expect(write()).toMatch(/Durée : 1 h 12 · Tonnage : 1\s520 kg · 2 séries de travail/);
  });

  it('keeps the line breaks of a note, outside any table', () => {
    const text = write({
      workouts: [
        exportWorkout({ notes: 'Ligne un\nLigne deux', exercises: [bench()] }),
      ],
    });

    expect(text).toContain('Ligne un\nLigne deux');
  });

  it('titles an exercise with its muscle and its hardware', () => {
    expect(write()).toContain('### Développé couché — Pectoraux · Barre');
  });

  it('names an exercise it cannot identify rather than leaving a hole', () => {
    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            { sets: [{ number: 1, type: 'normal', side: 'both', reps: 10, weightKg: 80 }] },
          ],
        }),
      ],
    });

    expect(text).toContain('### Exercice inconnu');
    expect(text).not.toContain('### Exercice inconnu —');
  });
});

describe('serializeMarkdown — tables', () => {
  it('writes one row per set, never a summary', () => {
    const text = write();
    expect(text).toContain('| 1 | 80 kg | 10 |');
    expect(text).toContain('| 2 | 80 kg | 9 |');
    expect(text).not.toContain('2 séries ×');
  });

  it('drops the type column when every set is a normal one', () => {
    expect(write()).not.toContain('| Type |');
  });

  it('keeps the type column as soon as one set is not normal', () => {
    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              sets: [
                { number: 1, type: 'warmup', side: 'both', weightKg: 40, reps: 12 },
                { number: 2, type: 'normal', side: 'both', weightKg: 80, reps: 10 },
              ],
            }),
          ],
        }),
      ],
    });

    expect(text).toContain('| Série | Type | Charge | Reps |');
    expect(text).toContain('| 1 | Échauffement | 40 kg | 12 |');
  });

  it('adds the RPE column only where an RPE was recorded, and dashes the gaps', () => {
    expect(write()).not.toContain('RPE');

    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              sets: [
                { number: 1, type: 'normal', side: 'both', weightKg: 80, reps: 10 },
                { number: 2, type: 'normal', side: 'both', weightKg: 80, reps: 9, rpe: 8.5 },
              ],
            }),
          ],
        }),
      ],
    });

    expect(text).toContain('| Série | Charge | Reps | RPE |');
    expect(text).toContain('| 1 | 80 kg | 10 | — |');
    expect(text).toContain('| 2 | 80 kg | 9 | 8,5 |');
  });

  it('adds a side column only when a side was recorded', () => {
    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              sets: [
                { number: 1, type: 'normal', side: 'left', weightKg: 20, reps: 10 },
                { number: 2, type: 'normal', side: 'right', weightKg: 20, reps: 10 },
              ],
            }),
          ],
        }),
      ],
    });

    expect(text).toContain('| Série | Côté | Charge | Reps |');
    expect(text).toContain('| 1 | Gauche | 20 kg | 10 |');
  });

  it('names the weight column after what the weight actually is', () => {
    const assisted = (measurementType: ExportExercise['measurementType']) =>
      write({
        workouts: [
          exportWorkout({
            exercises: [
              bench({
                measurementType,
                sets: [{ number: 1, type: 'normal', side: 'both', weightKg: 20, reps: 8 }],
              }),
            ],
          }),
        ],
      });

    expect(assisted('assisted_weight_reps')).toContain('| Série | Assistance | Reps |');
    expect(assisted('reps_only')).toContain('| Série | Charge ajoutée | Reps |');
    expect(assisted('weight_reps')).toContain('| Série | Charge | Reps |');
  });

  it('gives each measurement type the columns it is measured in', () => {
    const plank = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              measurementType: 'time_only',
              sets: [{ number: 1, type: 'normal', side: 'both', durationSeconds: 90 }],
            }),
          ],
        }),
      ],
    });

    expect(plank).toContain('| Série | Durée |');
    expect(plank).toContain('| 1 | 1:30 min |');
    expect(plank).not.toContain('Charge');

    const rower = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              measurementType: 'distance_time',
              sets: [
                { number: 1, type: 'normal', side: 'both', distanceMeters: 2000, durationSeconds: 480 },
              ],
            }),
          ],
        }),
      ],
    });

    expect(rower).toContain('| Série | Distance | Durée |');
    // m:ss past a minute, exactly as the routine card and the history line read.
    expect(rower).toContain('| 1 | 2 km | 8:00 min |');
  });

  it('writes every stored figure when the measurement type is lost', () => {
    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            {
              name: 'Mouvement oublié',
              sets: [
                {
                  number: 1,
                  type: 'normal',
                  side: 'both',
                  weightKg: 80,
                  reps: 10,
                  durationSeconds: 30,
                  distanceMeters: 100,
                },
              ],
            },
          ],
        }),
      ],
    });

    expect(text).toContain('| Série | Charge | Distance | Reps | Durée |');
  });

  it('writes decimals the French way', () => {
    const text = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({ sets: [{ number: 1, type: 'normal', side: 'both', weightKg: 102.5, reps: 5 }] }),
          ],
        }),
      ],
    });

    expect(text).toContain('102,5 kg');
  });
});

describe('serializeMarkdown — free text and tables', () => {
  const withText = (name: string, notes: string) =>
    write({
      workouts: [
        exportWorkout({
          notes: 'Séance\ncoupée en deux',
          exercises: [
            bench({
              name,
              notes,
              sets: [{ number: 1, type: 'normal', side: 'both', weightKg: 50, reps: 12 }],
            }),
          ],
        }),
      ],
    });

  it('keeps user text out of the tables, so it keeps its shape', () => {
    const text = withText('Tirage | poulie', 'Siège 4\nDos calé');

    // A heading and a paragraph are not cells: the pipe and the line break stand
    // as written, which is the whole reason names and notes are not columns.
    expect(text).toContain('### Tirage | poulie');
    expect(text).toContain('Siège 4\nDos calé');
    expect(text).toContain('Séance\ncoupée en deux');
  });

  it('leaves every table row intact whatever the free text contains', () => {
    const rows = withText('Tirage | poulie', 'Siège 4\nDos calé')
      .split('\n')
      .filter((line) => line.startsWith('|'));

    // Header, alignment, one set — and each with exactly three columns.
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.split('|').length === 5)).toBe(true);
  });

  it('escapes a pipe that ever reaches a cell', () => {
    const escaped = write({
      workouts: [
        exportWorkout({
          exercises: [
            bench({
              name: 'A',
              // A set type is a fixed label today, but a cell is a cell: the
              // escaping is a property of the table, not of today's data.
              sets: [{ number: 1, type: 'normal', side: 'both', weightKg: 50, reps: 12 }],
            }),
          ],
        }),
      ],
    });

    expect(escaped.split('\n').filter((line) => line.startsWith('| 1 '))).toHaveLength(1);
  });

  it('accepts accented text without mangling it', () => {
    expect(withText('Élévations latérales', 'Épaule à l’étroit')).toContain(
      '### Élévations latérales',
    );
  });
});
