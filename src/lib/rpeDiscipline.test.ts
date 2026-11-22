import { describe, expect, it } from 'vitest';
import { INCREASE_MAX_RPE } from '@/lib/coach/constants';
import {
  DEFAULT_RPE_DISCIPLINE,
  RPE_CEILING_OPTIONS,
  decideRpeDiscipline,
  disciplineState,
  exceedsCeiling,
  normalizeRpeDisciplineSettings,
  type RpeDisciplineEvent,
  type RpeDisciplineSubject,
} from './rpeDiscipline';

const ON = { enabled: true, ceiling: 8 } as const;
const AT = 1_700_000_000_000;

function subject(overrides: Partial<RpeDisciplineSubject> = {}): RpeDisciplineSubject {
  return {
    workoutStatus: 'active',
    events: [],
    setId: 'set-1',
    setType: 'normal',
    isCompleted: true,
    previousRpe: undefined,
    rpe: 8,
    ...overrides,
  };
}

const triggered = (setId = 'set-1', rpe = 9): RpeDisciplineEvent => ({
  kind: 'triggered',
  at: AT,
  setId,
  rpe,
  ceiling: 8,
});

describe('le plafond de séance', () => {
  it('vaut RPE 8, actif, par défaut', () => {
    expect(DEFAULT_RPE_DISCIPLINE).toEqual({ enabled: true, ceiling: 8 });
  });

  it('est une règle distincte du seuil de progression du coach', () => {
    // Deux règles indépendantes : l'une arrête la séance, l'autre décide d'une charge.
    expect(DEFAULT_RPE_DISCIPLINE.ceiling).not.toBe(INCREASE_MAX_RPE);
    expect(INCREASE_MAX_RPE).toBe(8.5);
  });

  it('ne laisse choisir que des plafonds franchissables sur l’échelle 6 – 10', () => {
    expect(RPE_CEILING_OPTIONS[0]).toBe(6);
    expect(RPE_CEILING_OPTIONS.at(-1)).toBe(9.5);
    expect(RPE_CEILING_OPTIONS).toContain(8);
  });

  it('relit un réglage stocké, et retombe sur le défaut pour tout le reste', () => {
    expect(normalizeRpeDisciplineSettings(undefined)).toEqual(DEFAULT_RPE_DISCIPLINE);
    expect(normalizeRpeDisciplineSettings({ enabled: false, ceiling: 7.5 })).toEqual({
      enabled: false,
      ceiling: 7.5,
    });
    expect(normalizeRpeDisciplineSettings({ enabled: 'oui', ceiling: 12 })).toEqual(
      DEFAULT_RPE_DISCIPLINE,
    );
    expect(normalizeRpeDisciplineSettings({ enabled: true, ceiling: 7.3 })).toEqual(
      DEFAULT_RPE_DISCIPLINE,
    );
  });
});

describe('exceedsCeiling', () => {
  it('laisse passer un RPE exactement égal au plafond', () => {
    expect(exceedsCeiling(8, 8)).toBe(false);
  });

  it('déclare un dépassement strict', () => {
    expect(exceedsCeiling(8.5, 8)).toBe(true);
  });

  it('ne voit rien dans un RPE manquant', () => {
    expect(exceedsCeiling(undefined, 8)).toBe(false);
    expect(exceedsCeiling(Number.NaN, 8)).toBe(false);
  });
});

describe('decideRpeDiscipline — le déclenchement', () => {
  it('ne fait rien pour un RPE égal au plafond', () => {
    expect(decideRpeDiscipline(ON, subject({ rpe: 8 }), AT)).toBeNull();
  });

  it('déclenche au-dessus du plafond, avec le plafond en vigueur figé dans l’événement', () => {
    expect(decideRpeDiscipline(ON, subject({ rpe: 9 }), AT)).toEqual({
      kind: 'triggered',
      at: AT,
      setId: 'set-1',
      rpe: 9,
      ceiling: 8,
    });
  });

  it('ne fait rien sans RPE', () => {
    expect(decideRpeDiscipline(ON, subject({ rpe: undefined }), AT)).toBeNull();
  });

  it('ne fait rien protocole désactivé', () => {
    expect(
      decideRpeDiscipline({ enabled: false, ceiling: 8 }, subject({ rpe: 10 }), AT),
    ).toBeNull();
  });

  it('attend que la série soit enregistrée', () => {
    expect(decideRpeDiscipline(ON, subject({ rpe: 10, isCompleted: false }), AT)).toBeNull();
  });

  it('ignore un échauffement', () => {
    expect(decideRpeDiscipline(ON, subject({ rpe: 10, setType: 'warmup' }), AT)).toBeNull();
  });

  it('ignore une séance qui n’est plus en cours : rien de rétroactif', () => {
    expect(
      decideRpeDiscipline(ON, subject({ rpe: 10, workoutStatus: 'completed' }), AT),
    ).toBeNull();
  });

  it('ne redéclenche pas une séance déjà verrouillée', () => {
    expect(
      decideRpeDiscipline(ON, subject({ setId: 'set-2', rpe: 10, events: [triggered()] }), AT),
    ).toBeNull();
  });

  it('suit le plafond configuré', () => {
    const strict = { enabled: true, ceiling: 7 };
    expect(decideRpeDiscipline(strict, subject({ rpe: 7.5 }), AT)?.kind).toBe('triggered');
    expect(decideRpeDiscipline(strict, subject({ rpe: 7 }), AT)).toBeNull();
  });
});

