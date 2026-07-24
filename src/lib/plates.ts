/**
 * The plate calculator (RF-28), pure by construction like the rest of `lib/`
 * (architecture §7): a target weight in, a stack of plates out, no React and no
 * Dexie. What it answers is the one question you ask with cold hands at the
 * rack — "what do I hang on each side to reach this number?"
 *
 * It is deliberately not barbell-only (audit M5): a `barWeight` of 0 and
 * `sides: 1` describe a single-peg plate machine, and a light handle with
 * `sides: 2` describes a loadable dumbbell. One engine, three pieces of iron.
 */

/**
 * The IPF/olympic kg set, heaviest first. The order is a contract: callers
 * render the stack top-down from this array and trust it is already sorted.
 * A **product default**, overridable per gym once Lot 8 stores the rack.
 */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5, 0.25] as const;

/** A bare olympic bar. Overridable per exercise/gym later, like the plate set. */
export const DEFAULT_BARBELL_KG = 20;

/**
 * One denomination the rack holds. `countPerSide` left out means "enough" —
 * the common case for a home rack of small plates; a finite count models the
 * single pair of 25s every commercial gym rations.
 */
export interface PlateSlot {
  weight: number;
  countPerSide?: number;
}

export type PlateInventory = PlateSlot[];

/** How many of one plate sit on one side. */
export interface PlateCount {
  weight: number;
  count: number;
}

export interface PlateLoad {
  /** Plates on a single side, heaviest first. Both sides carry the same. */
  perSide: PlateCount[];
  /** What the plates actually reach — bar plus everything placed. */
  achievedKg: number;
  /** What the rack could not reach, ≥ 0. Non-zero means "no exact match". */
  remainderKg: number;
  /** True when the target is lighter than the empty bar — nothing to load. */
  belowBar: boolean;
  barWeight: number;
  /** 2 for a bar or dumbbell, 1 for a single-peg machine. */
  sides: number;
}

export interface PlateOptions {
  barWeight?: number;
  inventory?: PlateInventory;
  /** 2 = symmetric bar/dumbbell (default), 1 = single loaded stack. */
  sides?: number;
}

/** kg → integer hundredths, the unit the whole computation runs in. */
function toH(kg: number): number {
  return Math.round(kg * 100);
}

/**
 * Decompose a target load into plates per side.
 *
 * Greedy from the heaviest plate down. For the canonical gym set the greedy
 * choice is also the fewest-plates choice, which is what a lifter reaches for;
 * whatever it cannot place is returned as `remainderKg` rather than rounded
 * away, so the screen can say "1 kg short" instead of lying about the load.
 *
 * Everything runs in integer hundredths of a kilo: 102.5 kg is 10250, a 1.25 kg
 * plate is 125, and no subtraction ever meets a floating-point ghost.
 */
export function computePlateLoad(targetKg: number, options: PlateOptions = {}): PlateLoad {
  const barWeight = options.barWeight ?? DEFAULT_BARBELL_KG;
  const sides = options.sides ?? 2;
  const inventory: PlateInventory =
    options.inventory ?? DEFAULT_PLATES_KG.map((weight) => ({ weight }));

  const targetH = toH(targetKg);
  const barH = toH(barWeight);

  // You cannot load less than the empty bar; say so plainly instead of
  // producing negative plates the greedy loop would then place nonsensically.
  if (targetH < barH) {
    return { perSide: [], achievedKg: barWeight, remainderKg: 0, belowBar: true, barWeight, sides };
  }

  const perSideTargetH = (targetH - barH) / sides;

  // Heaviest first, whatever order the caller passed the rack in.
  const slots = [...inventory].sort((a, b) => b.weight - a.weight);

  const perSide: PlateCount[] = [];
  let remainingH = perSideTargetH;
  let placedPerSideH = 0;

  for (const slot of slots) {
    const plateH = toH(slot.weight);
    if (plateH <= 0) continue;
    const cap = slot.countPerSide ?? Infinity;
    let count = 0;
    while (count < cap && plateH <= remainingH) {
      remainingH -= plateH;
      placedPerSideH += plateH;
      count += 1;
    }
    if (count > 0) perSide.push({ weight: slot.weight, count });
  }

  const achievedH = barH + placedPerSideH * sides;
  const remainderH = targetH - achievedH;

  return {
    perSide,
    achievedKg: achievedH / 100,
    remainderKg: remainderH > 0 ? remainderH / 100 : 0,
    belowBar: false,
    barWeight,
    sides,
  };
}
