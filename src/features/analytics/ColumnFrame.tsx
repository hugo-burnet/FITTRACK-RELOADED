import type { BarSlot, PlotBox } from '@/lib/analytics/plot';

/**
 * Everything the two column charts share, in one place — because they stopped
 * sharing it.
 *
 * `ChartSurface` factored the interaction and deliberately left the drawing
 * alone, on the argument that a curve and a histogram disagree about every mark.
 * True of a curve against a histogram; **false of a histogram against a
 * histogram**. G2 and G4 drew the same three marks and had drifted on all three:
 * the baseline (`--border` here, `--text-2` there), the zero stub (same split),
 * and selection (a filled slot here, an outlined box there). Reported from the
 * phone as two screens that do not look like the same app.
 *
 * They are not props on a variant, they are one component: the way two charts
 * stay identical is that there is only one of them to change.
 */

/**
 * The mark a bucket with **no** data gets, in the tone of the baseline.
 *
 * Nothing drawn at all reads as a gap in the spacing rather than a column at
 * zero, and once the rhythm is broken every other height looks arbitrary. Four
 * pixels of the axis's own colour say "this bucket exists, and it is zero"
 * without ever reading as a small quantity.
 */
const ZERO_STUB = 4;

/** How thick the selection mark is, and how far it clears the baseline. */
const CURSOR = 3;
const CURSOR_GAP = 2;

export function ZeroStub({ slot, box }: { slot: BarSlot; box: PlotBox }) {
  return (
    <rect
      x={slot.x}
      y={box.height - ZERO_STUB}
      width={slot.width}
      height={ZERO_STUB}
      rx={1}
      fill="var(--axis)"
    />
  );
}

/**
 * The zero the columns stand on, and the cursor naming the one being read.
 *
 * **Selection is a mark under the column, not a treatment of it.** Both previous
 * answers failed the same way once measured on the light theme: the lit slot was
 * `--surface-2` on a white card — **1,14:1**, invisible — and the outlined box
 * crossing the baseline read as a stray rectangle rather than as a cursor. The
 * mark is the atom the bottom navigation already uses for the engaged tab, which
 * is what this is: it points at a column without claiming to be a value, it is
 * legible in both themes, and it works at any height **including none** — the
 * empty week is precisely the one worth tapping.
 *
 * It is `--text-1` and never the accent: on the sessions chart the accent
 * already means "goal reached", and a cursor in the same colour would make one
 * ink say two things on one drawing.
 */
export function ColumnFrame({ box, selected }: { box: PlotBox; selected: BarSlot | undefined }) {
  return (
    <>
      <line
        x1={0}
        y1={box.height}
        x2={box.width}
        y2={box.height}
        stroke="var(--axis)"
        strokeWidth={1}
      />

      {selected !== undefined && (
        <rect
          x={selected.x}
          y={box.height + CURSOR_GAP}
          width={selected.width}
          height={CURSOR}
          rx={CURSOR / 2}
          fill="var(--text-1)"
        />
      )}
    </>
  );
}
