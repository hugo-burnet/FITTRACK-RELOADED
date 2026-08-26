import { describe, expect, it } from 'vitest';
import { PROGRAM_PHASES } from '@/data/types';
import { phaseEvidenceFor } from './phaseEvidence';

describe('phaseEvidenceFor', () => {
  it('mène la semaine de décharge à la section Deload', () => {
    const evidence = phaseEvidenceFor('deload');
    expect(evidence).not.toBeNull();
    expect(evidence?.sectionId).toBe('f1-13-deload');
    expect(evidence?.count).toBeGreaterThan(0);
  });

  it('se tait sur les phases que le corpus ne traite pas', () => {
    // Envoyer « construction » vers un chapitre vaguement voisin apprendrait au
    // lecteur que le lien ment. Mieux vaut ne rien proposer.
    expect(phaseEvidenceFor('construction')).toBeNull();
    expect(phaseEvidenceFor('test')).toBeNull();
  });

  it('ne renvoie jamais un lien mort', () => {
    // Si un identifiant de section cesse de résoudre — corpus régénéré, titre
    // réécrit — la fonction doit se taire, pas produire une URL vers le vide.
    for (const phase of PROGRAM_PHASES) {
      const evidence = phaseEvidenceFor(phase);
      if (evidence === null) continue;
      expect(evidence.sectionId, phase).toMatch(/^f1-[a-z0-9-]+$/u);
      expect(evidence.title.length, phase).toBeGreaterThan(3);
      expect(evidence.count, phase).toBeGreaterThan(0);
    }
  });

  it('couvre les phases où une décision se prend vraiment', () => {
    for (const phase of ['deload', 'progression', 'overload', 'return'] as const) {
      expect(phaseEvidenceFor(phase), phase).not.toBeNull();
    }
  });
});
