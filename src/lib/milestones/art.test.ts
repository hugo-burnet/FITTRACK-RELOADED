import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MILESTONES } from './catalogue';
import { artForMilestone, MILESTONE_ART_KEYS, milestoneArtUrl } from './art';

const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../public/milestones');

/**
 * Les dimensions d'un JPEG, lues dans son premier marqueur de trame : le test n'a besoin que d'un
 * chiffre, et une dépendance d'images pour le lire coûterait plus que ce qu'elle garde.
 */
function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error('marqueur JPEG attendu');
    const marker = bytes[offset + 1] ?? 0;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('aucune trame JPEG trouvée');
}

describe('l’art d’un palier', () => {
  it('donne une clé à chaque entrée du catalogue', () => {
    const missing = MILESTONES.filter((row) => artForMilestone(row.id) === undefined);
    expect(missing.map((row) => row.id)).toEqual([]);
  });

  it('ne rend rien pour un palier retiré', () => {
    expect(artForMilestone('palier-supprime')).toBeUndefined();
  });

  it('utilise chaque clé au moins une fois', () => {
    const used = new Set(MILESTONES.map((row) => artForMilestone(row.id)));
    for (const key of MILESTONE_ART_KEYS) {
      expect(used.has(key), key).toBe(true);
    }
  });

  it('réserve git-gud à la première traction', () => {
    expect(artForMilestone('pullup-1')).toBe('git-gud');
  });

  it('réserve rock-solid à la première séance et la porte aux DOMS', () => {
    expect(artForMilestone('sessions-1')).toBe('rock-solid');
    expect(artForMilestone('doms-48')).toBe('doms-door');
  });

  it('pose rare Pepe sur les plafonds', () => {
    for (const id of [
      'bench-140',
      'squat-180',
      'deadlift-220',
      'sessions-1000',
      'years-10',
      'tonnage-5000',
    ]) {
      expect(artForMilestone(id), id).toBe('pepe-rare');
    }
  });

  it('pose gigachad sur les sommets de force', () => {
    for (const id of [
      'deadlift-180',
      'overhead-80',
      'hipthrust-200',
      'pullup-20',
      'dumbbell-50',
      'tonnage-1000',
    ]) {
      expect(artForMilestone(id), id).toBe('gigachad');
    }
  });

  it('ne répète que gigachad et rare Pepe', () => {
    const counts = new Map<string, number>();
    for (const row of MILESTONES) {
      const key = artForMilestone(row.id);
      if (key === undefined) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts) {
      if (key === 'gigachad' || key === 'pepe-rare') {
        expect(n, key).toBeGreaterThan(1);
      } else {
        expect(n, key).toBe(1);
      }
    }
  });

  it('préfixe l’URL avec BASE_URL, comme la voix', () => {
    expect(milestoneArtUrl('pepe-classic')).toBe(
      `${import.meta.env.BASE_URL}milestones/pepe-classic.jpg`,
    );
  });

  it('embarque un JPEG pour chaque clé', () => {
    for (const key of MILESTONE_ART_KEYS) {
      expect(existsSync(join(ART_DIR, `${key}.jpg`)), key).toBe(true);
    }
  });

  it('donne à noclip sa propre image, qu’aucun autre palier ne partage', () => {
    expect(artForMilestone('noclip')).toBe('noclip');
    const sharing = MILESTONES.filter((row) => artForMilestone(row.id) === 'noclip');
    expect(sharing.map((row) => row.id)).toEqual(['noclip']);
  });

  it('dessine noclip en 384 px, carré : une pluie de glyphes floue n’est plus une pluie', () => {
    expect(jpegSize(join(ART_DIR, 'noclip.jpg'))).toEqual({ width: 384, height: 384 });
  });
});
