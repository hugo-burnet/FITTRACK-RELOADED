import type { SetType } from '@/data/types';

/** Match ranks within warm-up and working sets independently. */
export function matchPreviousSets<T extends { setType: SetType }>(
  current: readonly { setType: SetType }[],
  previous: readonly T[],
): (T | undefined)[] {
  const warmups = previous.filter((set) => set.setType === 'warmup');
  const working = previous.filter((set) => set.setType !== 'warmup');
  let warmupRank = 0;
  let workingRank = 0;
  return current.map((set) =>
    set.setType === 'warmup' ? warmups[warmupRank++] : working[workingRank++],
  );
}
