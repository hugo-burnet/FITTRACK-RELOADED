import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_DEFAULT_SETS,
  BENCHMARK_GOALS,
  BENCHMARK_MAX_JUMP,
  BENCHMARK_MAX_PLANNED_SETS,
  BENCHMARK_MAX_REPS,
  capacityForSets,
  goalZone,
  loadForRange,
  loadForReps,
  oneRepMaxOf,
  plannedSets,
  repsHeldAt,
  repZone,
  setFatigue,
} from './benchmarkModel';

describe('oneRepMaxOf / loadForReps', () => {
  it('sont l’inverse l’un de l’autre, de 1 à 30 répétitions', () => {
    for (let reps = 1; reps <= BENCHMARK_MAX_REPS; reps += 1) {
      const max = oneRepMaxOf(100, reps);
      expect(max).toBeDefined();
      expect(loadForReps(max!, reps)).toBeCloseTo(100, 8);
    }
  });

  it('donnent des valeurs connues : 100 kg × 20 est un max de 166,7 kg, et un max de 120 kg tient 10 à 90 kg', () => {
    expect(oneRepMaxOf(100, 20)).toBeCloseTo(166.6667, 3);
    expect(loadForReps(120, 10)).toBeCloseTo(90, 8);
  });

  it('lisent un single comme le max lui-même', () => {
    expect(oneRepMaxOf(137.5, 1)).toBe(137.5);
    expect(loadForReps(137.5, 1)).toBe(137.5);
  });

  it('refusent ce que la formule ne couvre pas', () => {
    expect(oneRepMaxOf(100, 0)).toBeUndefined();
    expect(oneRepMaxOf(100, BENCHMARK_MAX_REPS + 1)).toBeUndefined();
    expect(oneRepMaxOf(100, 2.5)).toBeUndefined();
    expect(oneRepMaxOf(0, 5)).toBeUndefined();
    expect(oneRepMaxOf(-10, 5)).toBeUndefined();
    expect(oneRepMaxOf(Number.NaN, 5)).toBeUndefined();
    expect(loadForReps(100, 0.5)).toBeUndefined();
    expect(loadForReps(100, BENCHMARK_MAX_REPS + 1)).toBeUndefined();
    expect(loadForReps(0, 5)).toBeUndefined();
    expect(loadForReps(100, Number.NaN)).toBeUndefined();
  });

  it('lit une capacité qui n’est pas un nombre entier : une série n’en compte pas, la capacité qu’on vise, si', () => {
    // 140 / (1 + 12,5/30) = 98,82 — la charge d'une série de douze répétitions et demie.
    expect(loadForReps(140, 12.5)).toBeCloseTo(98.8235, 3);
    expect(loadForReps(140, 12.5)!).toBeLessThan(loadForReps(140, 12)!);
  });
});

describe('setFatigue — la part de la capacité perdue à chaque série de plus, à charge égale', () => {
  it('vaut 10 % pour un polyarticulaire avec deux minutes de repos, 8 % pour une isolation', () => {
    expect(setFatigue('compound', 120)).toBeCloseTo(0.1, 10);
    expect(setFatigue('isolation', 120)).toBeCloseTo(0.08, 10);
  });

  it('monte quand le repos raccourcit, descend quand il s’allonge, et reste dans ses bornes', () => {
    expect(setFatigue('compound', 60)).toBeCloseTo(0.2, 10);
    expect(setFatigue('compound', 90)).toBeCloseTo(0.1333, 3);
    expect(setFatigue('compound', 180)).toBeCloseTo(0.0667, 3);
    // Les bornes : au plus le double, au moins six dixièmes.
    expect(setFatigue('compound', 20)).toBeCloseTo(0.2, 10);
    expect(setFatigue('compound', 600)).toBeCloseTo(0.06, 10);
  });

  it('compte deux minutes quand le repos n’est pas connu, ou n’a pas de sens', () => {
    expect(setFatigue('compound', undefined)).toBeCloseTo(0.1, 10);
    expect(setFatigue('compound', 0)).toBeCloseTo(0.1, 10);
    expect(setFatigue('compound', -30)).toBeCloseTo(0.1, 10);
    expect(setFatigue('compound', Number.NaN)).toBeCloseTo(0.1, 10);
  });
});

