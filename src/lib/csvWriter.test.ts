import { describe, expect, it } from 'vitest';
import { readCsvRows } from './hevyCsvRows';
import { serializeCsv } from './csvWriter';

describe('serializeCsv', () => {
  it('laisse nues les cellules qui n’ont rien à protéger', () => {
    expect(serializeCsv([['title', 'reps'], ['LOWER A', '12']])).toBe(
      'title,reps\r\nLOWER A,12\r\n',
    );
  });

  it('protège les cellules qui portent une virgule, un guillemet ou un saut de ligne', () => {
    expect(serializeCsv([['a,b', 'c"d', 'e\nf', ' g ']])).toBe(
      '"a,b","c""d","e\nf"," g "\r\n',
    );
  });

  it('rend une chaîne vide sans aucune ligne', () => {
    expect(serializeCsv([])).toBe('');
  });

  /**
   * Le test qui compte : ce qu'on écrit, le lecteur du même dossier doit le
   * relire à l'identique. Deux implémentations d'un même format qui ne se
   * parlent pas, c'est exactement ce que l'aller-retour existe pour empêcher.
   */
  it('se relit à l’identique par le lecteur de l’import', () => {
    const rows = [
      ['title', 'description'],
      ['LOWER A', 'Séance "lourde", jambes'],
      ['Séance libre', 'ligne 1\nligne 2'],
      ['', 'virgule, incluse'],
    ];

    const read = readCsvRows(serializeCsv(rows));

    expect(read.ok).toBe(true);
    expect(read.ok && read.rows.map((row) => row.cells)).toEqual(rows);
  });
});
