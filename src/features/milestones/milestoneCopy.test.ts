import { describe, expect, it } from 'vitest';
import { MILESTONES } from '@/lib/milestones/catalogue';
import { milestoneReading } from './milestoneCopy';

describe('la lecture d’un palier', () => {
  it('nomme le mouvement et la charge', () => {
    expect(milestoneReading('bench-100', 100)?.title).toBe('Développé couché à 100 kg');
  });

  it('écrit la première fois au bon genre plutôt qu’avec un gabarit', () => {
    // « Première dips » et « Premier traction » sont les deux fautes que la
    // table `milestone.first` existe pour éviter.
    expect(milestoneReading('pullup-1', 1)?.title).toBe('Ta première traction pronation');
    expect(milestoneReading('dip-1', 1)?.title).toBe('Ton premier dips');
  });

  it('repasse au gabarit dès la deuxième marche', () => {
    expect(milestoneReading('pullup-10', 10)?.title).toBe('Traction pronation — 10 répétitions');
  });

  it('lit une durée en minutes, pas en secondes', () => {
    expect(milestoneReading('plank-300', 300)?.title).toBe('Gainage — 5 min');
    expect(milestoneReading('plank-300', 300)?.token).toBe('5');
  });

  it('lit un tonnage en tonnes, pas en kilos', () => {
    expect(milestoneReading('tonnage-100', 100_000)?.title).toBe('100 tonnes soulevées');
    expect(milestoneReading('tonnage-100', 100_000)?.token).toBe('100');
  });

  it('accorde l’année au singulier', () => {
    expect(milestoneReading('years-1', 1)?.title).toBe('Un an de pratique');
    expect(milestoneReading('years-5', 5)?.title).toBe('5 ans de pratique');
  });

  it('dit ce qui a vraiment été franchi quand ce n’est pas le chiffre rond', () => {
    expect(milestoneReading('bench-100', 102.5)?.reached).toBe('Franchi à 102,5 kg');
  });

  it('se tait quand la valeur est exactement le seuil', () => {
    expect(milestoneReading('bench-100', 100)?.reached).toBeUndefined();
  });

  it('ne commente pas un cumul, dont le chiffre exact ne dit rien', () => {
    expect(milestoneReading('tonnage-100', 100_043)?.reached).toBeUndefined();
  });

  it('rend une durée franchie en minutes et secondes', () => {
    expect(milestoneReading('plank-120', 125)?.reached).toBe('Franchi à 2:05');
  });

  it('ne rend rien pour un palier retiré du catalogue', () => {
    expect(milestoneReading('palier-supprime', 1)).toBeUndefined();
  });

  it('donne un titre et un jeton non vides à tout le catalogue', () => {
    // La garde qui compte : un palier ajouté sans sa clé i18n afficherait
    // « milestone.subject.machin » le jour où il tombe, c'est-à-dire une fois,
    // et sans témoin.
    for (const definition of MILESTONES) {
      const reading = milestoneReading(definition.id, definition.threshold);
      expect(reading, definition.id).toBeDefined();
      expect(reading?.title, definition.id).not.toContain('milestone.');
      expect(reading?.title, definition.id).not.toBe('');
      expect(reading?.token, definition.id).not.toBe('');
    }
  });
});