describe('plannedSets — sur combien de séries la charge doit tenir', () => {
  const sets = (...weights: (number | undefined)[]) => weights.map((targetWeight) => ({ targetWeight }));

  it('compte les séries de travail de la routine', () => {
    expect(plannedSets(sets(70, 70, 70), 'compound')).toBe(3);
    expect(plannedSets(sets(70, 70), 'isolation')).toBe(2);
    expect(plannedSets(sets(undefined, undefined, undefined, undefined), 'compound')).toBe(4);
    expect(plannedSets(sets(70), 'compound')).toBe(1);
  });

  it('lit une pyramide comme une série seule : la première est dimensionnée pour elle-même, les autres suivent', () => {
    expect(plannedSets(sets(60, 70, 80), 'compound')).toBe(1);
    // Deux charges suffisent, dans un sens comme dans l'autre : une montée de 60 à 70, ou une série lourde
    // suivie de séries plus légères.
    expect(plannedSets(sets(60, 70), 'compound')).toBe(1);
    expect(plannedSets(sets(80, 70, 70), 'compound')).toBe(1);
    // Une série sans charge ne fait pas une pyramide.
    expect(plannedSets(sets(70, undefined, 70), 'compound')).toBe(3);
  });

  it('ne compte pas une série dégressive, et elle ne fait pas une pyramide', () => {
    const straight = [70, 70, 70].map((targetWeight) => ({ targetWeight, setType: 'normal' as const }));
    const drop = { targetWeight: 55, setType: 'dropset' as const };

    // Trois séries à 70 kg puis une dégressive à 55 : trois séries à tenir, pas une « pyramide ».
    expect(plannedSets([...straight, drop], 'compound')).toBe(3);
    expect(plannedSets([...straight.slice(0, 2), drop], 'compound')).toBe(2);
    // Et une routine qui ne serait que dégressives retombe sur le défaut de sa classe.
    expect(plannedSets([drop, drop], 'isolation')).toBe(BENCHMARK_DEFAULT_SETS.isolation);
  });

  it('plafonne : au-delà de six séries à charge égale, personne ne les mène toutes près de l’échec', () => {
    expect(plannedSets(sets(...Array.from({ length: 10 }, () => 50)), 'compound')).toBe(
      BENCHMARK_MAX_PLANNED_SETS,
    );
  });

  it('retombe sur trois séries pour un polyarticulaire et deux pour une isolation quand la routine n’en dit rien', () => {
    expect(plannedSets([], 'compound')).toBe(BENCHMARK_DEFAULT_SETS.compound);
    expect(plannedSets([], 'isolation')).toBe(BENCHMARK_DEFAULT_SETS.isolation);
    expect(BENCHMARK_DEFAULT_SETS).toEqual({ compound: 3, isolation: 2 });
  });
});

