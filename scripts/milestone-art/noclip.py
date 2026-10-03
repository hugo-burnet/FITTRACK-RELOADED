#!/usr/bin/env python3
"""
Le jeton du palier « noclip » : une pluie de glyphes verts, façon Matrix.

    python3 scripts/milestone-art/noclip.py            # écrit public/milestones/noclip.jpg
    python3 scripts/milestone-art/noclip.py --png out.png   # garde aussi le PNG intermédiaire

Pourquoi un script plutôt qu'une image trouvée : les autres jetons sont des illustrations originales
(`docs/design/specs/2026-08-30-milestone-meme-tokens-design.md`), et celui-ci n'emprunte rien à
personne. Pourquoi sans police : les glyphes sont des **traits dessinés** sur une grille de 5 × 7
points, donc l'image ne dépend pas de ce que le système sait afficher — et la pluie n'est de toute
façon pas faite de lettres qu'on lirait.

Sans dépendance Python : le dessin se fait à la main (suréchantillonné pour le lissage), le PNG s'écrit
avec `zlib`, et ImageMagick (`convert`) fait le JPEG. Le dessin est déterministe (graine fixe) ; le
JPEG ne l'est qu'à version d'ImageMagick égale, ce qui suffit : le fichier est dans le dépôt, le script
est là pour qui voudra le retoucher.
"""

from __future__ import annotations

import argparse
import math
import random
import struct
import subprocess
import sys
import zlib
from pathlib import Path

SIZE = 384          # côté du jeton, en pixels : une pluie floue n'est plus une pluie
CELL = 16           # côté d'une case de glyphe → 24 colonnes de 24 lignes
SS = 3              # suréchantillonnage du dessin
SEED = 20261003     # le jour où le jeton a été dessiné
GRID_X, GRID_Y = 5, 7  # les points d'un glyphe

BACKGROUND = (2.0, 9.0, 5.0)
GREEN = (0.0, 255.0, 65.0)   # le vert du code Matrix
HEAD = (214.0, 255.0, 222.0)  # la tête d'une colonne, presque blanche


def glyph_strokes(rng: random.Random) -> list[tuple[float, float, float, float]]:
    """Un glyphe : trois à cinq traits sur la grille, miroir tiré une fois sur deux."""
    points = lambda i, j: (3.0 + i * 2.5, 2.0 + j * 2.0)
    strokes: list[tuple[float, float, float, float]] = []
    for _ in range(rng.randint(3, 5)):
        kind = rng.choice(("v", "v", "h", "h", "d", "d", "dot"))
        i, j = rng.randrange(GRID_X), rng.randrange(GRID_Y)
        if kind == "v":
            j2 = min(GRID_Y - 1, j + rng.randint(2, 4))
            (x0, y0), (x1, y1) = points(i, j), points(i, j2)
        elif kind == "h":
            i2 = min(GRID_X - 1, i + rng.randint(1, 3))
            (x0, y0), (x1, y1) = points(i, j), points(i2, j)
        elif kind == "d":
            k = rng.randint(1, 3)
            i2 = max(0, min(GRID_X - 1, i + rng.choice((-k, k))))
            j2 = min(GRID_Y - 1, j + k + 1)
            (x0, y0), (x1, y1) = points(i, j), points(i2, j2)
        else:
            (x0, y0) = points(i, j)
            x1, y1 = x0 + 0.01, y0 + 0.01
        strokes.append((x0, y0, x1, y1))

    if rng.random() < 0.5:  # les glyphes du film sont des katakana en miroir
        strokes = [(CELL - x0, y0, CELL - x1, y1) for x0, y0, x1, y1 in strokes]
    return strokes


class Canvas:
    """Trois canaux flottants, à SS fois la résolution du jeton."""

    def __init__(self) -> None:
        self.side = SIZE * SS
        self.planes = [[background] * (self.side * self.side) for background in BACKGROUND]

    def stroke(self, x0, y0, x1, y1, width, color, strength) -> None:
        """Un trait lissé, fondu par `max` : deux traits qui se croisent ne s'additionnent pas."""
        half = width * SS / 2
        sx0, sy0, sx1, sy1 = x0 * SS, y0 * SS, x1 * SS, y1 * SS
        left = max(0, int(min(sx0, sx1) - half) - 1)
        right = min(self.side - 1, int(max(sx0, sx1) + half) + 1)
        top = max(0, int(min(sy0, sy1) - half) - 1)
        bottom = min(self.side - 1, int(max(sy0, sy1) + half) + 1)
        dx, dy = sx1 - sx0, sy1 - sy0
        length_squared = dx * dx + dy * dy

        for py in range(top, bottom + 1):
            row = py * self.side
            for px in range(left, right + 1):
                if length_squared == 0:
                    t = 0.0
                else:
                    t = max(0.0, min(1.0, ((px - sx0) * dx + (py - sy0) * dy) / length_squared))
                cx, cy = sx0 + t * dx, sy0 + t * dy
                distance = math.hypot(px - cx, py - cy)
                if distance > half:
                    continue
                for plane, channel in zip(self.planes, color):
                    value = BACKGROUND[self.planes.index(plane)] + (channel - BACKGROUND[self.planes.index(plane)]) * strength
                    if value > plane[row + px]:
                        plane[row + px] = value

    def downsample(self) -> list[list[float]]:
        """Moyenne SS × SS : c'est ce qui donne les bords lisses."""
        result = [[0.0] * (SIZE * SIZE) for _ in range(3)]
        weight = 1.0 / (SS * SS)
        for channel, plane in enumerate(self.planes):
            out = result[channel]
            for y in range(SIZE):
                for x in range(SIZE):
                    total = 0.0
                    for oy in range(SS):
                        base = (y * SS + oy) * self.side + x * SS
                        for ox in range(SS):
                            total += plane[base + ox]
                    out[y * SIZE + x] = total * weight
        return result


