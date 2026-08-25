import { describe, expect, it } from 'vitest';
import indexDocument from './evidence-index.json';
import { findWikiSection, wikiDocuments, wikiSections } from './wikiIndex';

describe('wikiIndex', () => {
  it('dérive les deux documents du corpus', () => {
    expect(wikiDocuments).toHaveLength(2);
    for (const document of wikiDocuments) {
      expect(document.title.length).toBeGreaterThan(10);
      expect(document.sections.length).toBeGreaterThan(0);
    }
  });

  it('ne laisse jamais un code de document recouvrir deux titres', () => {
    // `f2` et `e5f2` sont deux passes d'extraction du même fichier et sont
    // repliés sur un seul code. Si ce repli devenait faux, deux documents
    // fusionneraient en silence et l'ordre de lecture n'aurait plus de sens.
    const titlesByCode = new Map<string, Set<string>>();
    for (const claim of indexDocument.claims) {
      const code = (claim.fragmentId.split('.')[1] ?? '').replace(/^e5/u, '');
      const title = claim.sourceTitle.split(' › ')[0]!;
      if (!titlesByCode.has(code)) titlesByCode.set(code, new Set());
      titlesByCode.get(code)!.add(title);
    }
    for (const [code, titles] of titlesByCode) {
      expect(titles.size, `le code ${code} recouvre ${titles.size} titres`).toBe(1);
    }
    expect(titlesByCode.size).toBe(wikiDocuments.length);
  });

  it('dérive une section par titre source distinct', () => {
    const distinctTitles = new Set(indexDocument.claims.map((claim) => claim.sourceTitle));
    expect(wikiSections).toHaveLength(distinctTitles.size);
    expect(wikiSections).toHaveLength(64);
  });

  it('ne perd ni ne duplique aucune affirmation', () => {
    const claimIds = wikiSections.flatMap((section) =>
      section.passages.flatMap((passage) => passage.claimIds),
    );
    expect(new Set(claimIds).size).toBe(claimIds.length);
    expect(claimIds).toHaveLength(indexDocument.claims.length);
  });

  it('replie les 408 affirmations sur les 266 passages réellement distincts', () => {
    const passages = wikiSections.flatMap((section) => section.passages);
    expect(passages).toHaveLength(266);
    // Un passage cité deux fois dans une page se lirait comme un bégaiement.
    const texts = passages.map((passage) => passage.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('donne des identifiants de section uniques et utilisables dans une URL', () => {
    const ids = wikiSections.map((section) => section.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/u);
  });

  it('ordonne les passages dans l’ordre du document source, pas par pertinence', () => {
    for (const section of wikiSections) {
      const starts = section.passages.map((passage) => passage.startByte);
      expect([...starts].sort((left, right) => left - right)).toEqual(starts);
    }
  });

  it('ordonne aussi les sections dans l’ordre du document', () => {
    for (const document of wikiDocuments) {
      const starts = document.sections.map((section) => section.passages[0]?.startByte ?? 0);
      expect([...starts].sort((left, right) => left - right)).toEqual(starts);
    }
  });

  it('expose la prose et jamais un fragment de phrase', () => {
    // 18 % des affirmations sont des bouts de phrase (« et une rotation interne. »).
    // Ils sont de bonnes unités de récupération et de la très mauvaise prose.
    const fragment = indexDocument.claims.find((claim) => claim.rawQuote.length < 45);
    expect(fragment).toBeDefined();
    const texts = new Set(wikiSections.flatMap((s) => s.passages.map((p) => p.text)));
    expect(texts.has(fragment!.rawQuote)).toBe(false);
    expect([...texts].some((text) => text.includes(fragment!.rawQuote))).toBe(true);
  });

  it('retrouve une section par son identifiant, et rien par un identifiant inconnu', () => {
    const first = wikiSections[0]!;
    expect(findWikiSection(first.sectionId)?.title).toBe(first.title);
    expect(findWikiSection('section-qui-n-existe-pas')).toBeUndefined();
  });
});
