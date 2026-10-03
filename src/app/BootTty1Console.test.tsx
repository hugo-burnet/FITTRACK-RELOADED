import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import { BootTty1Console } from './BootTty1Console';
import {
  buildBootScript,
  seededRandom,
  TYPING_MS_PER_CHAR,
  type BootFacts,
  type BootLine,
} from './bootTty1Script';

const FACTS: BootFacts = {
  now: new Date(2026, 9, 3, 14, 7, 11).getTime(),
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
  probes: [{ call: 'estimateOneRepMax()', result: '116.7 kg' }],
};

/** A boot with the DOS listing in it: the one whose prompt loses its cursor to the output. */
const script = (() => {
  for (let seed = 1; seed < 100; seed += 1) {
    const candidate = buildBootScript(seededRandom(seed), FACTS);
    if (candidate.lines.some((line) => line.kind === 'command' && line.text === 'dir /s')) {
      return candidate;
    }
  }
  throw new Error('no seed draws dir /s');
})();

const gate = script.lines.find(
  (line): line is Extract<BootLine, { kind: 'gate' }> => line.kind === 'gate',
)!;

const rows = (container: HTMLElement) => [...container.querySelectorAll('.boot-tty1-lines > *')];

/** Time is told from the mount: `advanceTo(1000)` is "one second after the screen appeared". */
function playFrom(container: HTMLElement) {
  let now = 0;
  return {
    advanceTo(at: number) {
      act(() => {
        vi.advanceTimersByTime(at - now);
      });
      now = at;
      return rows(container);
    },
  };
}

function installMatchMedia(value: unknown) {
  Object.defineProperty(window, 'matchMedia', { value, configurable: true, writable: true });
}

