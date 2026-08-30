import { describe, expect, it } from 'vitest';
import { earnMilestones } from './engine';
import type { MilestoneInput, MilestoneSession, MilestoneSet } from './types';

const DAY = 86_400_000;
/** Un lundi, pour que « semaine » veuille dire quelque chose de stable. */
const MONDAY = Date.UTC(2024, 0, 1, 9);

function set(overrides: Partial<MilestoneSet> & { performedAt: number }): MilestoneSet {
  return {
    workoutId: `w-${String(overrides.performedAt)}`,
    slug: 'barbell-bench-press',
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: false,
    setType: 'normal',
    tonnageKg: 0,
    ...overrides,
  };
}

function session(startedAt: number): MilestoneSession {
  return { workoutId: `w-${String(startedAt)}`, startedAt };
}

function run(input: Partial<MilestoneInput>): ReturnType<typeof earnMilestones> {
  return earnMilestones({ sets: input.sets ?? [], sessions: input.sessions ?? [] });
}

const idsOf = (earned: ReturnType<typeof earnMilestones>): string[] =>
  earned.map((item) => item.definitionId);

const find = (earned: ReturnType<typeof earnMilestones>, id: string) =>
  earned.find((item) => item.definitionId === id);

describe('les jalons de charge', () => {
  it('ne rend rien tant que le seuil n’est pas franchi', () => {
    const earned = run({ sets: [set({ performedAt: MONDAY, weight: 97.5, reps: 3 })] });
    expect(idsOf(earned)).not.toContain('bench-100');
  });

  it('rend le jalon à l’égalité stricte du seuil', () => {
    const earned = run({ sets: [set({ performedAt: MONDAY, weight: 100, reps: 1 })] });
    expect(find(earned, 'bench-100')).toMatchObject({ value: 100, workoutId: 'w-1704099600000' });
  });

  it('retient la valeur qui a franchi, pas le seuil', () => {
    const earned = run({ sets: [set({ performedAt: MONDAY, weight: 102.5, reps: 1 })] });
    expect(find(earned, 'bench-100')?.value).toBe(102.5);
  });

  it('rend tous les paliers dépassés d’un coup pour un premier passage tardif', () => {
    // Un historique importé commence rarement à zéro : la première séance lue
    // peut valoir trois paliers à la fois, et les taire serait les perdre.
    const earned = run({ sets: [set({ performedAt: MONDAY, weight: 105, reps: 1 })] });
    expect(idsOf(earned)).toEqual(
      expect.arrayContaining(['bench-60', 'bench-80', 'bench-100']),
    );
    expect(idsOf(earned)).not.toContain('bench-120');
  });

  it('date le jalon à la première série qui l’a franchi, pas à la meilleure', () => {
    const earned = run({
      sets: [
        set({ performedAt: MONDAY, weight: 100, reps: 1 }),
        set({ performedAt: MONDAY + DAY, weight: 110, reps: 1 }),
      ],
    });
    expect(find(earned, 'bench-100')?.achievedAt).toBe(MONDAY);
    expect(find(earned, 'bench-100')?.value).toBe(100);
  });

  it('ignore l’échauffement — une barre montée à vide n’est pas un jalon', () => {
    const earned = run({
      sets: [set({ performedAt: MONDAY, weight: 100, reps: 1, setType: 'warmup' })],
    });
    expect(idsOf(earned)).not.toContain('bench-100');
  });

  it('compte une série jusqu’à l’échec comme n’importe quelle série de travail', () => {
    const earned = run({
      sets: [set({ performedAt: MONDAY, weight: 100, reps: 1, setType: 'failure' })],
    });
    expect(idsOf(earned)).toContain('bench-100');
  });

  it('n’accorde rien à un exercice personnel, faute de slug', () => {
    const earned = run({
      sets: [set({ performedAt: MONDAY, weight: 150, reps: 1, slug: undefined })],
    });
    expect(idsOf(earned)).not.toContain('bench-100');
  });

  it('n’accorde rien à une charge portée par un autre mouvement', () => {
    const earned = run({
      sets: [set({ performedAt: MONDAY, weight: 150, reps: 1, slug: 'leg-press' })],
    });
    expect(idsOf(earned)).not.toContain('bench-100');
  });

  it('accepte le sumo pour le jalon du soulevé de terre', () => {
    const earned = run({
      sets: [set({ performedAt: MONDAY, weight: 140, reps: 1, slug: 'sumo-deadlift' })],
    });
    expect(idsOf(earned)).toEqual(expect.arrayContaining(['deadlift-100', 'deadlift-140']));
  });

  it('ne confond pas une répétition avec une charge', () => {
    // 100 répétitions à 20 kg ne valent pas le jalon des 100 kg.
    const earned = run({ sets: [set({ performedAt: MONDAY, weight: 20, reps: 100 })] });
    expect(idsOf(earned)).not.toContain('bench-100');
  });
});

