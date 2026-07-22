import { describe, expect, it } from 'vitest';
import { formatRest, isRestTriggering, resolveRestSeconds, restProgress } from './rest';

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
    expect(isRestTriggering({ setType: 'dropset' }, { isLastOfBlock: true })).toBe(true);
    expect(isRestTriggering({ setType: 'failure' }, { isLastOfBlock: true })).toBe(true);
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