describe('BootTty1Console', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    installMatchMedia(undefined);
  });

  it('is hidden from assistive technology: it is a show, not content', () => {
    const { container } = render(<BootTty1Console script={script} exiting={false} />);

    expect(container.querySelector('.boot-tty1')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('starts empty and posts each line when its time comes', () => {
    const { container } = render(<BootTty1Console script={script} exiting={false} />);
    const clock = playFrom(container);
    const [first, second, third] = script.lines;

    expect(rows(container)).toHaveLength(0);
    expect(clock.advanceTo(first!.at - 1)).toHaveLength(0);
    expect(clock.advanceTo(first!.at)).toHaveLength(1);
    expect(clock.advanceTo(second!.at - 1)).toHaveLength(1);
    expect(clock.advanceTo(third!.at)).toHaveLength(3);
  });

  it('has said everything, in order, by the end of the opening', () => {
    const { container } = render(<BootTty1Console script={script} exiting={false} />);

    const all = playFrom(container).advanceTo(script.durationMs);

    expect(all).toHaveLength(script.lines.length);
    expect(all[0]?.textContent).toBe(t('boot.tty1.grubTitle'));
    expect(all.at(-1)?.textContent).toBe(`# ${t('app.tagline')}`);
  });

  it('shows the whole boot at once when the curtain lifts, without replaying a line', () => {
    const { container } = render(<BootTty1Console script={script} exiting />);

    expect(rows(container)).toHaveLength(script.lines.length);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows the whole boot at once when the lifter asked for less motion', () => {
    installMatchMedia(vi.fn().mockReturnValue({ matches: true }));
    const { container } = render(<BootTty1Console script={script} exiting={false} />);

    expect(rows(container)).toHaveLength(script.lines.length);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels what is left of the show when it goes away', () => {
    const { unmount } = render(<BootTty1Console script={script} exiting={false} />);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  describe('the function it waits on', () => {
    it('spins while it waits, then the same row becomes its validation', () => {
      const { container } = render(<BootTty1Console script={script} exiting={false} />);
      const clock = playFrom(container);

      const waiting = clock.advanceTo(gate.at);
      const row = waiting.at(-1)!;
      expect(row.querySelector('.boot-tty1-spin')).not.toBeNull();
      expect(row.textContent).toContain(gate.waiting);

      const validated = clock.advanceTo(gate.doneAt);
      expect(validated).toHaveLength(waiting.length);
      expect(validated.at(-1)?.querySelector('.boot-tty1-spin')).toBeNull();
      expect(validated.at(-1)?.textContent).toBe(gate.done);
      expect(validated.at(-1)?.querySelector('.boot-tty1-tag')?.getAttribute('data-level')).toBe(
        'ok',
      );
    });
  });

  describe('the cursor', () => {
    it('sits on the command being typed, and leaves it once output follows', () => {
      const { container } = render(<BootTty1Console script={script} exiting={false} />);
      const clock = playFrom(container);
      const dos = script.lines.findIndex(
        (line) => line.kind === 'command' && line.text === 'dir /s',
      );

      const typing = clock.advanceTo(script.lines[dos]!.at);
      expect(typing.at(-1)?.querySelector('.boot-tty1-cursor')).not.toBeNull();

      const output = clock.advanceTo(script.lines[dos + 1]!.at);
      expect(output.at(-2)?.querySelector('.boot-tty1-cursor')).toBeNull();
      expect(container.querySelectorAll('.boot-tty1-cursor')).toHaveLength(0);
    });

    it('ends on the last prompt, with the motto under it, and nowhere else', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const all = rows(container);

      expect(container.querySelectorAll('.boot-tty1-cursor')).toHaveLength(1);
      expect(all.at(-2)?.querySelector('.boot-tty1-cursor')).not.toBeNull();
      expect(all.at(-1)?.className).toBe('boot-tty1-comment');
    });
  });

  describe('what a line looks like', () => {
    it('types a command at the length it has, and no longer', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const commands = [...container.querySelectorAll<HTMLElement>('.boot-tty1-command')];
      const written = script.lines.flatMap((line) => (line.kind === 'command' ? [line.text] : []));

      expect(commands.map((command) => command.textContent)).toEqual(written);
      for (const command of commands) {
        expect(command.style.getPropertyValue('--chars')).toBe(String(command.textContent?.length));
      }
      expect(TYPING_MS_PER_CHAR).toBe(16);
    });

    it('levels each status line, brackets apart from the word', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const leveled = script.lines.filter(
        (line) =>
          (line.kind === 'text' && /^\[ (OK|WARN|FAIL) \]/.test(line.text)) || line.kind === 'gate',
      );

      expect(container.querySelectorAll('.boot-tty1-tag')).toHaveLength(leveled.length);
      expect(
        new Set(
          [...container.querySelectorAll('.boot-tty1-tag')].map((tag) =>
            tag.getAttribute('data-level'),
          ),
        ),
      ).toEqual(new Set(['ok', 'warn', 'fail']));

      const first = container.querySelector('.boot-tty1-tag')?.parentElement;
      expect(first?.querySelectorAll('.boot-tty1-bracket')).toHaveLength(2);
    });

    it('keeps the text of a status line whole, level included', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const quadriceps = [...container.querySelectorAll('.boot-tty1-line')].find((row) =>
        row.textContent?.includes('quadriceps'),
      );

      expect(quadriceps?.textContent).toBe(t('boot.consoleQuadriceps'));
    });

    it('greys the timestamp of a kernel line', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const stamps = [...container.querySelectorAll('.boot-tty1-stamp')];

      expect(stamps.length).toBeGreaterThanOrEqual(2);
      for (const stamp of stamps) expect(stamp.textContent).toMatch(/^\[ +\d+\.\d\d\]$/);
      expect(stamps[0]?.parentElement?.textContent).toMatch(/^\[ +\d+\.\d\d\] rtc: /);
    });

    it('keeps the blank lines of a listing as lines, so the rows keep their height', () => {
      const { container } = render(<BootTty1Console script={script} exiting />);
      const blank = [...container.querySelectorAll('.boot-tty1-line')].filter(
        (row) => row.textContent === ' ',
      );

      expect(blank.length).toBeGreaterThanOrEqual(2);
    });
  });
});
