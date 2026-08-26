import { describe, expect, it } from 'vitest';
import {
  findProgrammingSection,
  programmingIsUnreviewed,
  programmingRowCount,
  programmingSections,
} from './programmingIndex';

describe('programmingIndex', () => {
  it('couvre les 19 sections du document de programmation', () => {
    expect(programmingSections).toHaveLength(19);
    const rows = programmingSections.flatMap((section) => section.rows);
    expect(rows).toHaveLength(102);
  });

  it('sépare les fiches des références bibliographiques', () => {
    const rows = programmingSections.flatMap((section) => section.rows);
    const bibliography = rows.filter((row) => row.isBibliography);
    // Les 26 lignes de la section « Publications majeures » sont des
    // métadonnées, pas du contenu : les mêler aux fiches gonflerait le compte
    // affiché de 34 % sans rien apprendre à personne.
    expect(bibliography).toHaveLength(26);
    expect(programmingRowCount).toBe(rows.length - bibliography.length);
  });

  it('couvre les sujets qui manquaient au corpus de prose', () => {
    const titles = programmingSections.map((section) => section.title).join(' | ');
    for (const sujet of ['Volume', 'Fréquence', 'Deload', 'Ordre des exercices', 'Tempo']) {
      expect(titles, `sujet absent : ${sujet}`).toContain(sujet);
    }
  });

  it('donne des identifiants uniques et utilisables dans une URL', () => {
    const ids = programmingSections.map((section) => section.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^f1-[a-z0-9][a-z0-9-]*$/u);
  });

  it('ordonne les fiches dans l’ordre du document source', () => {
    for (const section of programmingSections) {
      const starts = section.rows.map((row) => row.startByte);
      expect([...starts].sort((left, right) => left - right)).toEqual(starts);
    }
  });

  it('garde chaque fiche ancrée à ses octets', () => {
    for (const section of programmingSections) {
      for (const row of section.rows) {
        expect(row.endByte, row.rowId).toBeGreaterThan(row.startByte);
        expect(row.fields.length, row.rowId).toBeGreaterThan(0);
      }
    }
  });

  it('signale que rien n’a été relu par un humain', () => {
    // Tant que ce drapeau est vrai, l'interface doit afficher le bandeau. Le
    // jour où une relecture a lieu, ce test échouera — c'est voulu : il faudra
    // alors décider consciemment de retirer l'avertissement.
    expect(programmingIsUnreviewed).toBe(true);
  });

  it('retrouve une section par son identifiant', () => {
    const first = programmingSections[0]!;
    expect(findProgrammingSection(first.sectionId)?.title).toBe(first.title);
    expect(findProgrammingSection('f1-inexistante')).toBeUndefined();
  });
});