describe('capacityForSets — ce que la première série doit pouvoir faire pour que la dernière tienne le bas de la fourchette', () => {
  it('vaut le bas de fourchette plus la réserve pour une seule série', () => {
    expect(capacityForSets(8, 1, 0.1)).toBe(10);
    expect(capacityForSets(5, 1, 0.1)).toBe(7);
    // Les fourchettes hautes : un 15 – 20 se dimensionne sur 17, un 18 sur 20, un 20 sur 22.
    expect(capacityForSets(15, 1, 0.1)).toBe(17);
    expect(capacityForSets(18, 1, 0.1)).toBe(20);
    expect(capacityForSets(20, 1, 0.1)).toBe(22);
  });

  it('grandit à chaque série de plus : la dernière tient le bas, avec la réserve, malgré la fatigue des précédentes', () => {
    // (8 + 2) / 0,9^(x − 1)
    expect(capacityForSets(8, 2, 0.1)).toBeCloseTo(11.1111, 3);
    expect(capacityForSets(8, 3, 0.1)).toBeCloseTo(12.3457, 3);
    expect(capacityForSets(8, 4, 0.1)).toBeCloseTo(13.7174, 3);
    expect(capacityForSets(5, 5, 0.1)).toBeCloseTo(10.6691, 3);
  });

  it('ne grandit pas sans fatigue', () => {
    expect(capacityForSets(8, 5, 0)).toBe(10);
  });

  it('ne dépasse pas le domaine de la formule', () => {
    expect(capacityForSets(29, 1, 0.1)).toBe(BENCHMARK_MAX_REPS);
    expect(capacityForSets(40, 1, 0.1)).toBe(BENCHMARK_MAX_REPS);
    expect(capacityForSets(25, 6, 0.2)).toBe(BENCHMARK_MAX_REPS);
  });

  it('ne compte pas plus de six séries', () => {
    expect(capacityForSets(8, 10, 0.1)).toBeCloseTo(capacityForSets(8, BENCHMARK_MAX_PLANNED_SETS, 0.1), 10);
    expect(capacityForSets(8, 7, 0.1)).toBeCloseTo(16.9351, 3);
  });

  it('lit un nombre de séries inutilisable comme une série, et un bas inutilisable comme le bas de 8 – 12', () => {
    expect(capacityForSets(8, 0, 0.1)).toBe(10);
    expect(capacityForSets(8, Number.NaN, 0.1)).toBe(10);
    expect(capacityForSets(8, 2.5, 0.1)).toBe(10);
    expect(capacityForSets(undefined, 1, 0.1)).toBe(10);
    expect(capacityForSets(0, 1, 0.1)).toBe(10);
    expect(capacityForSets(-3, 1, 0.1)).toBe(10);
    expect(capacityForSets(6.5, 1, 0.1)).toBe(10);
  });
});

describe('repZone', () => {
  it('lit la fourchette de la routine, quelle qu’elle soit', () => {
    expect(repZone(8, 12)).toEqual({ low: 8, high: 12 });
    expect(repZone(15, 20)).toEqual({ low: 15, high: 20 });
    expect(repZone(18, 25)).toEqual({ low: 18, high: 25 });
  });

  it('lit une cible unique comme une fourchette d’un seul point', () => {
    expect(repZone(5, undefined)).toEqual({ low: 5, high: 5 });
    expect(repZone(20, 20)).toEqual({ low: 20, high: 20 });
  });

  it('ne laisse pas un haut sous le bas', () => {
    expect(repZone(10, 8)).toEqual({ low: 10, high: 10 });
  });

  it('retombe sur 8 – 12 quand la routine n’en dit rien d’exploitable', () => {
    expect(repZone(undefined, undefined)).toEqual({ low: 8, high: 12 });
    expect(repZone(0, 5)).toEqual({ low: 8, high: 12 });
    expect(repZone(-3, undefined)).toEqual({ low: 8, high: 12 });
    expect(repZone(6.5, 8)).toEqual({ low: 8, high: 12 });
  });
});

describe('goalZone — le style qu’on choisit au lancement', () => {
  it('range chaque style dans sa fourchette : léger 15 – 20, classique 8 – 12, lourd 5 – 8', () => {
    expect(goalZone('light')).toEqual({ low: 15, high: 20 });
    expect(goalZone('classic')).toEqual({ low: 8, high: 12 });
    expect(goalZone('heavy')).toEqual({ low: 5, high: 8 });
  });

  it('donne une copie : la modifier ne change pas le style', () => {
    const zone = goalZone('classic');
    zone.high = 99;
    expect(goalZone('classic')).toEqual({ low: 8, high: 12 });
  });

  it('liste les trois styles, du plus courant au plus rare', () => {
    expect(BENCHMARK_GOALS).toEqual(['classic', 'light', 'heavy']);
  });
});

