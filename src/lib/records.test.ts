import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import { bestSets, recordsBeatenBy, setVolume } from './records';

let sequence = 0;

/** A validated set. Only what a test cares about is passed. */
const aSet = (values: Partial<WorkoutSet>): WorkoutSet => ({
  id: `set-${(sequence += 1)}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we',
  exerciseId: 'ex',
  workoutId: 'w',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  ...values,
});

describe('setVolume', () => {
  it('multiplie la charge par les répétitions', () => {
    expect(setVolume(aSet({ weight: 100, reps: 5 }))).toBe(500);
  });

  it('vaut 0 sans répétitions — un gainage lesté n’a pas de volume', () => {
    expect(setVolume(aSet({ weight: 20, durationSeconds: 60 }))).toBe(0);
  });

  it('vaut 0 sans charge — une traction au poids du corps non plus', () => {
    expect(setVolume(aSet({ reps: 12 }))).toBe(0);
  });
});

describe('bestSets', () => {
  it('ne rend rien sur un historique vide', () => {
    expect(bestSets([])).toEqual({
      heaviest: undefined,
      mostReps: undefined,
      bestVolume: undefined,
    });
  });

  it('retient la charge la plus lourde', () => {
    const heavy = aSet({ weight: 110, reps: 3 });
    const best = bestSets([aSet({ weight: 100, reps: 5 }), heavy, aSet({ weight: 90, reps: 8 })]);
    expect(best.heaviest).toBe(heavy);
  });

  it('retient la série au plus gros volume, pas la plus lourde', () => {
    const volume = aSet({ weight: 60, reps: 12 }); // 720
    const best = bestSets([aSet({ weight: 100, reps: 5 }), volume]); // 500
    expect(best.bestVolume).toBe(volume);
    expect(best.heaviest).not.toBe(volume);
  });

  // Règle du Lot 6, encodée ici : sinon le Lot 6 doit revenir modifier une
  // fonction déjà consommée par la fiche exercice.
  it('exclut les séries d’échauffement', () => {
    const best = bestSets([
      aSet({ weight: 200, reps: 1, setType: 'warmup' }),
      aSet({ weight: 100, reps: 5 }),
    ]);
    expect(best.heaviest!.weight).toBe(100);
    expect(best.bestVolume!.weight).toBe(100);
  });

  it('à égalité, garde la série la plus ancienne', () => {
    const first = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const later = aSet({ weight: 100, reps: 5, performedAt: 2_000 });
    expect(bestSets([later, first]).heaviest).toBe(first);
  });

  it('compte les répétitions d’une série sans charge', () => {
    const pullUps = aSet({ reps: 14 });
    const best = bestSets([pullUps, aSet({ reps: 10 })]);
    expect(best.mostReps).toBe(pullUps);
    expect(best.heaviest).toBeUndefined();
  });

  it('ignore une charge à zéro : le poids du corps n’est pas un record de charge', () => {
    expect(bestSets([aSet({ weight: 0, reps: 20 })]).heaviest).toBeUndefined();
  });
});

/** Ce que la série qu'on vient de cocher a battu — RF-23, détection en direct. */
describe('recordsBeatenBy', () => {
  const kinds = (set: WorkoutSet, others: WorkoutSet[]): string[] =>
    recordsBeatenBy(set, others).map((beaten) => beaten.kind);

  it('ne bat rien quand il n’y a rien à battre', () => {
    expect(recordsBeatenBy(aSet({ weight: 100, reps: 5 }), [])).toEqual([]);
  });

  // 105 × 3, pas × 5 : à répétitions égales une charge plus lourde bat aussi le
  // volume, et ce test-là ne parle que de la charge.
  it('bat la charge la plus lourde de l’historique', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const beaten = recordsBeatenBy(aSet({ weight: 105, reps: 3, performedAt: 2_000 }), [before]);
    expect(beaten).toEqual([{ kind: 'heaviest', beaten: before }]);
  });

  it('à égalité ne bat rien : le record reste à celui qui l’a posé', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    expect(kinds(aSet({ weight: 100, reps: 5, performedAt: 2_000 }), [before])).toEqual([]);
  });

  // L'exigence du Lot 6 : la comparaison n'est pas « l'historique », c'est
  // « tout ce qui compte », séries déjà cochées aujourd'hui comprises.
  it('compare aussi aux séries déjà validées aujourd’hui', () => {
    const history = aSet({ weight: 90, reps: 5, performedAt: 1_000 });
    const setOne = aSet({ weight: 100, reps: 5, performedAt: 2_000, workoutId: 'today' });
    const setTwo = aSet({ weight: 102.5, reps: 4, performedAt: 2_100, workoutId: 'today' });

    expect(recordsBeatenBy(setTwo, [history, setOne])).toEqual([
      { kind: 'heaviest', beaten: setOne },
    ]);
  });

  it('s’exclut elle-même de la comparaison', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const candidate = aSet({ weight: 105, reps: 3, performedAt: 2_000 });
    // Le site d'appel passe toutes les séries de l'exercice, la candidate
    // comprise : la faire sortir ici est ce qui rend l'appel impossible à rater.
    expect(kinds(candidate, [before, candidate])).toEqual(['heaviest']);
  });

  it('un échauffement ne bat rien', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const warmup = aSet({ weight: 200, reps: 1, setType: 'warmup', performedAt: 2_000 });
    expect(kinds(warmup, [before])).toEqual([]);
  });

  // Requalifier une série en échauffement en pleine séance (tâche 1) invalide
  // donc son record sans qu'aucun code d'invalidation existe : la question est
  // reposée à chaque rendu, jamais mémorisée.
  it('une série requalifiée en échauffement perd son record', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const candidate = aSet({ weight: 105, reps: 3, performedAt: 2_000 });
    expect(kinds(candidate, [before])).toEqual(['heaviest']);
    expect(kinds({ ...candidate, setType: 'warmup' }, [before])).toEqual([]);
  });

  it('ne prend pas un échauffement de l’historique pour une référence', () => {
    const heavyWarmup = aSet({ weight: 200, reps: 1, setType: 'warmup', performedAt: 1_000 });
    const working = aSet({ weight: 100, reps: 5, performedAt: 1_100 });
    expect(kinds(aSet({ weight: 150, reps: 3, performedAt: 2_000 }), [heavyWarmup, working])).toEqual(
      ['heaviest'],
    );
  });

  it('bat la meilleure série sans battre la charge', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 }); // 500
    const candidate = aSet({ weight: 60, reps: 12, performedAt: 2_000 }); // 720
    expect(recordsBeatenBy(candidate, [before])).toEqual([{ kind: 'bestVolume', beaten: before }]);
  });

  // La charge d'abord : la carte n'affiche que le premier, et « Charge max » est
  // le titre quand les deux tombent d'un coup.
  it('classe la charge avant la meilleure série quand les deux tombent', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    expect(kinds(aSet({ weight: 105, reps: 10, performedAt: 2_000 }), [before])).toEqual([
      'heaviest',
      'bestVolume',
    ]);
  });

  it('ne fête pas les reps quand il y a une charge à battre', () => {
    const before = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    // 12 reps au développé, c'est une série légère — pas un record.
    expect(kinds(aSet({ weight: 100, reps: 12, performedAt: 2_000 }), [before])).toEqual([
      'bestVolume',
    ]);
  });

  it('fête les reps quand il n’y a pas de charge du tout', () => {
    const before = aSet({ reps: 12, performedAt: 1_000 });
    const candidate = aSet({ reps: 14, performedAt: 2_000 });
    expect(recordsBeatenBy(candidate, [before])).toEqual([{ kind: 'mostReps', beaten: before }]);
  });

  it('ne fête pas la première charge posée sur un exercice au poids du corps', () => {
    const bodyweight = aSet({ reps: 12, performedAt: 1_000 });
    // Un lest de 10 kg ne bat aucune charge : il n'y en avait aucune.
    expect(kinds(aSet({ weight: 10, reps: 12, performedAt: 2_000 }), [bodyweight])).toEqual([]);
  });

  it('ne fête pas une charge à zéro', () => {
    const before = aSet({ weight: 0, reps: 10, performedAt: 1_000 });
    expect(kinds(aSet({ weight: 0, reps: 20, performedAt: 2_000 }), [before])).toEqual(['mostReps']);
  });

  it('ne fête rien sur un gainage : une durée n’est pas un record ici', () => {
    const before = aSet({ durationSeconds: 60, performedAt: 1_000 });
    expect(kinds(aSet({ durationSeconds: 90, performedAt: 2_000 }), [before])).toEqual([]);
  });
});