describe('les jalons de portes', () => {
  const pullUp = (performedAt: number, reps: number): MilestoneSet =>
    set({
      performedAt,
      slug: 'pull-up',
      equipment: 'bodyweight',
      measurementType: 'reps_only',
      reps,
    });

  it('ouvre la porte à la première répétition', () => {
    const earned = run({ sets: [pullUp(MONDAY, 1)] });
    expect(find(earned, 'pullup-1')).toMatchObject({ value: 1, achievedAt: MONDAY });
  });

  it('ne s’ouvre pas sur une série validée sans répétition', () => {
    const earned = run({ sets: [pullUp(MONDAY, 0)] });
    expect(idsOf(earned)).not.toContain('pullup-1');
  });

  it('ne compte jamais les répétitions de plusieurs séries entre elles', () => {
    // Cinq fois une traction n’est pas une série de cinq. Le jalon est une
    // série, sans quoi il ne récompenserait plus que la patience.
    const earned = run({
      sets: [
        pullUp(MONDAY, 1),
        pullUp(MONDAY + 60_000, 1),
        pullUp(MONDAY + 120_000, 1),
        pullUp(MONDAY + 180_000, 1),
        pullUp(MONDAY + 240_000, 1),
      ],
    });
    expect(idsOf(earned)).not.toContain('pullup-5');
  });

  it('sépare la pronation de la supination', () => {
    const earned = run({
      sets: [
        set({
          performedAt: MONDAY,
          slug: 'chin-up',
          equipment: 'bodyweight',
          measurementType: 'reps_only',
          reps: 12,
        }),
      ],
    });
    expect(idsOf(earned)).toContain('chinup-1');
    expect(idsOf(earned)).not.toContain('pullup-1');
  });

  it('compte les secondes tenues sur un exercice chronométré', () => {
    const earned = run({
      sets: [
        set({
          performedAt: MONDAY,
          slug: 'plank',
          equipment: 'bodyweight',
          measurementType: 'time_only',
          durationSeconds: 125,
        }),
      ],
    });
    expect(find(earned, 'plank-120')).toMatchObject({ value: 125 });
    expect(idsOf(earned)).not.toContain('plank-300');
  });
});

describe('la paire d’haltères', () => {
  const dumbbell = (overrides: Partial<MilestoneSet>): MilestoneSet =>
    set({
      performedAt: MONDAY,
      slug: 'dumbbell-bench-press',
      equipment: 'dumbbell',
      measurementType: 'weight_reps',
      weight: 30,
      reps: 8,
      ...overrides,
    });

  it('reconnaît la paire quel que soit le mouvement qui la tient', () => {
    const earned = run({ sets: [dumbbell({ slug: 'dumbbell-shoulder-press' })] });
    expect(idsOf(earned)).toEqual(expect.arrayContaining(['dumbbell-20', 'dumbbell-30']));
  });

  it('vaut aussi pour un exercice personnel — la paire n’a pas besoin d’un nom', () => {
    const earned = run({ sets: [dumbbell({ slug: undefined })] });
    expect(idsOf(earned)).toContain('dumbbell-30');
  });

  it('refuse un mouvement unilatéral : un seul haltère n’est pas une paire', () => {
    const earned = run({ sets: [dumbbell({ slug: 'dumbbell-row', isUnilateral: true })] });
    expect(idsOf(earned)).not.toContain('dumbbell-30');
  });

  it('refuse une barre, même chargée au même poids', () => {
    const earned = run({ sets: [dumbbell({ equipment: 'barbell' })] });
    expect(idsOf(earned)).not.toContain('dumbbell-30');
  });

  it('refuse la marche du fermier, qui n’est pas mesurée en répétitions', () => {
    const earned = run({
      sets: [dumbbell({ slug: 'farmers-walk', measurementType: 'weight_time', reps: undefined })],
    });
    expect(idsOf(earned)).not.toContain('dumbbell-30');
  });
});

