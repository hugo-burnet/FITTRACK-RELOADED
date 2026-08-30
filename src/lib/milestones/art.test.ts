import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MILESTONES } from './catalogue';
import { artForMilestone, MILESTONE_ART_KEYS, milestoneArtUrl } from './art';

const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../public/milestones');

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
});
