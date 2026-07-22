/**
 * Ordering and superset rules for a routine. Pure by construction (architecture
 * §7): rows in, rows out, no React and no Dexie.
 *
 * A superset is a set of exercises you alternate between without resting. That
 * makes it a property of **adjacency**, not a free-form label: grouping
 * exercises 1 and 7 would describe something nobody can perform. So every move
 * has to renormalise the groups, and the rule that decides what survives lives
 * here rather than inside a drag handler.
 */

/** Anything the editor orders. Only the group matters to the rules below. */
export interface Groupable {
  supersetGroup: number; // 0 = not in a superset
}

/** Consecutive rows sharing one group. Ungrouped rows form blocks of their own. */
export interface Block<T> {
  /** 0 for a lone row, otherwise the normalised group number. */
  group: number;
  rows: T[];
}

/**
 * Moves one item, returning a new array. An out-of-range index returns the list
 * unchanged rather than splicing a hole into it: the caller is a pointer
 * handler, and a drag released outside the list must not corrupt the routine.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;

  // Spliced back in by spread rather than by index: `splice` hands back a `T[]`,
  // and reading element 0 of it would be an unchecked index access for nothing.
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * Makes the stored groups describe something performable again, in four passes:
 *
 * 1. **Bridge** — an *ungrouped* row sitting strictly between two rows of one
 *    group joins it. The editor draws a superset as a rule down the left edge;
 *    dropping a row inside that rule has to mean what the drawing promises.
 *
 *    Deliberately not generalised to a row that already carries a group. Given
 *    only `[B:1, C:2, A:1, D:2]` there is no way to tell whether A was dropped
 *    inside (C, D) or C inside (B, A) — both sit between two rows of one group,
 *    and the array does not record which one moved. A rule that fires for both
 *    just renames the groups and answers nothing. An ungrouped row has no claim
 *    of its own to defend, so it can never be in that contest.
 * 2. **Split** into maximal runs of one group.
 * 3. **Dissolve** runs of a single row. A superset of one exercise is an
 *    exercise.
 * 4. **Renumber** the survivors 1, 2, 3… so the stored numbers never drift into
 *    an arbitrary range that only history explains.
 *
 * The bridge reads the *original* neighbours, never the rows it has already
 * rewritten: reading its own output would let one bridged row bridge the next,
 * and a single drop could swallow half the routine into one superset.
 */
export function normalizeSupersets<T extends Groupable>(rows: readonly T[]): T[] {
  const bridged = rows.map((row, index) => {
    if (row.supersetGroup !== 0) return row.supersetGroup;
    const before = rows[index - 1]?.supersetGroup ?? 0;
    const after = rows[index + 1]?.supersetGroup ?? 0;
    return before !== 0 && before === after ? before : 0;
  });

  const assigned = new Array<number>(bridged.length).fill(0);
  let counter = 0;

  for (let start = 0; start < bridged.length; ) {
    const group = bridged[start] ?? 0;
    let end = start + 1;
    while (end < bridged.length && bridged[end] === group) end++;

    if (group !== 0 && end - start > 1) {
      counter += 1;
      assigned.fill(counter, start, end);
    }

    start = end;
  }

  return rows.map((row, index) => ({ ...row, supersetGroup: assigned[index] ?? 0 }));
}

/** Groups consecutive rows for rendering — one block, one accent rule. */
export function toBlocks<T extends Groupable>(rows: readonly T[]): Block<T>[] {
  const blocks: Block<T>[] = [];

  for (const row of rows) {
    const current = blocks.at(-1);
    if (current !== undefined && current.group !== 0 && current.group === row.supersetGroup) {
      current.rows.push(row);
      continue;
    }
    blocks.push({ group: row.supersetGroup, rows: [row] });
  }

  return blocks;
}
