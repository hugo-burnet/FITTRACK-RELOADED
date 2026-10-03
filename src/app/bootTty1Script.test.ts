import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/fr';
import {
  buildBootScript,
  seededRandom,
  TTY1_BOOT_MS,
  TYPING_MS_PER_CHAR,
  type BootFacts,
  type BootLine,
} from './bootTty1Script';

/** Local time, so what the script prints does not depend on the machine's time zone. */
const NOW = new Date(2026, 9, 3, 14, 7, 11).getTime();

const FACTS: BootFacts = {
  now: NOW,
  version: '2.8.0',
  catalogueSize: 1247,
  restSeconds: 120,
  deloadPercent: 80,
  barbellKg: 20,
  plateSizes: 10,
  warmupSteps: 3,
  cores: 8,
  screen: { width: 390, height: 844 },
  online: false,
  probes: [
    { call: 'estimateOneRepMax()', result: '116.7 kg' },
    { call: 'computePlateLoad()', result: '25+15 /side' },
    { call: 'calculateWarmupSets()', result: '40/60/80' },
    { call: 'calculateDeloadWeight()', result: '80 kg' },
    { call: 'formatRest()', result: '2:00' },
    { call: 'setVolume()', result: '500' },
  ],
};

const build = (seed: number, facts: BootFacts = FACTS) =>
  buildBootScript(seededRandom(seed), facts);

const SEEDS = Array.from({ length: 300 }, (_, index) => index + 1);

/** What a line puts on screen, as one string, the way the renderer lays it out. */
function printed(line: BootLine): string {
  switch (line.kind) {
    case 'text':
    case 'comment':
      return line.text;
    case 'command':
      return `${line.prompt} ${line.text}`;
    case 'gate':
      // The spinner and its brackets take 8 characters and a space, `[*     ] `.
      return `[*     ] ${line.waiting}`;
  }
}

const texts = (lines: readonly BootLine[]) =>
  lines.flatMap((line) => (line.kind === 'text' ? [line.text] : []));

