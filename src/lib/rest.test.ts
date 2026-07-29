import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REST_SECONDS,
  formatRest,
  isRestTriggering,
  resolveRestSeconds,
  restPlans,
  restProgress,
} from './rest';

const plannedRows = (...rows: Array<{ supersetGroup: number; restSeconds?: number }>) =>
  rows.map((row, index) => ({
    id: `row-${index}`,
    ...row,
  }));

describe('resolveRestSeconds', () => {
  it('prefers the routine override', () => {
    expect(resolveRestSeconds(90, 60)).toBe(90);
  });

  it('falls back to the exercise default when the override is 0', () => {
    // 0 is not "no rest", it is "use the exercise's own" — cf. §4.2.
    expect(resolveRestSeconds(0, 60)).toBe(60);
  });

  it('falls back to the exercise default when the override is missing', () => {
    expect(resolveRestSeconds(undefined, 45)).toBe(45);
  });

  it('lands on 120 s when neither says anything', () => {
    // The pre-existing rule returned 0, and a timer of 0 s has no meaning.
    expect(resolveRestSeconds(0, undefined)).toBe(120);
    expect(resolveRestSeconds(undefined, 0)).toBe(120);
    expect(resolveRestSeconds(undefined, undefined)).toBe(120);
  });

  it('never returns a negative or fractional duration', () => {
    expect(resolveRestSeconds(-30, undefined)).toBe(120);
    expect(resolveRestSeconds(90.6, undefined)).toBe(91);
  });
});

describe('isRestTriggering', () => {
  const normal = { setType: 'normal' as const };

  it('does not fire for a warm-up set', () => {
    // Sub-maximal and not tiring: timing them slows the session for nothing.
    expect(isRestTriggering({ setType: 'warmup' }, { isLastOfBlock: true })).toBe(false);
  });

  it('fires for a normal set that closes its block', () => {
    expect(isRestTriggering(normal, { isLastOfBlock: true })).toBe(true);
  });

  it('does not fire between two members of a superset', () => {
    // What *defines* a superset is the minimal rest between its members.
    expect(isRestTriggering(normal, { isLastOfBlock: false })).toBe(false);
  });

  it('fires for drop sets and sets to failure', () => {
    // A drop set is the *end* of a chain, not its middle: once the last drop is
    // done, the rest is owed like any other working set.
    expect(isRestTriggering({ setType: 'dropset' }, { isLastOfBlock: true })).toBe(true);
    expect(isRestTriggering({ setType: 'failure' }, { isLastOfBlock: true })).toBe(true);
  });

  it('does not fire when the next set is a drop set', () => {
    // What "dégressive" means, in the app's own words: "enchaînée à la
    // précédente, charge allégée, sans repos". The set that has no rest is the
    // one *before* it — you strip the bar and carry straight on.
    expect(
      isRestTriggering(normal, { isLastOfBlock: true, nextSetType: 'dropset' }),
    ).toBe(false);
    expect(
      isRestTriggering({ setType: 'failure' }, { isLastOfBlock: true, nextSetType: 'dropset' }),
    ).toBe(false);
  });

  it('fires when the next set is anything else', () => {
    expect(isRestTriggering(normal, { isLastOfBlock: true, nextSetType: 'normal' })).toBe(true);
    expect(isRestTriggering(normal, { isLastOfBlock: true, nextSetType: 'failure' })).toBe(true);
    // Last set of the exercise: nothing follows, so nothing chains.
    expect(isRestTriggering(normal, { isLastOfBlock: true, nextSetType: undefined })).toBe(true);
  });

  it('chains a whole run of drop sets, and rests after the last one', () => {
    // 100 → 80 → 60: two hand-offs with no rest, then the recovery.
    expect(isRestTriggering(normal, { isLastOfBlock: true, nextSetType: 'dropset' })).toBe(false);
    expect(
      isRestTriggering({ setType: 'dropset' }, { isLastOfBlock: true, nextSetType: 'dropset' }),
    ).toBe(false);
    expect(
      isRestTriggering({ setType: 'dropset' }, { isLastOfBlock: true, nextSetType: undefined }),
    ).toBe(true);
  });
});

describe('restPlans', () => {
  it('plans independent rest for ungrouped rows', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 0, restSeconds: 60 },
          { supersetGroup: 0, restSeconds: 90 },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: true, seconds: 60 }],
      ['row-1', { isLastOfBlock: true, seconds: 90 }],
    ]);
  });

  it('shares the longest rest and marks only the end of a superset', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 7, restSeconds: 90 },
          { supersetGroup: 7, restSeconds: 180 },
          { supersetGroup: 7, restSeconds: 120 },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: false, seconds: 180 }],
      ['row-1', { isLastOfBlock: false, seconds: 180 }],
      ['row-2', { isLastOfBlock: true, seconds: 180 }],
    ]);
  });

  it('normalizes missing and invalid legacy durations', () => {
    expect([
      ...restPlans(
        plannedRows(
          { supersetGroup: 3 },
          { supersetGroup: 3, restSeconds: 0 },
          { supersetGroup: 3, restSeconds: Number.NaN },
        ),
      ),
    ]).toEqual([
      ['row-0', { isLastOfBlock: false, seconds: DEFAULT_REST_SECONDS }],
      ['row-1', { isLastOfBlock: false, seconds: DEFAULT_REST_SECONDS }],
      ['row-2', { isLastOfBlock: true, seconds: DEFAULT_REST_SECONDS }],
    ]);
  });

  it('never mutates its input', () => {
    const input = plannedRows(
      { supersetGroup: 1, restSeconds: 60 },
      { supersetGroup: 1, restSeconds: 90 },
    );
    const before = structuredClone(input);
    restPlans(input);
    expect(input).toEqual(before);
  });
});

describe('restProgress', () => {
  const startedAt = 1_000_000;
  const endsAt = startedAt + 120_000;

  it('is 0 at the start', () => {
    expect(restProgress(startedAt, endsAt, startedAt)).toBe(0);
  });

  it('is 1 at the end', () => {
    expect(restProgress(startedAt, endsAt, endsAt)).toBe(1);
  });

  it('is half way through the middle', () => {
    expect(restProgress(startedAt, endsAt, startedAt + 60_000)).toBeCloseTo(0.5);
  });

  it('clamps rather than overshooting once the rest is over', () => {
    // The tab was backgrounded for five minutes; the bar must be full, not 250%.
    expect(restProgress(startedAt, endsAt, endsAt + 300_000)).toBe(1);
  });

  it('clamps below zero, for a clock that jumped backwards', () => {
    expect(restProgress(startedAt, endsAt, startedAt - 5_000)).toBe(0);
  });

  it('reads as finished when the span is empty', () => {
    // Guards the division: a 0 s rest must not produce NaN in a style attribute.
    expect(restProgress(startedAt, startedAt, startedAt)).toBe(1);
  });
});

describe('formatRest', () => {
  it('reads as a clock, like every other duration in the app', () => {
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(120)).toBe('2:00');
    expect(formatRest(45)).toBe('0:45');
  });

  it('keeps two digits on the seconds', () => {
    expect(formatRest(65)).toBe('1:05');
  });

  it('floors a negative duration to zero rather than printing a minus', () => {
    expect(formatRest(-10)).toBe('0:00');
  });
});
