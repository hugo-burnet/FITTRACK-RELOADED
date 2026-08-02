/**
 * Regenerates the PWA icon set in `public/` from the barbell mark.
 *
 * `sharp` is deliberately NOT a devDependency: this script runs by hand, once
 * every time the mark changes, and CI runs `npm ci` on every push. Paying a
 * native image toolchain on every deploy to render four files that are already
 * committed would be a poor trade. Install it for the occasion:
 *
 *     npm i --no-save sharp && node scripts/generate-icons.mjs
 *
 * The geometry is the one in `src/ui/icons.tsx` (`BarbellIcon`) — five strokes
 * on a 24-unit grid. It is repeated here rather than imported because that file
 * is TSX returning React elements, and a build step to reuse five path strings
 * would cost more than it saves. If the mark changes there, change it here.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// fileURLToPath + join, never string concatenation: a project path containing a
// space breaks the naive version, and this repo has already been bitten once.
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

/** Page background, dark theme — `--surface-0` in src/index.css. */
const BACKGROUND = '#12110f';
/** `--accent-ink`, the orange of the dark theme. */
const MARK = '#ff8a3d';

/** BarbellIcon, verbatim. Bar, inner plates, outer plates. */
const BARBELL = ['M8 12h8', 'M6.5 8.5v7', 'M17.5 8.5v7', 'M3.5 10.5v3', 'M20.5 10.5v3'];

/**
 * The mark on a 512 canvas, scaled by `s` units of the 24-grid and centred.
 *
 * `radius` is the corner rounding: the full 22 % squircle for the icon Android
 * shows as-is, and 0 for the maskable one — there the launcher applies its own
 * mask, and a pre-rounded square would show its corners inside the crop.
 */
function icon({ scale, radius }) {
  const offset = 256 - 12 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})"
     fill="none" stroke="${MARK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
${BARBELL.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`;
}

/**
 * 18.5 puts the mark at 69 % of the width — the plates read as plates rather
 * than as ticks, which is what fails first when the icon is 48 px in a drawer.
 */
const STANDARD = icon({ scale: 18.5, radius: 112 });

/**
 * Maskable icons are cropped to whatever shape the launcher likes, and only the
 * central circle of 80 % diameter is guaranteed to survive. The mark is a wide,
 * flat shape: at the standard scale its corners land 193 px from centre against
 * a 205 px safe radius, which clears the circle on paper and looks pinched in
 * it. 16 pulls it back to a comfortable 168 px.
 */
const MASKABLE = icon({ scale: 16, radius: 0 });

const OUTPUTS = [
  { file: 'pwa-192x192.png', svg: STANDARD, size: 192 },
  { file: 'pwa-512x512.png', svg: STANDARD, size: 512 },
  { file: 'pwa-maskable-512x512.png', svg: MASKABLE, size: 512 },
  // iOS ignores the manifest and reads this tag instead. It applies its own
  // squircle, so it gets the standard art rather than the maskable one.
  { file: 'apple-touch-icon-180x180.png', svg: STANDARD, size: 180 },
];

await mkdir(PUBLIC_DIR, { recursive: true });

// The SVG ships too: it is the source of the PNGs, and browsers that accept an
// SVG favicon get a mark that stays sharp at any size for 700 bytes.
await writeFile(join(PUBLIC_DIR, 'icon.svg'), STANDARD, 'utf8');

for (const { file, svg, size } of OUTPUTS) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC_DIR, file));
  console.log(`${file} (${size}×${size})`);
}
