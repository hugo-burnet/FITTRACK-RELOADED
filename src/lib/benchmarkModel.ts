import type { ExerciseClass } from '@/lib/exerciseClass';

/**
 * Le modèle du benchmark : du maximum d'une série à la charge de travail d'une fourchette, tenue sur plusieurs
 * séries (spec benchmark, §3). Des nombres en entrée, des nombres en sortie — la lecture d'une séance de
 * benchmark, ses verdicts et ses propositions sont dans `benchmark`.
 *
 * **Une seule formule : Epley.** Pas celle des réglages. Le benchmark convertit une série en une
 * autre, d'un nombre de répétitions à un autre, et les trois formules de 1RM ne s'accordent qu'entre
 * 1 et 12 répétitions : au-delà, Brzycki s'effondre et Lombardi s'aplatit. Or la personne qui fait des
 * séries de 15, de 18 ou de 20 est précisément au-delà. Epley reste lisible jusqu'à une trentaine de
 * répétitions et son inverse est exact ; c'est déjà la règle du coach pour le cran (`repsToAbsorbStep`) :
 * un choix de produit, pas une mesure.
 *
 * **Plusieurs séries, une fatigue.** Le benchmark mesure la *première* série, à fond. Or une charge de
 * travail se tient sur plusieurs : à charge égale, chaque série de plus perd une part φ de ce que la
 * précédente permettait (`setFatigue`). On cherche donc la charge dont la **dernière** série garde, au bas
 * de la fourchette, deux répétitions en réserve : la première doit pouvoir faire
 * `(bas + 2) / (1 − φ)^(x − 1)` répétitions, `x` étant le nombre de séries (`capacityForSets`), et la
 * charge est celle qui tient cette capacité sur le max mesuré. Avec une seule série, φ ne compte plus et
 * l'on retrouve « bas + 2 ».
 *
 * Les constantes de ce module — la fatigue, la réserve, le plafond de séries, les séries par défaut — sont
 * des choix de produit à juger à l'usage, pas des mesures.
 */

/**
 * Les répétitions qu'on garde en réserve au bas de la fourchette, **à la dernière série**. Un maximum
 * dit ce que la personne peut faire *une fois, à fond* ; une série de travail s'arrête deux répétitions
 * avant l'échec, et la double progression a ensuite de la place pour monter avant de devoir ajouter du
 * poids.
 */
export const BENCHMARK_RESERVE_REPS = 2;

/** La fourchette quand la routine n'en porte pas d'exploitable : le « 8 – 12 » usuel. */
export const BENCHMARK_DEFAULT_ZONE: RepZone = { low: 8, high: 12 };

/** Au-delà, la série est trop légère pour dire quoi que ce soit : Epley n'est plus une estimation. */
export const BENCHMARK_MAX_REPS = 30;

/**
 * La part de la capacité qu'une série de plus fait perdre, à charge égale, pour un polyarticulaire reposé
 * deux minutes : 10 % de répétitions en moins d'une série à la suivante (12, 11, 10 à la même charge). Une
 * isolation fatigue moins le corps, un repos court fatigue plus — cf. `setFatigue`.
 */
const SET_FATIGUE = 0.1;

/** La fatigue d'une isolation, relativement à un polyarticulaire : un muscle seul, peu de fatigue générale. */
const ISOLATION_FATIGUE_FACTOR = 0.8;

/** Le repos auquel `SET_FATIGUE` est calé : celui qu'on compte quand l'exercice n'en dit pas. */
const REFERENCE_REST_SECONDS = 120;

/** Les bornes du facteur de repos : au plus le double de la fatigue de référence, au moins six dixièmes. */
const REST_FACTOR_MIN = 0.6;
const REST_FACTOR_MAX = 2;

/**
 * Au-delà de six séries à charge égale, personne ne les mène toutes près de l'échec : le modèle de fatigue
 * n'est plus une estimation, et la capacité exigée de la première série sortirait du domaine d'Epley.
 */
export const BENCHMARK_MAX_PLANNED_SETS = 6;

/**
 * Le nombre de séries à compter quand la routine n'en porte aucune de travail (un échauffement seul, ou
 * l'exercice a quitté la routine). Un ordre de grandeur courant, pas une règle : trois séries pour un
 * polyarticulaire, deux pour une isolation.
 */
export const BENCHMARK_DEFAULT_SETS: Readonly<Record<ExerciseClass, number>> = {
  compound: 3,
  isolation: 2,
};

/** La fourchette de répétitions d'un exercice dans la routine : de `low` à `high`, bornes comprises. */
export interface RepZone {
  low: number;
  high: number;
}

const isRepCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 1;

/**
 * La fourchette que la routine prescrit : « 8 – 12 », « 15 – 20 », ou une cible unique (« 20 » est une
 * fourchette d'un seul point). Un haut sous le bas n'est pas une fourchette ; sans bas exploitable on
 * retombe sur 8 – 12.
 */
