#!/usr/bin/env python3
"""Build the TTY1 console font from the Terminus bitmap sources.

Terminus Font 4.49.1 is a set of bitmap fonts (BDF). This script turns four of
them into scalable outline fonts, one family per native size:

    TTY12  (6x12)    TTY16  (8x16)    TTY24  (12x24)    TTY32  (16x32)

Every set pixel becomes a filled square: 1 pixel = 64 font units, and the em is
the pixel height of the bitmap. Used at its own size (12, 16, 24 or 32 CSS px)
or at a multiple, no pixel of the font is blurred. Only the code points the app
needs are kept, which is what makes each file 5 to 8 KB.

Terminus is SIL OFL 1.1 with the Reserved Font Name "Terminus Font". A derived
font must not carry that name, hence the family names above. The copyright and
licence travel in each file's `name` table (OFL clause 2).

Usage:
    python3 scripts/tty1-font/build_tty1_font.py <terminus-font-4.49.1> [<out-dir>]

`out-dir` defaults to src/assets/fonts/tty1. Needs `fonttools` and `brotli`.
See README.md for the source archive and its checksum.
"""
import json
import pathlib
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UNIT = 64  # font units per bitmap pixel
SIZES = (12, 16, 24, 32)
WEIGHTS = (("regular", "n", 400), ("bold", "b", 700))

# U+202F is what `Intl.NumberFormat('fr-FR')` puts between thousands. Terminus
# has no glyph for it, so it is drawn as an empty cell.
SYNTHETIC_SPACES = (0x202F,)


def wanted(cp: int) -> bool:
    return (
        0x20 <= cp <= 0x7E  # Basic Latin
        or 0xA0 <= cp <= 0xFF  # Latin-1: accents, « », ×, °, ±, ·
        or cp in (0x152, 0x153, 0x178)  # Œ œ Ÿ
        or 0x2002 <= cp <= 0x200A  # spaces
        or 0x2010 <= cp <= 0x2015  # hyphens and dashes
        or 0x2018 <= cp <= 0x201F  # quotation marks
        or cp in (0x2022, 0x2026, 0x2039, 0x203A)  # • … ‹ ›
        or 0x2190 <= cp <= 0x2193  # arrows
        or cp in (0x2212, 0x221A, 0x2248, 0x2260, 0x2261, 0x2264, 0x2265)  # − √ ≈ ≠ ≡ ≤ ≥
        or 0x2500 <= cp <= 0x259F  # box drawing and block elements
        or 0x25A0 <= cp <= 0x25FF  # geometric shapes
        or cp in (0x20AC, 0x2713, 0x2714)  # € ✓ ✔
    )


def parse_bdf(path):
    glyphs = {}
    ascent, descent = 0, 0
    lines = iter(pathlib.Path(path).read_text(encoding="latin-1").splitlines())
    cur = None
    for line in lines:
        if line.startswith("FONT_ASCENT"):
            ascent = int(line.split()[1])
        elif line.startswith("FONT_DESCENT"):
            descent = int(line.split()[1])
        elif line.startswith("STARTCHAR"):
            cur = {}
        elif cur is not None:
            if line.startswith("ENCODING"):
                cur["enc"] = int(line.split()[1])
            elif line.startswith("DWIDTH"):
                cur["dw"] = int(line.split()[1])
            elif line.startswith("BBX"):
                _, w, h, xo, yo = line.split()
                cur["bbx"] = (int(w), int(h), int(xo), int(yo))
            elif line.startswith("BITMAP"):
                rows = []
                for row in lines:
                    if row.startswith("ENDCHAR"):
                        break
                    rows.append(row.strip())
                cur["rows"] = rows
                glyphs[cur["enc"]] = cur
                cur = None
    return glyphs, ascent, descent


def glyph_rects(glyph):
    """Merge a glyph's pixels into rectangles: runs per row, then identical
    consecutive runs stacked. Fewer contours for the same pixels."""
    w, h, xo, yo = glyph["bbx"]
    runs = []  # (row from the top, x0, x1)
    for r, hexrow in enumerate(glyph["rows"]):
        if not hexrow:
            continue
        nbits = len(hexrow) * 4
        bits = int(hexrow, 16)
        x = 0
        while x < w:
            if bits >> (nbits - 1 - x) & 1:
                x0 = x
                while x < w and bits >> (nbits - 1 - x) & 1:
                    x += 1
                runs.append((r, x0, x))
            else:
                x += 1
    open_runs, merged = {}, []
    for r, x0, x1 in runs:
        key = (x0, x1)
        if key in open_runs and open_runs[key][1] == r - 1:
            open_runs[key][1] = r
        else:
            if key in open_runs:
                merged.append((key, tuple(open_runs[key])))
            open_runs[key] = [r, r]
    for key, span in open_runs.items():
        merged.append((key, tuple(span)))
    rects = []
    for (x0, x1), (top_row, bottom_row) in merged:
        top = yo + h - top_row
        bottom = yo + h - bottom_row - 1
        rects.append(((xo + x0) * UNIT, bottom * UNIT, (xo + x1) * UNIT, top * UNIT))
    return rects


