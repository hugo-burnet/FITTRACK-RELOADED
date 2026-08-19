import { describe, expect, it } from 'vitest';
import { reverbEnvelope } from './publicAddress';

describe('reverbEnvelope', () => {
  it('part de l’impulsion et finit sur le silence', () => {
    const envelope = reverbEnvelope(1_000, 2.6);
    expect(envelope[0]).toBe(1);
    expect(envelope[envelope.length - 1]).toBeCloseTo(0, 5);
  });

  it('décroît sans jamais remonter', () => {
    const envelope = reverbEnvelope(500, 2.6);
    for (let index = 1; index < envelope.length; index += 1) {
      expect(envelope[index]!).toBeLessThan(envelope[index - 1]!);
    }
  });

  it('décroît plus vite quand la salle est plus mate', () => {
    const live = reverbEnvelope(1_000, 1.5);
    const dead = reverbEnvelope(1_000, 4);
    expect(dead[250]!).toBeLessThan(live[250]!);
  });

  it('ne s’effondre pas sur une longueur nulle ou négative', () => {
    expect(reverbEnvelope(0, 2.6)).toHaveLength(0);
    expect(reverbEnvelope(-10, 2.6)).toHaveLength(0);
  });
});