export function repZone(targetReps?: number, targetRepsMax?: number): RepZone {
  if (!isRepCount(targetReps)) return { ...BENCHMARK_DEFAULT_ZONE };
  const high = isRepCount(targetRepsMax) && targetRepsMax > targetReps ? targetRepsMax : targetReps;
  return { low: targetReps, high };
}

/** Le max (1RM) que dit une série de `reps` répétitions à `weightKg`, par Epley, de 1 à 30 répétitions. */
export function oneRepMaxOf(weightKg: number, reps: number): number | undefined {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > BENCHMARK_MAX_REPS
  ) {
    return undefined;
  }
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * La charge à laquelle un max de `oneRepMax` tient `reps` répétitions : l'inverse exact d'`oneRepMaxOf`.
 *
 * `reps` n'est pas forcément entier : une série en compte un nombre entier, mais la capacité qu'on exige
 * de la première série (`capacityForSets`) est une grandeur, pas un compte — 12,3 répétitions, c'est une
 * charge entre celle de 12 et celle de 13.
 */
export function loadForReps(oneRepMax: number, reps: number): number | undefined {
  if (
    !Number.isFinite(oneRepMax) ||
    oneRepMax <= 0 ||
    !Number.isFinite(reps) ||
    reps < 1 ||
    reps > BENCHMARK_MAX_REPS
  ) {
    return undefined;
  }
  return reps === 1 ? oneRepMax : oneRepMax / (1 + reps / 30);
}

/**
 * La part de la capacité qu'une série de plus fait perdre à charge égale : 10 % pour un polyarticulaire reposé
 * deux minutes, 8 % pour une isolation, et d'autant plus que le repos est court (le double au plus à une minute,
 * six dixièmes au moins à trois minutes passées).
 *
 * Un repos inconnu ou absurde (zéro, négatif, pas un nombre) compte pour deux minutes : la fatigue de référence,
 * ni plus ni moins.
 */
export function setFatigue(klass: ExerciseClass, restSeconds?: number): number {
  const rest =
    restSeconds !== undefined && Number.isFinite(restSeconds) && restSeconds > 0
      ? restSeconds
      : REFERENCE_REST_SECONDS;
  const restFactor = Math.min(REST_FACTOR_MAX, Math.max(REST_FACTOR_MIN, REFERENCE_REST_SECONDS / rest));
  return SET_FATIGUE * (klass === 'isolation' ? ISOLATION_FATIGUE_FACTOR : 1) * restFactor;
}

/**
 * Sur combien de séries la charge doit tenir : celles de travail de la routine, six au plus.
 *
 * - **Une pyramide compte pour une série.** Dès que les séries de travail portent deux charges différentes, la
 *   routine ne dit pas « la même charge, plusieurs fois » : la première est dimensionnée pour elle-même, les
 *   autres suivent du même écart (c'est ce que fait l'écriture). Une série sans charge ne fait pas une pyramide.
 * - **Rien dans la routine** (échauffement seul, exercice sorti de la routine) : le défaut de la classe.
 */
export function plannedSets(
  working: readonly { targetWeight?: number }[],
  klass: ExerciseClass,
): number {
  if (working.length === 0) return BENCHMARK_DEFAULT_SETS[klass];
  const loads = new Set(working.flatMap((set) => (set.targetWeight === undefined ? [] : [set.targetWeight])));
  if (loads.size > 1) return 1;
  return Math.min(working.length, BENCHMARK_MAX_PLANNED_SETS);
}

/**
 * Les répétitions que la **première** série doit pouvoir faire, à fond, pour que la dernière des `sets` tienne
 * le bas de la fourchette avec la réserve : `(bas + réserve) / (1 − fatigue)^(sets − 1)`, sans sortir du domaine
 * de la formule. Pour une seule série c'est « bas + réserve » — 10 pour un 8 – 12, 17 pour un 15 – 20, 22 pour
 * un 20 ; pour trois séries à 10 % de fatigue, un 8 – 12 exige 12,3.
 *
 * Quand la capacité exigée dépasse la trentaine de répétitions que sait dire la formule, on la plafonne : la
 * charge qui en sort est la plus légère que le benchmark sache proposer, et la dernière série garde alors moins
 * que la réserve.
 *
 * Un bas inutilisable est lu comme le bas de 8 – 12 ; un nombre de séries inutilisable comme une seule.
 */
export function capacityForSets(lowReps: number | undefined, sets: number, fatigue: number): number {
  const low = isRepCount(lowReps) ? lowReps : BENCHMARK_DEFAULT_ZONE.low;
  const count = Number.isInteger(sets) && sets >= 1 ? Math.min(sets, BENCHMARK_MAX_PLANNED_SETS) : 1;
  const lastSet = low + BENCHMARK_RESERVE_REPS;
  return Math.min(BENCHMARK_MAX_REPS, lastSet / (1 - fatigue) ** (count - 1));
}
