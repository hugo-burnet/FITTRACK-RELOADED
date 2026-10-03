import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGUE_SIZE } from '@/data/seed/seedDatabase';
import * as deload from '@/lib/deload';
import * as oneRepMax from '@/lib/oneRepMax';
import * as plates from '@/lib/plates';
import * as records from '@/lib/records';
import * as rest from '@/lib/rest';
import * as warmup from '@/lib/warmup';
import {
  BOOT_PROBES,
  drawBootScript,
  readBootEnvironment,
  readBootFacts,
  runBootProbes,
} from './bootFacts';
import { buildBootScript, seededRandom } from './bootTty1Script';
import { APP_VERSION } from './version';

const NOW = new Date(2026, 9, 3, 14, 7, 11).getTime();

const probeOf = (call: string) => runBootProbes().find((probe) => probe.call === call);

describe('the functions the opening waits on', () => {
  it('calls six functions of the app, each for a result', () => {
    const probes = runBootProbes();

    expect(probes.map((probe) => probe.call)).toEqual([
      'estimateOneRepMax()',
      'computePlateLoad()',
      'calculateWarmupSets()',
      'calculateDeloadWeight()',
      'formatRest()',
      'setVolume()',
    ]);
    for (const probe of probes) expect(probe.result).not.toBe('');
  });

  it('names functions that exist, so a rename shows up here rather than on the lifter’s screen', () => {
    const library: Record<string, unknown> = {
      ...oneRepMax,
      ...plates,
      ...warmup,
      ...deload,
      ...rest,
      ...records,
    };

    for (const { name } of BOOT_PROBES) expect(typeof library[name], name).toBe('function');
  });

  it('shows what the library answers, not what was once written down', () => {
    expect(probeOf('estimateOneRepMax()')?.result).toBe(
      `${oneRepMax.estimateOneRepMax(100, 5, 'epley')?.toFixed(1)} kg`,
    );
    expect(probeOf('calculateDeloadWeight()')?.result).toBe(
      `${deload.calculateDeloadWeight(100)} kg`,
    );
    expect(probeOf('formatRest()')?.result).toBe(rest.formatRest(rest.DEFAULT_REST_SECONDS));
    expect(probeOf('setVolume()')?.result).toBe(
      `${records.setVolume({ weight: 100, reps: 5 })} kg`,
    );
  });

  it('puts the plates of a 100 kg bar the way the plate calculator does', () => {
    const load = plates.computePlateLoad(100);
    const perSide = load.perSide.map(({ weight }) => weight).join('+');

    expect(probeOf('computePlateLoad()')?.result).toBe(`${perSide} /side`);
    expect(probeOf('computePlateLoad()')?.result).toBe('25+15 /side');
  });

  it('lists the warm-up weights the app would suggest for 100 kg', () => {
    const weights = warmup
      .calculateWarmupSets({
        targetWeightKg: 100,
        incrementKg: warmup.DEFAULT_WARMUP_INCREMENT_KG,
        steps: warmup.DEFAULT_WARMUP_STEPS,
      })
      .map((set) => set.weightKg)
      .join('/');

    expect(probeOf('calculateWarmupSets()')?.result).toBe(weights);
  });

  it('drops a function that throws or answers nothing, and keeps the others', () => {
    const probes = runBootProbes([
      {
        name: 'broken',
        run: () => {
          throw new RangeError('nope');
        },
      },
      { name: 'silent', run: () => undefined },
      { name: 'fine', run: () => '1' },
    ]);

    expect(probes).toEqual([{ call: 'fine()', result: '1' }]);
  });
});

describe('readBootFacts', () => {
  it('takes the app’s own numbers from the app', () => {
    const facts = readBootFacts(NOW, {});

    expect(facts).toMatchObject({
      now: NOW,
      version: APP_VERSION,
      catalogueSize: CATALOGUE_SIZE,
      restSeconds: rest.DEFAULT_REST_SECONDS,
      deloadPercent: deload.DELOAD_PERCENT,
      barbellKg: plates.DEFAULT_BARBELL_KG,
      plateSizes: plates.DEFAULT_PLATES_KG.length,
      warmupSteps: warmup.DEFAULT_WARMUP_STEPS.length,
    });
    expect(facts.probes.length).toBe(6);
  });

  it('reads the device when the device says it', () => {
    expect(
      readBootFacts(NOW, {
        hardwareConcurrency: 8,
        screen: { width: 390, height: 844 },
        onLine: false,
      }),
    ).toMatchObject({ cores: 8, screen: { width: 390, height: 844 }, online: false });
  });

  it.each([0, -1, Number.NaN, 2.5])('does not believe %s cores', (cores) => {
    expect(readBootFacts(NOW, { hardwareConcurrency: cores }).cores).toBeUndefined();
  });

  it.each([
    { width: 0, height: 0 },
    { width: 390, height: 0 },
    { width: Number.NaN, height: 800 },
  ])('does not believe a %j screen', (screen) => {
    expect(readBootFacts(NOW, { screen }).screen).toBeUndefined();
  });

  it('leaves out what the device does not say', () => {
    const facts = readBootFacts(NOW, {});

    expect(facts.cores).toBeUndefined();
    expect(facts.screen).toBeUndefined();
    expect(facts.online).toBeUndefined();
  });
});

describe('readBootEnvironment', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the navigator and the screen it runs on', () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(6);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(window.screen, 'width', 'get').mockReturnValue(412);
    vi.spyOn(window.screen, 'height', 'get').mockReturnValue(915);

    expect(readBootEnvironment()).toEqual({
      hardwareConcurrency: 6,
      screen: { width: 412, height: 915 },
      onLine: false,
    });
  });
});

describe('the real facts, in the script', () => {
  it('fit the screen: the width guard drops none of the six functions', () => {
    const facts = readBootFacts(NOW, {
      hardwareConcurrency: 8,
      screen: { width: 390, height: 844 },
      onLine: true,
    });
    const called = new Set<string>();

    for (let seed = 1; seed <= 300; seed += 1) {
      const gate = buildBootScript(seededRandom(seed), facts).lines.find(
        (line) => line.kind === 'gate',
      );
      if (gate?.kind === 'gate') called.add(gate.waiting);
    }

    expect(called.size).toBe(BOOT_PROBES.length);
  });
});

describe('drawBootScript', () => {
  it('draws a script from the real facts', () => {
    const script = drawBootScript(seededRandom(5), NOW, { onLine: true });

    expect(script?.lines.length).toBeGreaterThan(20);
    expect(script?.lines.some((line) => line.kind === 'gate')).toBe(true);
  });

  it('gives back nothing, not an exception, when the facts cannot be read', () => {
    // The opening is a nicety: a boot that throws would leave the lifter with a blank screen where
    // the app should be. The caller falls back to the normal opening.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hostile = {
      get hardwareConcurrency(): number {
        throw new Error('no device');
      },
    };

    expect(drawBootScript(seededRandom(5), NOW, hostile)).toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
