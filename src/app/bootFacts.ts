import { CATALOGUE_SIZE } from '@/data/seed/seedDatabase';
import { calculateDeloadWeight, DELOAD_PERCENT } from '@/lib/deload';
import { estimateOneRepMax } from '@/lib/oneRepMax';
import { computePlateLoad, DEFAULT_BARBELL_KG, DEFAULT_PLATES_KG } from '@/lib/plates';
import { setVolume } from '@/lib/records';
import { DEFAULT_REST_SECONDS, formatRest } from '@/lib/rest';
import {
  calculateWarmupSets,
  DEFAULT_WARMUP_INCREMENT_KG,
  DEFAULT_WARMUP_STEPS,
} from '@/lib/warmup';
import { buildBootScript, type BootFacts, type BootProbe, type BootScript } from './bootTty1Script';
import { APP_VERSION } from './version';

/**
 * Ce que l'ouverture TTY1 raconte, lu là où c'est vrai : dans les constantes et les fonctions de
 * l'app, pas dans des phrases écrites une fois et jamais relues. Le catalogue compte ce qu'il
 * compte, le repos par défaut dure ce qu'il dure, et la fonction qu'attend l'écran est appelée pour
 * de bon — son résultat est celui de la bibliothèque, au chiffre près.
 *
 * Séparé de `bootTty1Script.ts`, qui est pur : c'est ici que se lit `navigator`, et ici que se
 * branchent les bibliothèques. L'ouverture ne lit jamais la base : elle est tirée avant qu'elle
 * ne réponde.
 */

/** Ce que l'appareil sait de lui-même. Tout est facultatif : un navigateur peut ne rien dire. */
export interface BootEnvironment {
  hardwareConcurrency?: number;
  screen?: { width: number; height: number };
  onLine?: boolean;
}

export function readBootEnvironment(): BootEnvironment {
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    screen: { width: window.screen.width, height: window.screen.height },
    onLine: navigator.onLine,
  };
}

const isPositiveInteger = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value > 0;

export function readBootFacts(
  now: number,
  environment: BootEnvironment = readBootEnvironment(),
): BootFacts {
  const { screen } = environment;
  const known =
    screen !== undefined &&
    Number.isFinite(screen.width) &&
    Number.isFinite(screen.height) &&
    screen.width > 0 &&
    screen.height > 0;

  return {
    now,
    version: APP_VERSION,
    catalogueSize: CATALOGUE_SIZE,
    restSeconds: DEFAULT_REST_SECONDS,
    deloadPercent: DELOAD_PERCENT,
    barbellKg: DEFAULT_BARBELL_KG,
    plateSizes: DEFAULT_PLATES_KG.length,
    warmupSteps: DEFAULT_WARMUP_STEPS.length,
    // Un chiffre que l'appareil ne donne pas, ou donne faux (0 cœur, un écran de 0 px que jsdom
    // annonce), est un fait qu'on ne dit pas : la ligne qui le citait est écartée du tirage.
    ...(isPositiveInteger(environment.hardwareConcurrency)
      ? { cores: environment.hardwareConcurrency }
      : {}),
    ...(known ? { screen: { width: screen.width, height: screen.height } } : {}),
    ...(typeof environment.onLine === 'boolean' ? { online: environment.onLine } : {}),
    probes: runBootProbes(),
  };
}

/** Une fonction de l'app que l'ouverture appelle, avec des arguments fixes. */
export interface BootProbeSource {
  /** Le nom exact de la fonction exportée : `bootFacts.test.ts` vérifie qu'elle existe. */
  name: string;
  /** Appelle la fonction et met son résultat en forme ; `undefined` si elle n'a rien répondu. */
  run: () => string | undefined;
}

/**
 * Les six fonctions de la porte, choisies pour leur résultat qui tient en quelques caractères et
 * dit quelque chose d'un coup d'œil : un 1RM, une charge de plaques, un échauffement, un deload,
 * un temps de repos, un tonnage. Toutes pures, toutes déjà dans le paquet principal.
 *
 * Les noms sont écrits en clair parce que le paquet de production renomme les fonctions :
 * `estimateOneRepMax.name` y vaudrait `a`. Le test relit chacun contre l'export réel.
 */
export const BOOT_PROBES: readonly BootProbeSource[] = [
  {
    name: 'estimateOneRepMax',
    run: () => {
      const estimate = estimateOneRepMax(100, 5, 'epley');
      return estimate === undefined ? undefined : `${estimate.toFixed(1)} kg`;
    },
  },
  {
    name: 'computePlateLoad',
    run: () => {
      const { perSide } = computePlateLoad(100);
      return perSide.length === 0
        ? undefined
        : `${perSide.map(({ weight, count }) => (count > 1 ? `${count}x${weight}` : weight)).join('+')} /side`;
    },
  },
  {
    name: 'calculateWarmupSets',
    run: () => {
      const sets = calculateWarmupSets({
        targetWeightKg: 100,
        incrementKg: DEFAULT_WARMUP_INCREMENT_KG,
        steps: DEFAULT_WARMUP_STEPS,
      });
      return sets.length === 0 ? undefined : sets.map((set) => set.weightKg).join('/');
    },
  },
  { name: 'calculateDeloadWeight', run: () => `${calculateDeloadWeight(100)} kg` },
  { name: 'formatRest', run: () => formatRest(DEFAULT_REST_SECONDS) },
  { name: 'setVolume', run: () => `${setVolume({ weight: 100, reps: 5 })} kg` },
];

/**
 * Appelle chaque fonction, dans son propre `try` : une qui lève ou ne répond rien sort du tirage, et
 * l'ouverture continue avec les autres. Ce que l'écran raconte ne doit jamais l'empêcher de s'ouvrir.
 */
export function runBootProbes(sources: readonly BootProbeSource[] = BOOT_PROBES): BootProbe[] {
  return sources.flatMap((source) => {
    try {
      const result = source.run();
      return result === undefined || result === '' ? [] : [{ call: `${source.name}()`, result }];
    } catch {
      return [];
    }
  });
}

/**
 * Le script de l'ouverture TTY1, tiré avec les vrais faits — ou `undefined` si quoi que ce soit
 * a levé. L'ouverture est un agrément : un démarrage qui lève laisserait un écran blanc là où
 * l'app devrait être, et `main.tsx` retombe alors sur l'ouverture normale.
 */
export function drawBootScript(
  random: () => number,
  now: number,
  environment?: BootEnvironment,
): BootScript | undefined {
  try {
    return buildBootScript(random, readBootFacts(now, environment));
  } catch (error) {
    console.error('L’ouverture TTY1 n’a pas pu être tirée', error);
    return undefined;
  }
}