describe('seededRandom', () => {
  it('replays the same sequence from the same seed', () => {
    const first = seededRandom(42);
    const second = seededRandom(42);

    expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second));
  });

  it('spreads the first draw of neighbouring seeds over the whole range', () => {
    // `?bootSeed=1`, `?bootSeed=2`… are what one types to look at several boots: they must not
    // all start the same way.
    const buckets = new Set(
      Array.from({ length: 64 }, (_, seed) => Math.floor(seededRandom(seed + 1)() * 8)),
    );

    expect(buckets.size).toBe(8);
  });

  it('stays in [0, 1[ and does not repeat itself across seeds', () => {
    const values = Array.from({ length: 2000 }, seededRandom(7));

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('buildBootScript', () => {
  it('draws the same boot from the same seed', () => {
    expect(build(7)).toEqual(build(7));
  });

  it('draws different boots from different seeds', () => {
    const distinct = new Set(SEEDS.slice(0, 20).map((seed) => JSON.stringify(build(seed))));

    expect(distinct.size).toBeGreaterThanOrEqual(18);
  });

  it('opens on the boot loader, whose kernel is named from the list', () => {
    const lines = build(3).lines;

    expect(lines[0]).toMatchObject({ kind: 'text', text: t('boot.tty1.grubTitle') });
    expect(lines[1]).toMatchObject({ kind: 'text', text: t('boot.tty1.grubEntry') });
    expect(printed(lines[2]!)).toMatch(/^Loading Linux 6\.1\.0-[a-z]+ \.\.\.$/);
    expect(lines[3]).toMatchObject({ kind: 'text', text: t('boot.tty1.grubInitrd') });
  });

  it('prints the machine clock from the time it was given', () => {
    const clock = texts(build(3).lines).find((text) => text.includes('rtc:'));

    expect(clock).toMatch(/^\[ +\d+\.\d\d\] rtc: 2026-10-03 14:07:11$/);
  });

  it('keeps the four lines of the rare console, in their order, among the others', () => {
    const wanted = [
      t('boot.consoleQuadriceps'),
      t('boot.consoleCore'),
      t('boot.consoleEgo'),
      t('boot.consoleExcuses'),
    ];

    for (const seed of SEEDS.slice(0, 60)) {
      const found = texts(build(seed).lines);
      const positions = wanted.map((line) => found.indexOf(line));

      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  it('mixes the services: the console’s four lines are not always side by side', () => {
    const wanted = t('boot.consoleQuadriceps');
    const gaps = new Set(
      SEEDS.slice(0, 60).map((seed) => {
        const found = texts(build(seed).lines);
        return found.indexOf(t('boot.consoleCore')) - found.indexOf(wanted);
      }),
    );

    expect(gaps.size).toBeGreaterThan(1);
  });

  it('puts three colours of status among the services', () => {
    const found = texts(build(11).lines);

    for (const level of ['[ OK ]', '[ WARN ]', '[ FAIL ]']) {
      expect(found.some((text) => text.startsWith(level))).toBe(true);
    }
  });

  it('ends on the gate, the target, the prompt and the motto, in that order', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const tail = build(seed).lines.slice(-4);

      expect(tail[0]!.kind).toBe('gate');
      expect(tail[1]).toMatchObject({ kind: 'text', text: t('boot.tty1.target') });
      expect(tail[2]).toMatchObject({
        kind: 'command',
        prompt: t('boot.consolePrompt'),
        text: t('boot.consoleCommand'),
      });
      expect(tail[3]).toMatchObject({ kind: 'comment', text: `# ${t('app.tagline')}` });
    }
  });

  it('waits on a real function and validates it with the result it gave', () => {
    const gate = build(5).lines.find((line) => line.kind === 'gate');

    expect(gate).toBeDefined();
    if (gate?.kind !== 'gate') return;
    const probe = FACTS.probes.find((candidate) => gate.waiting.includes(candidate.call));

    expect(probe).toBeDefined();
    expect(gate.waiting).toBe(t('boot.tty1.gateWaiting', { call: probe!.call }));
    expect(gate.done).toBe(t('boot.tty1.gateDone', { call: probe!.call, result: probe!.result }));
  });

  it('draws its gate from every function it was given', () => {
    const called = new Set(
      SEEDS.map((seed) => {
        const gate = build(seed).lines.find((line) => line.kind === 'gate');
        return gate?.kind === 'gate' ? gate.waiting : '';
      }),
    );

    expect(called.size).toBe(FACTS.probes.length);
  });

  it('never draws a function whose line would not fit the screen', () => {
    const long = { call: 'calculateWarmupSets()', result: '40 kg / 60 kg / 80 kg / 100 kg' };

    for (const seed of SEEDS.slice(0, 60)) {
      const lines = build(seed, { ...FACTS, probes: [long, FACTS.probes[0]!] }).lines;
      const gate = lines.find((line) => line.kind === 'gate');

      expect(gate?.kind === 'gate' ? gate.waiting : '').toContain('estimateOneRepMax()');
    }
  });

  it('puts the gate at the same instant every time, whatever else was drawn', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const gate = build(seed).lines.find((line) => line.kind === 'gate');

      expect(gate?.at).toBe(3150);
    }
  });

  it('has no gate, and still ends well, when no function could be called', () => {
    const lines = build(5, { ...FACTS, probes: [] }).lines;

    expect(lines.some((line) => line.kind === 'gate')).toBe(false);
    expect(lines.slice(-3).map((line) => line.kind)).toEqual(['text', 'command', 'comment']);
  });

  it('lays the lines out on a clock that only moves forward, inside the hold', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const script = build(seed);
      const times = script.lines.map((line) => line.at);

      expect(times[0]).toBeGreaterThanOrEqual(400);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      expect(script.durationMs).toBe(TTY1_BOOT_MS);

      const last = script.lines.at(-2)!;
      expect(last.kind).toBe('command');
      const motto = script.lines.at(-1)!;
      expect(motto.at).toBeGreaterThanOrEqual(
        last.at + (last.kind === 'command' ? last.text.length * TYPING_MS_PER_CHAR : 0),
      );
      expect(motto.at).toBeLessThan(TTY1_BOOT_MS);
    }
  });

  it('shows the function waiting for half a second before it is validated', () => {
    const gate = build(5).lines.find((line) => line.kind === 'gate');

    expect(gate?.kind === 'gate' ? gate.doneAt - gate.at : 0).toBe(500);
  });

  it('never runs two lines closer than the eye can follow', () => {
    for (const seed of SEEDS) {
      const times = build(seed).lines.map((line) => line.at);
      const smallest = Math.min(...times.slice(1).map((at, index) => at - times[index]!));

      expect(smallest).toBeGreaterThanOrEqual(30);
    }
  });

  it('lets a command finish typing before its first output line appears', () => {
    for (const seed of SEEDS.slice(0, 120)) {
      const lines = build(seed).lines;

      lines.forEach((line, index) => {
        if (line.kind !== 'command') return;
        const next = lines[index + 1];
        if (next === undefined) return;

        expect(next.at - line.at).toBeGreaterThanOrEqual(line.text.length * TYPING_MS_PER_CHAR);
      });
    }
  });

  it('never prints a line wider than a 360 px phone holds in 16 px type', () => {
    for (const seed of SEEDS) {
      for (const line of build(seed).lines) {
        // An invite and its command wrap as two blocks — the command moves down with its cursor,
        // as the TTY1 opening has done since it shipped — so each is held to the width, not the sum.
        const widths =
          line.kind === 'command'
            ? [line.prompt.length, line.text.length]
            : line.kind === 'gate'
              ? [printed(line).length, line.done.length]
              : [printed(line).length];

        for (const width of widths) expect(width, printed(line)).toBeLessThanOrEqual(41);
      }
    }
  });

  it('never leaves a placeholder, an undefined or a NaN on screen', () => {
    for (const seed of SEEDS) {
      for (const line of build(seed).lines) {
        const everything = line.kind === 'gate' ? `${line.waiting}|${line.done}` : printed(line);

        expect(everything).not.toMatch(/[{}]|undefined|NaN/);
      }
    }
  });

  it('drops the lines it has no value for rather than printing them half', () => {
    const bare: BootFacts = {
      ...FACTS,
      cores: undefined,
      screen: undefined,
      online: undefined,
    };

    for (const seed of SEEDS.slice(0, 80)) {
      const found = texts(build(seed, bare).lines).join('\n');

      expect(found).not.toContain('cpu:');
      expect(found).not.toContain('fb0:');
      expect(found).not.toContain('net:');
    }
  });

  it('states the facts it was given, not facts of its own', () => {
    const found = new Set(
      SEEDS.flatMap((seed) =>
        texts(build(seed, { ...FACTS, catalogueSize: 4321, restSeconds: 95, cores: 6 }).lines),
      ),
    );
    const all = [...found].join('\n');

    expect(all).toContain('idb: 4321 exercises mounted');
    expect(all).toContain('rest: 95 s default timer');
    expect(all).toContain('cpu: 6 cores online');
    expect(all).not.toContain('1247');
  });

  it('says offline or online as the device said it', () => {
    const offline = SEEDS.flatMap((seed) => texts(build(seed, { ...FACTS, online: false }).lines));
    const online = SEEDS.flatMap((seed) => texts(build(seed, { ...FACTS, online: true }).lines));

    expect(offline.some((text) => text.endsWith('net: offline, as designed'))).toBe(true);
    expect(offline.some((text) => text.endsWith('net: online, not required'))).toBe(false);
    expect(online.some((text) => text.endsWith('net: online, not required'))).toBe(true);
  });
});

