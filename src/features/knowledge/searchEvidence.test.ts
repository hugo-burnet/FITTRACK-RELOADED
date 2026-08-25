import { describe, expect, it } from 'vitest';
import { searchEvidence, tokenizeEvidenceText } from './searchEvidence';

describe('searchEvidence', () => {
  it('normalise les accents et les élisions françaises', () => {
    expect(tokenizeEvidenceText("L’étirement améliore l’amplitude")).toEqual([
      'etirement',
      'ameliore',
      'amplitude',
    ]);
  });

  it('refuse honnêtement quand aucun terme lexical n’existe dans le corpus', () => {
    expect(searchEvidence('quasar zirconium plutonium')).toEqual({
      kind: 'NO_LEXICAL_EVIDENCE',
      candidates: [],
    });
  });

  it('retourne des extraits exacts, pas une réponse générée', () => {
    const outcome = searchEvidence('amplitude EMG hypertrophie');

    expect(outcome.kind).toBe('EVIDENCE_CANDIDATES');
    if (outcome.kind !== 'EVIDENCE_CANDIDATES') return;
    expect(outcome.candidates[0]?.rawQuote).toMatch(/EMG/i);
    expect(outcome.candidates[0]?.claimId).toMatch(/^claim\.[a-f0-9]{16}$/u);
    expect(outcome.candidates[0]?.supportEndByte).toBeGreaterThan(
      outcome.candidates[0]?.supportStartByte ?? 0,
    );
  });
});
