/** Les signes du bruit : des capitales, des chiffres, quelques symboles de terminal. */
export const DECODE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>_';

/** Ce qui ne se brouille jamais : la silhouette du titre (espaces, tirets, signes) reste lisible. */
const KEEP = /[\s—–\-·×:,.'’()]/;

/**
 * Une image du titre qui se décode : la part `progress` (0 → 1) est écrite, à gauche ; le reste est du
 * bruit de même longueur. `random` est injecté pour que les tests soient déterministes.
 */
export function decodeFrame(text: string, progress: number, random: () => number = Math.random): string {
  const chars = [...text];
  const shown = Math.floor(chars.length * Math.min(1, Math.max(0, progress)));
  return chars
    .map((char, index) =>
      index < shown || KEEP.test(char)
        ? char
        : (DECODE_GLYPHS[Math.floor(random() * DECODE_GLYPHS.length)] ?? char),
    )
    .join('');
}