describe('repsHeldAt — ce que chaque série tient à fond à une charge donnée', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt) : un max de 64 kg est une série de
  // 21,1 répétitions à 37,5 kg, et chaque série de plus en perd 10 %.
  it('compte les répétitions que tient chacune des séries, la fatigue en moins à chaque fois', () => {
    expect(repsHeldAt(64, 37.5, 3, 0.1)).toEqual([21, 19, 17]);
    expect(repsHeldAt(75.25, 52.5, 3, 0.1)).toEqual([13, 11, 10]);
    expect(repsHeldAt(116.67, 95, 3, 0.1)).toEqual([6, 6, 5]);
    expect(repsHeldAt(116.67, 90, 3, 0.1)).toEqual([8, 8, 7]);
  });

  it('ne perd pas une répétition à une erreur d’arrondi : 100 × 5 tient exactement 8 puis 8 à 90 kg', () => {
    // 100 × (1 + 5/30) = 116,666… ; à 90 kg la première série en tient 8,888…, la deuxième 8,888… × 0,9 = 8
    // pile — et la virgule flottante peut en faire 7,999…, qui retomberait à 7.
    expect(repsHeldAt(100 * (1 + 5 / 30), 90, 3, 0.1)).toEqual([8, 8, 7]);
  });

  it('arrondit vers le bas : le bilan ne promet jamais une répétition de plus que le modèle', () => {
    // 52,5 kg tient 13,0 puis 11,7 puis 10,5 répétitions.
    expect(repsHeldAt(75.25, 52.5, 3, 0.1)).toEqual([13, 11, 10]);
  });

  it('donne une seule valeur pour une seule série', () => {
    expect(repsHeldAt(104, 77.5, 1, 0.1)).toEqual([10]);
  });

  it('ne dépasse pas ce que la formule sait dire', () => {
    // Un max de 100 kg à 10 kg ferait 270 répétitions : la formule s'arrête à trente.
    expect(repsHeldAt(100, 10, 2, 0.1)).toEqual([BENCHMARK_MAX_REPS, 27]);
  });

  it('ne compte pas plus de six séries, et ne dit rien d’une charge qui n’en est pas une', () => {
    expect(repsHeldAt(104, 70, 9, 0.1)).toHaveLength(BENCHMARK_MAX_PLANNED_SETS);
    expect(repsHeldAt(104, 0, 3, 0.1)).toEqual([]);
    expect(repsHeldAt(0, 70, 3, 0.1)).toEqual([]);
    expect(repsHeldAt(104, Number.NaN, 3, 0.1)).toEqual([]);
  });

  it('lit un nombre de séries inutilisable comme une série', () => {
    expect(repsHeldAt(104, 77.5, 0, 0.1)).toEqual([10]);
    expect(repsHeldAt(104, 77.5, 2.5, 0.1)).toEqual([10]);
  });
});

describe('loadForRange — la charge qui remet un max dans une fourchette', () => {
  const grid = { kg: 2.5, onGrid: true };
  const typed = { kg: 2.5, onGrid: false };

  // Valeurs de référence calculées à part (script Python hors du dépôt).
  it('donne la charge qui tient les séries de la fourchette, arrondie vers le bas', () => {
    // Classique, 52,5 × 13 : un max de 75,25 kg ; trois séries d'un 8 – 12 → 53,3 → 52,5.
    expect(loadForRange(75.25, 8, 3, 0.1, 52.5, grid)).toBe(52.5);
    // Léger, 40 × 18 : un max de 64 kg ; trois séries d'un 15 – 20 → 37,7 → 37,5 (pas saisi, compté depuis 40).
    expect(loadForRange(64, 15, 3, 0.1, 40, typed)).toBe(37.5);
    // Lourd, 100 × 5 : un max de 116,7 kg ; trois séries d'un 5 – 8 → 90,6 → 90.
    expect(loadForRange(100 * (1 + 5 / 30), 5, 3, 0.1, 100, grid)).toBe(90);
  });

  it('monte avec le max : 40 kg × 30 (un max de 80 kg) tient un 15 – 20 sur trois séries à 45 kg', () => {
    expect(loadForRange(80, 15, 3, 0.1, 40, typed)).toBe(45);
  });

  it('rend 0 quand il n’y a pas de charge à proposer', () => {
    expect(loadForRange(0, 15, 3, 0.1, 40, typed)).toBe(0);
    expect(loadForRange(Number.NaN, 15, 3, 0.1, 40, typed)).toBe(0);
    // Un max sous le premier cran du matériel.
    expect(loadForRange(2, 8, 3, 0.1, 1, grid)).toBe(0);
  });

  it('plafonne le saut de charge qu’un seul essai justifie à 30 %', () => {
    expect(BENCHMARK_MAX_JUMP).toBe(0.3);
  });
});