describe('the DOS interlude', () => {
  const dirScripts = SEEDS.map((seed) => build(seed).lines).filter((lines) =>
    lines.some((line) => line.kind === 'command' && line.text === t('boot.tty1.dosDirCommand')),
  );

  it('runs dir /s about one boot in two, and ver or mem the rest of the time', () => {
    const commands = SEEDS.flatMap((seed) =>
      build(seed).lines.flatMap((line) =>
        line.kind === 'command' && line.prompt === t('boot.tty1.dosPrompt') ? [line.text] : [],
      ),
    );
    const share = (name: string) =>
      commands.filter((command) => command === name).length / commands.length;

    expect(commands).toHaveLength(SEEDS.length);
    expect(share(t('boot.tty1.dosDirCommand'))).toBeGreaterThan(0.35);
    expect(share(t('boot.tty1.dosDirCommand'))).toBeLessThan(0.65);
    expect(share(t('boot.tty1.dosVerCommand'))).toBeGreaterThan(0.1);
    expect(share(t('boot.tty1.dosMemCommand'))).toBeGreaterThan(0.1);
  });

  it('announces the compatibility layer just before the prompt', () => {
    const lines = dirScripts[0]!;
    const index = lines.findIndex(
      (line) => line.kind === 'command' && line.prompt === t('boot.tty1.dosPrompt'),
    );

    expect(lines[index - 1]).toMatchObject({ kind: 'text', text: t('boot.tty1.dosIntro') });
  });

  it('dates every file with the day and the time it was given', () => {
    const lines = dirScripts[0]!;
    const files = texts(lines).filter((text) => /^[A-Z0-9]{1,8} +[A-Z]{3} +[\d,]+ /.test(text));

    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) expect(file).toMatch(/10-03-26 {3}2:07p$/);
  });

  it('adds up: the summary lines say what the listed files weigh', () => {
    for (const lines of dirScripts.slice(0, 40)) {
      const found = texts(lines);
      const files = found.filter((text) => /^[A-Z0-9]{1,8} +[A-Z]{3} +[\d,]+ /.test(text));
      const sizes = files.map((file) =>
        Number(/ ([\d,]+) \d\d-/.exec(file)![1]!.replaceAll(',', '')),
      );
      const summaries = found.filter((text) => /^ +\d+ file\(s\)/.test(text));

      expect(summaries.length).toBeGreaterThanOrEqual(1);
      for (const summary of summaries) {
        const [, count, bytes] = /^ +(\d+) file\(s\) +([\d,]+) bytes$/.exec(summary)!;
        expect(Number(count)).toBe(files.length);
        expect(Number(bytes!.replaceAll(',', ''))).toBe(sizes.reduce((sum, size) => sum + size, 0));
      }
    }
  });

  it('groups sizes by thousands the way DOS did, and no file is listed twice', () => {
    for (const lines of dirScripts.slice(0, 40)) {
      const names = texts(lines)
        .filter((text) => /^[A-Z0-9]{1,8} +[A-Z]{3} +[\d,]+ /.test(text))
        .map((text) => text.slice(0, 12));

      expect(new Set(names).size).toBe(names.length);
    }
    const sizes = dirScripts
      .flatMap((lines) => texts(lines))
      .flatMap((text) => / ([\d,]+) \d\d-\d\d-\d\d/.exec(text)?.[1] ?? []);

    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toMatch(/^\d{1,3}(,\d{3})*$/);
  });

  it('gives the volume a serial number of two hexadecimal halves', () => {
    const serial = texts(dirScripts[0]!).find((text) => text.includes('Serial'));

    expect(serial).toMatch(/is [0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('prints the version it was given when it runs ver', () => {
    const found = SEEDS.flatMap((seed) => texts(build(seed).lines));

    expect(found).toContain(t('boot.tty1.dosVersion', { version: '2.8.0' }));
  });
});
