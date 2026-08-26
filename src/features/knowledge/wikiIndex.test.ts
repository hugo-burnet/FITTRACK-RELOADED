import { describe, expect, it } from 'vitest';
import indexDocument from './evidence-index.json';
import { findSectionIdForClaim, findWikiSection, type WikiSection } from './wikiIndex';

function collectReachableSections(): WikiSection[] {
  const sectionIds = new Set(
    indexDocument.claims
      .map((claim) => findSectionIdForClaim(claim.claimId))
      .filter((sectionId): sectionId is string => sectionId !== undefined),
  );
  return [...sectionIds]
    .map((sectionId) => findWikiSection(sectionId))
    .filter((section): section is WikiSection => section !== undefined);
}

const reachableSections = collectReachableSections();

describe('wikiIndex', () => {
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
    expect(titlesByCode.size).toBe(2);
  });

  it('dérive une section par titre source distinct', () => {
    const distinctTitles = new Set(indexDocument.claims.map((claim) => claim.sourceTitle));
    expect(reachableSections).toHaveLength(distinctTitles.size);
    expect(reachableSections).toHaveLength(64);
  });

  it('ne perd ni ne duplique aucune affirmation', () => {
    const claimIds = reachableSections.flatMap((section) =>
      section.passages.flatMap((passage) => passage.claimIds),
    );
    expect(new Set(claimIds).size).toBe(claimIds.length);
    expect(claimIds).toHaveLength(indexDocument.claims.length);
  });

  it('replie les 408 affirmations sur les 209 passages réellement distincts', () => {
    const passages = reachableSections.flatMap((section) => section.passages);
    expect(passages).toHaveLength(209);
    // Un passage cité deux fois dans une page se lirait comme un bégaiement.
    const texts = passages.map((passage) => passage.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('n’affiche jamais un passage déjà contenu dans un autre de la même page', () => {
    // La déduplication par égalité stricte laissait passer les contextes
    // imbriqués — l'un porte la phrase, l'autre le paragraphe qui la contient.
    // 57 des 266 passages étaient dans ce cas, sur 36 sections des 64.
    for (const section of reachableSections) {
      for (const passage of section.passages) {
        const swallowed = section.passages.some(
          (other) => other !== passage && other.text.includes(passage.text),
        );
        expect(swallowed, `${section.sectionId} : « ${passage.text.slice(0, 50)}… »`).toBe(false);
      }
    }
  });

  it('situe chaque section par le titre de son document', () => {
    for (const section of reachableSections) {
      expect(section.documentTitle.length).toBeGreaterThan(10);
      // Le titre du document n'est jamais le titre de la section : sinon le
      // sous-titre de l'écran répéterait mot pour mot son titre.
      expect(section.documentTitle).not.toBe(section.title);
    }
  });

  it('donne des identifiants de section uniques et utilisables dans une URL', () => {
    const ids = reachableSections.map((section) => section.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/u);
  });

  it('ordonne les passages dans l’ordre du document source, pas par pertinence', () => {
    for (const section of reachableSections) {
      const starts = section.passages.map((passage) => passage.startByte);
      expect([...starts].sort((left, right) => left - right)).toEqual(starts);
    }
  });

  it('expose la prose et jamais un fragment de phrase', () => {
    // 18 % des affirmations sont des bouts de phrase (« et une rotation interne. »).
    // Ils sont de bonnes unités de récupération et de la très mauvaise prose.
    const fragment = indexDocument.claims.find((claim) => claim.rawQuote.length < 45);
    expect(fragment).toBeDefined();
    const texts = new Set(
      reachableSections.flatMap((section) => section.passages.map((p) => p.text)),
    );
    expect(texts.has(fragment!.rawQuote)).toBe(false);
    expect([...texts].some((text) => text.includes(fragment!.rawQuote))).toBe(true);
  });

  it('ramène chaque affirmation à sa section, sans exception', () => {
    // Un résultat de recherche qui ne retrouve pas sa section resterait un
    // extrait flottant, et le wiki n'aurait rien ajouté à la recherche seule.
    for (const claim of indexDocument.claims) {
      expect(findSectionIdForClaim(claim.claimId), claim.claimId).toBeDefined();
    }
    expect(findSectionIdForClaim('claim.inexistant')).toBeUndefined();
  });

  it('retrouve une section par son identifiant, et rien par un identifiant inconnu', () => {
    const first = reachableSections[0]!;
    expect(findWikiSection(first.sectionId)?.title).toBe(first.title);
    expect(findWikiSection('section-qui-n-existe-pas')).toBeUndefined();
  });
});