describe('les jalons de pratique', () => {
  const sessions = (count: number, from = MONDAY): MilestoneSession[] =>
    Array.from({ length: count }, (_, index) => session(from + index * DAY));

  it('compte les séances terminées', () => {
    const earned = run({ sessions: sessions(10) });
    expect(find(earned, 'sessions-10')).toMatchObject({ value: 10 });
    expect(idsOf(earned)).not.toContain('sessions-50');
  });

  it('date la centième séance au jour de la centième, pas de la dernière', () => {
    const earned = run({ sessions: sessions(120) });
    expect(find(earned, 'sessions-100')?.achievedAt).toBe(MONDAY + 99 * DAY);
  });

  it('compte les semaines actives sans exiger qu’elles se suivent', () => {
    // Dix semaines d’entraînement séparées par des mois d’arrêt valent dix
    // semaines. C’est toute la différence avec une série, et le cœur du module.
    const earned = run({
      sessions: Array.from({ length: 10 }, (_, index) =>
        session(MONDAY + index * 60 * DAY),
      ),
    });
    expect(find(earned, 'weeks-10')).toMatchObject({ value: 10 });
  });

  it('ne compte qu’une fois deux séances de la même semaine', () => {
    const earned = run({
      sessions: [session(MONDAY), session(MONDAY + DAY), session(MONDAY + 2 * DAY)],
    });
    expect(idsOf(earned)).not.toContain('weeks-10');
  });

  it('accorde l’année à la séance qui suit l’anniversaire, jamais au calendrier seul', () => {
    const justBefore = run({
      sessions: [session(MONDAY), session(MONDAY + 300 * DAY)],
    });
    expect(idsOf(justBefore)).not.toContain('years-1');

    const after = run({ sessions: [session(MONDAY), session(MONDAY + 400 * DAY)] });
    expect(find(after, 'years-1')).toMatchObject({
      value: 1,
      achievedAt: MONDAY + 400 * DAY,
    });
  });

  it('cumule le tonnage de toutes les séries de travail', () => {
    const earned = run({
      sets: Array.from({ length: 100 }, (_, index) =>
        set({ performedAt: MONDAY + index * DAY, weight: 60, reps: 10, tonnageKg: 1000 }),
      ),
    });
    expect(find(earned, 'tonnage-100')).toMatchObject({ value: 100_000 });
    expect(idsOf(earned)).not.toContain('tonnage-500');
  });

  it('exclut l’échauffement du tonnage cumulé, comme partout ailleurs', () => {
    const earned = run({
      sets: Array.from({ length: 100 }, (_, index) =>
        set({
          performedAt: MONDAY + index * DAY,
          weight: 60,
          reps: 10,
          tonnageKg: 1000,
          setType: 'warmup',
        }),
      ),
    });
    expect(idsOf(earned)).not.toContain('tonnage-100');
  });
});

describe('la sortie du moteur', () => {
  it('rend les jalons du plus ancien au plus récent', () => {
    const earned = run({
      sets: [
        set({ performedAt: MONDAY + DAY, weight: 100, reps: 1 }),
        set({ performedAt: MONDAY, weight: 60, reps: 5 }),
      ],
    });
    const dates = earned.map((item) => item.achievedAt);
    expect(dates).toEqual([...dates].sort((left, right) => left - right));
  });

  it('ne rend jamais deux fois le même jalon', () => {
    const earned = run({
      sets: [
        set({ performedAt: MONDAY, weight: 100, reps: 1 }),
        set({ performedAt: MONDAY + DAY, weight: 100, reps: 1 }),
      ],
    });
    expect(idsOf(earned).filter((id) => id === 'bench-100')).toHaveLength(1);
  });

  it('lit les séries dans l’ordre du temps même livrées en désordre', () => {
    const ordered = run({
      sets: [
        set({ performedAt: MONDAY, weight: 100, reps: 1 }),
        set({ performedAt: MONDAY + DAY, weight: 120, reps: 1 }),
      ],
    });
    const shuffled = run({
      sets: [
        set({ performedAt: MONDAY + DAY, weight: 120, reps: 1 }),
        set({ performedAt: MONDAY, weight: 100, reps: 1 }),
      ],
    });
    expect(shuffled).toEqual(ordered);
  });

  it('ne rend rien sur une base vide', () => {
    expect(run({})).toEqual([]);
  });
});