def make_glyph(rects):
    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in rects:
        # Clockwise, as TrueType wants for filled contours.
        pen.moveTo((x0, y0))
        pen.lineTo((x0, y1))
        pen.lineTo((x1, y1))
        pen.lineTo((x1, y0))
        pen.closePath()
    return pen.glyph()


def build(bdf_path, out_path, size, style, weight):
    glyphs, ascent, descent = parse_bdf(bdf_path)
    cell = next(g["dw"] for g in glyphs.values() if g["enc"] == 0x20)
    family = f"TTY{size}"
    order = [".notdef"]
    cmap, outlines, advances = {}, {}, {}

    # A hollow box, so a glyph that is missing everywhere is visible, not silent.
    box = [
        (UNIT, 0, (cell - 1) * UNIT, UNIT),
        (UNIT, (size - 5) * UNIT, (cell - 1) * UNIT, (size - 4) * UNIT),
        (UNIT, UNIT, 2 * UNIT, (size - 5) * UNIT),
        ((cell - 2) * UNIT, UNIT, (cell - 1) * UNIT, (size - 5) * UNIT),
    ]
    outlines[".notdef"] = make_glyph(box)
    advances[".notdef"] = cell * UNIT

    for cp in sorted(glyphs):
        if not wanted(cp):
            continue
        name = "space" if cp == 0x20 else f"uni{cp:04X}"
        outlines[name] = make_glyph(glyph_rects(glyphs[cp]))
        advances[name] = glyphs[cp]["dw"] * UNIT
        order.append(name)
        cmap[cp] = name
    for cp in SYNTHETIC_SPACES:
        name = f"uni{cp:04X}"
        outlines[name] = make_glyph([])
        advances[name] = cell * UNIT
        order.append(name)
        cmap[cp] = name

    builder = FontBuilder((ascent + descent) * UNIT, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf({n: outlines[n] for n in order})
    builder.setupHorizontalMetrics({n: (advances[n], 0) for n in order})
    builder.setupHorizontalHeader(ascent=ascent * UNIT, descent=-descent * UNIT, lineGap=0)
    builder.setupNameTable(
        {
            "familyName": family,
            "styleName": style.capitalize(),
            "uniqueFontIdentifier": f"{family}-{style}",
            "fullName": f"{family} {style.capitalize()}",
            "psName": f"{family}-{style.capitalize()}",
            "version": "Version 1.000",
            "copyright": "Derived from Terminus Font, (C) 2020 Dimitar Toshkov Zhekov. SIL OFL 1.1.",
            "licenseDescription": "SIL Open Font License, Version 1.1 - https://openfontlicense.org",
        }
    )
    builder.setupOS2(
        sTypoAscender=ascent * UNIT,
        sTypoDescender=-descent * UNIT,
        sTypoLineGap=0,
        usWinAscent=ascent * UNIT,
        usWinDescent=descent * UNIT,
        usWeightClass=weight,
        fsType=0,
    )
    builder.setupPost(isFixedPitch=1)
    font = builder.font
    font.flavor = "woff2"
    font.save(out_path)
    return sorted(cmap)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "src/assets/fonts/tty1")
    out.mkdir(parents=True, exist_ok=True)

    code_points = None
    for size in SIZES:
        for style, suffix, weight in WEIGHTS:
            bdf = source / f"ter-u{size}{suffix}.bdf"
            target = out / f"tty1-{size}-{style}.woff2"
            kept = build(bdf, target, size, style, weight)
            code_points = kept if code_points is None else code_points
            assert kept == code_points, f"{target.name} does not keep the same glyphs"
            print(f"{target}: {len(kept)} glyphs, {target.stat().st_size} bytes")

    (out / "glyphs.json").write_text(
        json.dumps({"source": "Terminus Font 4.49.1", "codePoints": code_points}) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
