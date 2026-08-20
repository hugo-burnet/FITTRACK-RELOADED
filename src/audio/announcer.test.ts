import { describe, expect, it } from 'vitest';
import { clipsFor } from './cues';
import { EMPTY_MEMORY, planCue, type AnnouncerMemory } from './announcer';

const first = (clips: readonly string[]): string => clips[0] ?? '';

/** Enchaîne des cues sur une même mémoire, comme une séance le ferait. */
function run(
  mode: Parameters<typeof planCue>[1],
  steps: readonly { cue: Parameters<typeof planCue>[2]; at: number }[],
  choose = first,
) {
  let memory: AnnouncerMemory = EMPTY_MEMORY;
  return steps.map(({ cue, at }) => {
    const result = planCue(memory, mode, cue, at, choose);
    memory = result.memory;
    return result.plan;
  });
}

describe('planCue', () => {
  it('ne produit rien en silence', () => {
    const { plan, memory } = planCue(EMPTY_MEMORY, 'silence', 'rest-over', 1_000, first);
    expect(plan).toEqual({ tone: null, clip: null });
    expect(memory).toBe(EMPTY_MEMORY);
  });

  it('joue le son sans la voix en mode sons', () => {
    const { plan } = planCue(EMPTY_MEMORY, 'sounds', 'rest-over', 1_000, first);
    expect(plan.tone).toBe('chime');
    expect(plan.clip).toBeNull();
  });

  it('joue le son et la phrase en mode voix', () => {
    const { plan } = planCue(EMPTY_MEMORY, 'voice', 'rest-over', 1_000, first);
    expect(plan.tone).toBe('chime');
    expect(plan.clip).toBe(clipsFor('rest-over')[0]);
  });

  it('laisse le décompte parler ses trois secondes', () => {
    const plans = run('voice', [
      { cue: 'rest-3', at: 0 },
      { cue: 'rest-2', at: 1_000 },
      { cue: 'rest-1', at: 2_000 },
      { cue: 'rest-over', at: 3_000 },
    ]);

    expect(plans.map((plan) => plan.tone)).toEqual(['tick', 'tick', 'tick', 'chime']);
    expect(plans.every((plan) => plan.clip !== null)).toBe(true);
  });

  it('distingue le tap des répétitions du tic d’urgence du repos', () => {
    const [rep, rest] = run('sounds', [
      { cue: 'rep-tick', at: 0 },
      { cue: 'rest-3', at: 1_000 },
    ]);

    expect(rep?.tone).toBe('repTap');
    expect(rest?.tone).toBe('tick');
  });

  it('ne parle pas par-dessus une phrase qui vient de commencer', () => {
    const plans = run('voice', [
      { cue: 'exercise-cleared', at: 0 },
      { cue: 'last-set-ahead', at: 500 },
    ]);

    expect(plans[1]?.tone).toBe('validate');
    // Le son reste : c'est la phrase qui est la ressource rare.
    expect(plans[1]?.clip).toBeNull();
  });

  it('laisse un record couper la parole', () => {
    const plans = run('voice', [
      { cue: 'last-set-ahead', at: 0 },
      { cue: 'record-beaten', at: 200 },
    ]);

    expect(plans[1]?.clip).toBe(clipsFor('record-beaten')[0]);
  });

  it('ne répète pas le même cue pendant son temps de repos', () => {
    const plans = run('voice', [
      { cue: 'record-beaten', at: 0 },
      { cue: 'record-beaten', at: 5_000 },
      { cue: 'record-beaten', at: 20_000 },
    ]);

    expect(plans[1]).toEqual({ tone: null, clip: null });
    expect(plans[2]?.tone).toBe('record');
  });

  it('ne redit jamais deux fois de suite la même variante', () => {
    const plans = run(
      'voice',
      [
        { cue: 'rest-over', at: 0 },
        { cue: 'rest-over', at: 60_000 },
        { cue: 'rest-over', at: 120_000 },
      ],
      first,
    );

    expect(plans[1]?.clip).not.toBe(plans[0]?.clip);
    expect(plans[2]?.clip).not.toBe(plans[1]?.clip);
  });

  it('reste muet sur un cue sans phrase enregistrée', () => {
    const { plan } = planCue(EMPTY_MEMORY, 'voice', 'set-validated', 0, first);
    expect(plan.tone).toBe('validate');
    expect(plan.clip).toBeNull();
  });

  it('ne compte pas un silence comme une prise de parole', () => {
    // `set-validated` n'a pas de phrase : il ne doit pas ouvrir un délai de
    // grâce qui ferait taire la phrase suivante.
    const plans = run('voice', [
      { cue: 'set-validated', at: 0 },
      { cue: 'last-set-ahead', at: 10 },
    ]);

    expect(plans[1]?.clip).toBe(clipsFor('last-set-ahead')[0]);
  });
});