def box_blur(plane: list[float], radius: int) -> list[float]:
    """Un flou en boîte séparable, par sommes glissantes."""
    def run(source: list[float], stride_outer: int, stride_inner: int) -> list[float]:
        out = [0.0] * len(source)
        window = 2 * radius + 1
        for outer in range(SIZE):
            base = outer * stride_outer
            total = sum(source[base + max(0, min(SIZE - 1, k)) * stride_inner] for k in range(-radius, radius + 1))
            for inner in range(SIZE):
                out[base + inner * stride_inner] = total / window
                leaving = max(0, min(SIZE - 1, inner - radius))
                entering = max(0, min(SIZE - 1, inner + radius + 1))
                total += source[base + entering * stride_inner] - source[base + leaving * stride_inner]
        return out

    return run(run(plane, SIZE, 1), 1, SIZE)


def draw() -> list[list[float]]:
    rng = random.Random(SEED)
    canvas = Canvas()
    columns = SIZE // CELL

    for column in range(columns):
        active = rng.random() < 0.88
        # Une tête tombe dans le cadre, ou juste en dessous : sa traîne, elle, le remplit.
        head = rng.randint(7, columns + 1)
        length = rng.randint(9, 22)
        # Les colonnes du milieu brillent plus : la vignette fait du carré un logo, pas un fond d'écran.
        centre = 1.0 - ((column + 0.5 - columns / 2) / (columns / 2)) ** 2
        for row in range(columns):
            strokes = glyph_strokes(rng)
            if active and head - length < row <= head:
                age = head - row  # 0 pour la tête
                if age == 0:
                    color, strength = HEAD, 1.0
                elif age == 1:
                    color, strength = (130.0, 255.0, 150.0), 0.95
                else:
                    color = GREEN
                    strength = (1 - age / length) ** 1.15 * (0.55 + 0.45 * centre)
                    strength *= 0.85 + 0.3 * rng.random()
                strength = min(1.0, max(0.12, strength))
                width = 1.9 if age <= 1 else 1.5
            else:
                color, strength, width = GREEN, 0.06 + 0.07 * rng.random(), 1.3
            ox, oy = column * CELL, row * CELL
            for x0, y0, x1, y1 in strokes:
                canvas.stroke(ox + x0, oy + y0, ox + x1, oy + y1, width, color, strength)

    planes = canvas.downsample()

    # Le halo : un flou des canaux, ajouté. Les têtes de colonne bavent de lumière, comme à l'écran.
    glow = [box_blur(plane, 5) for plane in planes]
    return [
        [min(255.0, value + 1.1 * halo) for value, halo in zip(plane, blur)]
        for plane, blur in zip(planes, glow)
    ]


def write_png(path: Path, planes: list[list[float]]) -> None:
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # filtre « aucun »
        for x in range(SIZE):
            for plane in planes:
                raw.append(int(max(0.0, min(255.0, plane[y * SIZE + x])) + 0.5))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[2] / "public/milestones/noclip.jpg")
    parser.add_argument("--png", type=Path, default=None, help="garde aussi le PNG intermédiaire")
    parser.add_argument("--quality", type=int, default=80)
    args = parser.parse_args()

    planes = draw()
    png = args.png or args.out.with_suffix(".png")
    write_png(png, planes)

    try:
        subprocess.run(
            ["convert", str(png), "-strip", "-quality", str(args.quality), "-sampling-factor", "4:2:0", str(args.out)],
            check=True,
        )
    except FileNotFoundError:
        print("ImageMagick (`convert`) est introuvable : seul le PNG est écrit.", file=sys.stderr)
        return 1
    finally:
        if args.png is None:
            png.unlink(missing_ok=True)

    print(f"{args.out} ({args.out.stat().st_size} octets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
