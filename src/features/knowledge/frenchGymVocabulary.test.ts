import { describe, expect, it } from 'vitest';
import { normalizeGymTerm } from './frenchGymVocabulary';

describe('normalizeGymTerm', () => {
  it('replie le pluriel en -s sur le singulier', () => {
    expect(normalizeGymTerm('machines')).toBe('machine');
    expect(normalizeGymTerm('series')).toBe('serie');
    expect(normalizeGymTerm('mollets')).toBe('mollet');
  });

  it('replie le pluriel en -aux sur le singulier en -al', () => {
    expect(normalizeGymTerm('unilateraux')).toBe('unilateral');
    expect(normalizeGymTerm('lateraux')).toBe('lateral');
  });

  it('traite -eaux avant -aux, sinon faisceaux deviendrait faisceal', () => {
    expect(normalizeGymTerm('faisceaux')).toBe('faisceau');
  });

  it('laisse les mots courts et les finales en -ss intacts', () => {
    expect(normalizeGymTerm('bas')).toBe('bas');
    expect(normalizeGymTerm('dos')).toBe('dos');
    expect(normalizeGymTerm('press')).toBe('press');
  });

  it('traduit le vocabulaire de salle vers celui du corpus', () => {
    // Le corpus dit « soulevé de terre » et n'emploie jamais « deadlift ».
    expect(normalizeGymTerm('deadlift')).toBe('souleve');
    expect(normalizeGymTerm('pecs')).toBe('pectoral');
    // La cible d'un alias est la forme DÉJÀ dépluralisée : le corpus écrit
    // « quadriceps », que la règle du pluriel replie sur « quadricep ». Viser
    // « quadriceps » ferait pointer l'alias à côté de son propre corpus.
    expect(normalizeGymTerm('quads')).toBe('quadricep');
  });

  it('unifie la famille tendineuse, que le corpus décline en cinq formes', () => {
    expect(normalizeGymTerm('tendon')).toBe('tendon');
    expect(normalizeGymTerm('tendineuse')).toBe('tendon');
    expect(normalizeGymTerm('tendinopathie')).toBe('tendon');
    expect(normalizeGymTerm('tendinopathies')).toBe('tendon');
  });

  it('applique les alias après le dépluralisation, pas avant', () => {
    // « pecs » -> « pec » par la règle du pluriel, puis alias vers « pectoral ».
    expect(normalizeGymTerm('pec')).toBe('pectoral');
    expect(normalizeGymTerm('abdos')).toBe('abdominal');
  });

  it('est idempotent : normaliser deux fois ne change rien', () => {
    for (const word of ['machines', 'unilateraux', 'pecs', 'tendinopathies', 'faisceaux']) {
      expect(normalizeGymTerm(normalizeGymTerm(word))).toBe(normalizeGymTerm(word));
    }
  });
});
