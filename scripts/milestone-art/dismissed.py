#!/usr/bin/env python3
"""
Le jeton du palier secret « Vous pouvez disposer » : un tampon administratif sur un formulaire.

    python3 scripts/milestone-art/dismissed.py              # écrit public/milestones/dismissed.jpg
    python3 scripts/milestone-art/dismissed.py --png out.png

Le palier tombe la première fois que le protocole disciplinaire RPE constate un dépassement du
plafond qu'on s'était fixé. Ce n'est pas une victoire : c'est un congé signifié par l'annonceuse, et
le jeton le dit dans sa langue — un tampon rouge, encreux, de travers, sur un papier de guichet.

Dépend de Pillow et de la police DejaVu Sans Bold (présente sur la plupart des Linux). Le dessin est
déterministe (graine fixe) à version de police égale ; le fichier est dans le dépôt, le script est là
pour qui voudra le retoucher. 384 px comme noclip : le tampon se lit en grand dans la feuille du bas.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 384
SEED = 20261122  # le jour où l'annonceuse a dit « Vous pouvez disposer » pour la première fois
PAPER = (232, 226, 212)
RULE = (196, 188, 170)
INK = (178, 28, 36)
FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
)
ROOT = Path(__file__).resolve().parents[2]


def font(size: int) -> ImageFont.FreeTypeFont:
    for candidate in FONT_CANDIDATES:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    raise SystemExit("DejaVu Sans Bold introuvable : installe fonts-dejavu-core.")


def paper(rng: random.Random) -> Image.Image:
    """Un formulaire de guichet : lignes réglées, une marge, du grain."""
    image = Image.new("RGB", (SIZE, SIZE), PAPER)
    draw = ImageDraw.Draw(image)
    for y in range(40, SIZE, 28):
        draw.line([(24, y), (SIZE - 24, y)], fill=RULE, width=1)
    draw.line([(56, 0), (56, SIZE)], fill=(214, 170, 160), width=2)
    pixels = image.load()
    for _ in range(SIZE * SIZE // 6):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        r, g, b = pixels[x, y]
        d = rng.randint(-10, 6)
        pixels[x, y] = (max(0, r + d), max(0, g + d), max(0, b + d))
    return image


def stamp(rng: random.Random) -> Image.Image:
    """Le tampon, dessiné droit sur un calque transparent, puis encré inégalement."""
    w, h = 300, 196
    layer = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle([4, 4, w - 5, h - 5], radius=14, outline=255, width=7)
    draw.rounded_rectangle([18, 18, w - 19, h - 19], radius=8, outline=255, width=3)

    def centered(text: str, y: int, size: int) -> None:
        face = font(size)
        left, top, right, bottom = draw.textbbox((0, 0), text, font=face)
        draw.text(((w - (right - left)) / 2 - left, y - top), text, font=face, fill=255)

    centered("AUTORISATION", 38, 26)
    centered("SUSPENDUE", 74, 36)
    draw.line([(36, 128), (w - 36, 128)], fill=255, width=3)
    centered("VOUS POUVEZ DISPOSER", 142, 17)

    # L'encre : des manques, comme un tampon pressé d'une main pressée.
    pixels = layer.load()
    for _ in range(w * h // 3):
        x, y = rng.randrange(w), rng.randrange(h)
        if pixels[x, y] > 0 and rng.random() < 0.55:
            pixels[x, y] = rng.randint(40, 170)
    return layer.filter(ImageFilter.GaussianBlur(0.6))


def render() -> Image.Image:
    rng = random.Random(SEED)
    image = paper(rng)
    mask = stamp(rng).rotate(-12, resample=Image.BICUBIC, expand=True)
    ink = Image.new("RGB", mask.size, INK)
    x = (SIZE - mask.width) // 2
    y = (SIZE - mask.height) // 2
    image.paste(ink, (x, y), mask)
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--out", default=str(ROOT / "public/milestones/dismissed.jpg"))
    parser.add_argument("--png")
    parser.add_argument("--quality", type=int, default=82)
    args = parser.parse_args()

    image = render()
    if args.png:
        image.save(args.png)
    image.save(args.out, "JPEG", quality=args.quality, optimize=True, subsampling=2)
    print(f"{args.out} écrit ({Path(args.out).stat().st_size} octets)")


if __name__ == "__main__":
    main()