describe('decideRpeDiscipline — la correction', () => {
  it('trace la correction de la série qui a déclenché', () => {
    const event = decideRpeDiscipline(
      ON,
      subject({ events: [triggered()], previousRpe: 9, rpe: 7 }),
      AT + 1,
    );
    expect(event).toEqual({
      kind: 'corrected',
      at: AT + 1,
      setId: 'set-1',
      previousRpe: 9,
      rpe: 7,
      ceiling: 8,
    });
  });

  it('trace aussi un RPE effacé', () => {
    const event = decideRpeDiscipline(
      ON,
      subject({ events: [triggered()], previousRpe: 9, rpe: undefined }),
      AT + 1,
    );
    expect(event).toMatchObject({ kind: 'corrected', previousRpe: 9 });
    expect(event).not.toHaveProperty('rpe');
  });

  it('n’écrit rien quand la valeur ne change pas', () => {
    expect(
      decideRpeDiscipline(ON, subject({ events: [triggered()], previousRpe: 9, rpe: 9 }), AT),
    ).toBeNull();
  });

  it('trace une correction même après une dérogation', () => {
    const events: RpeDisciplineEvent[] = [
      triggered(),
      { kind: 'override', at: AT + 1, setId: 'set-1', ceiling: 8 },
    ];
    expect(decideRpeDiscipline(ON, subject({ events, previousRpe: 9, rpe: 7 }), AT + 2)?.kind).toBe(
      'corrected',
    );
  });

  it('ne redéclenche pas sur la série déjà exemptée par une dérogation', () => {
    const events: RpeDisciplineEvent[] = [
      triggered(),
      { kind: 'override', at: AT + 1, setId: 'set-1', ceiling: 8 },
    ];
    // La correction est tracée, mais ne rouvre pas le verrou.
    const event = decideRpeDiscipline(ON, subject({ events, previousRpe: 9, rpe: 9.5 }), AT + 2);
    expect(event?.kind).toBe('corrected');
    expect(disciplineState([...events, event!]).status).toBe('clear');
  });

  it('redéclenche sur une autre série après une dérogation', () => {
    const events: RpeDisciplineEvent[] = [
      triggered(),
      { kind: 'override', at: AT + 1, setId: 'set-1', ceiling: 8 },
    ];
    expect(decideRpeDiscipline(ON, subject({ events, setId: 'set-2', rpe: 9 }), AT + 2)?.kind).toBe(
      'triggered',
    );
  });
});

describe('disciplineState', () => {
  it('est libre sans événement', () => {
    expect(disciplineState([])).toEqual({ status: 'clear', overrides: 0 });
    expect(disciplineState(undefined)).toEqual({ status: 'clear', overrides: 0 });
  });

  it('verrouille au déclenchement', () => {
    expect(disciplineState([triggered()])).toMatchObject({
      status: 'locked',
      trigger: { setId: 'set-1', rpe: 9, ceiling: 8 },
    });
  });

  it('déverrouille quand la correction ramène le RPE sous le plafond', () => {
    const state = disciplineState([
      triggered(),
      { kind: 'corrected', at: AT + 1, setId: 'set-1', previousRpe: 9, rpe: 8, ceiling: 8 },
    ]);
    expect(state.status).toBe('clear');
  });

  it('reste verrouillé quand la correction dépasse encore, avec la valeur corrigée', () => {
    const state = disciplineState([
      triggered(),
      { kind: 'corrected', at: AT + 1, setId: 'set-1', previousRpe: 9, rpe: 9.5, ceiling: 8 },
    ]);
    expect(state).toMatchObject({ status: 'locked', trigger: { rpe: 9.5 } });
  });

  it('déverrouille sur dérogation et la compte', () => {
    const state = disciplineState([
      triggered(),
      { kind: 'override', at: AT + 1, setId: 'set-1', ceiling: 8 },
    ]);
    expect(state).toEqual({ status: 'clear', overrides: 1 });
  });

  it('ignore les lignes illisibles d’une sauvegarde abîmée', () => {
    const state = disciplineState([
      { kind: 'triggered' },
      'x',
      null,
    ] as unknown as RpeDisciplineEvent[]);
    expect(state.status).toBe('clear');
  });
});
