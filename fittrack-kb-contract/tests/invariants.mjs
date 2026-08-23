// Invariants sémantiques — les contrôles que JSON Schema ne peut pas exprimer.
//
// Chaque invariant est exécutable. Ceux qui ne le sont pas encore à ce stade
// renvoient NOT_TESTABLE avec la raison : le prompt exige d'indiquer clairement
// toute contrainte non testée plutôt que de la présenter comme validée.

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { projectClaimToWikiEntry } from '../projections/claim-wiki-projection.mjs';
import { contentHashOf } from '../tools/canonical.mjs';
import { resolveCorpusFile } from '../tools/resolve-corpus.mjs';

const sha256 = (s) => 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex');

const loadCorpus = (f, config, root) => {
  if (!f) return { source: null, bytes: null, tried: [] };
  return resolveCorpusFile(f, {
    packageRoot: root,
    repoRoot: join(root, '..'),
    archiveRef: config?.archiveRef
  });
};

// Champs qui se terminent par Ref sans désigner une entité de la KB. Les
// exclure vaut mieux que de les renommer : subjectRef pointe une personne et
// sessionRef une séance, deux objets qui vivent dans l'application et non dans
// le contrat.
const NON_ENTITY_REF_FIELDS = new Set(['subjectRef', 'sessionRef']);

// Collecte récursive de toutes les valeurs de champs dont le nom se termine par
// Ref ou Refs. C'est la base de l'intégrité référentielle : un champ de
// référence ajouté demain est contrôlé sans modifier ce fichier.
function collectRefs(node, path = '', out = []) {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectRefs(v, `${path}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k;
    if (/Refs?$/.test(k) && !NON_ENTITY_REF_FIELDS.has(k)) {
      if (typeof v === 'string') out.push({ field: k, path: p, value: v });
      else if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'string' && out.push({ field: k, path: `${p}[${i}]`, value: x }));
    }
    collectRefs(v, p, out);
  }
  return out;
}

function flattenSchemaPaths(node, path, out) {
  if (node === null || typeof node !== 'object') return;
  if (node.properties && typeof node.properties === 'object') {
    for (const [k, v] of Object.entries(node.properties)) {
      const p = path ? `${path}.${k}` : k;
      out.add(p);
      flattenSchemaPaths(v, p, out);
    }
  }
  if (node.items) flattenSchemaPaths(node.items, path ? `${path}[]` : '[]', out);
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    flattenSchemaPaths(node.additionalProperties, path ? `${path}.*` : '*', out);
  }
  if (node.$defs) {
    for (const [k, v] of Object.entries(node.$defs)) {
      const p = `$defs.${k}`;
      out.add(p);
      flattenSchemaPaths(v, p, out);
    }
  }
}

export function runInvariants({ root, instances, parsed, rel }) {
  const results = [];
  const add = (id, title, status, detail) => results.push({ id, title, status, detail });

  const catalog = parsed.get(join(root, 'schemas/entity-catalog.json'));
  const catalogByKind = new Map(catalog.entities.map((e) => [e.kind, e]));

  const byId = new Map();
  const duplicates = [];
  for (const inst of instances) {
    const id = inst.record.id ?? inst.record.fragmentId ?? inst.record.corpusFileId;
    if (!id) continue;
    if (byId.has(id)) duplicates.push(id);
    else byId.set(id, inst);
  }

  const fragments = parsed.get(join(root, 'fragments/fragments.json'));
  const fragmentIds = new Set((fragments?.fragments ?? []).map((f) => f.fragmentId));
  const corpusManifest = parsed.get(join(root, 'corpus/corpus-manifest.json'));
  const corpusFileIds = new Set((corpusManifest?.files ?? []).map((f) => f.corpusFileId));

  const of = (kind) => instances.filter((i) => i.kind === kind).map((i) => i.record);

  // --- INV-001 Intégrité référentielle ------------------------------------
  {
    const broken = [];
    for (const inst of instances) {
      for (const r of collectRefs(inst.record)) {
        if (r.field === 'fragmentRef' || r.field === 'fragmentRefs' || r.field === 'corpusContextFragmentRefs') {
          if (!fragmentIds.has(r.value)) broken.push(`${inst.file}: ${r.path} -> ${r.value} (fragment inconnu)`);
          continue;
        }
        if (r.field === 'corpusFileRef') {
          if (!corpusFileIds.has(r.value)) broken.push(`${inst.file}: ${r.path} -> ${r.value} (fichier de corpus inconnu)`);
          continue;
        }
        if (r.field === 'kbEntityRef' || !/^(rt|frag|corpus)\./.test(r.value)) {
          if (!byId.has(r.value)) broken.push(`${inst.file}: ${r.path} -> ${r.value} (entité inconnue)`);
        }
      }
    }
    add(
      'INV-001',
      'Intégrité référentielle globale',
      broken.length ? 'FAIL' : 'PASS',
      broken.length ? broken.slice(0, 8).join(' ; ') : `${instances.length} entités, toutes les références résolvent`
    );
  }

  // --- INV-002 Provenance obligatoire -------------------------------------
  {
    const missing = [];
    for (const inst of instances) {
      const meta = catalogByKind.get(inst.kind);
      if (!meta?.requiresCorpusProvenance) continue;
      const p = inst.record.provenance;
      if (!Array.isArray(p) || p.length === 0) missing.push(`${inst.file}: ${inst.record.id}`);
    }
    add(
      'INV-002',
      'Provenance obligatoire sur toute entité canonique',
      missing.length ? 'FAIL' : 'PASS',
      missing.length ? missing.join(' ; ') : 'toute entité de curated/ porte au moins un lien vers un fragment'
    );
  }

  // --- INV-003 Monotonie de certitude -------------------------------------
  {
    const order = { very_low: 0, low: 1, moderate: 2, high: 3, not_applicable: -1 };
    const assessments = of('evidence-assessment');
    const byIdA = new Map(assessments.map((a) => [a.id, a]));
    const problems = [];
    for (const a of assessments) {
      if (!a.supersedes) continue;
      const prev = byIdA.get(a.supersedes);
      if (!prev) continue;
      const prevMax = Math.max(...prev.confidenceByAspect.map((c) => order[c.confidence] ?? -1));
      const curMax = Math.max(...a.confidenceByAspect.map((c) => order[c.confidence] ?? -1));
      if (curMax > prevMax) {
        const added = (a.sourceRefs ?? []).filter((s) => !(prev.sourceRefs ?? []).includes(s));
        if (added.length === 0) {
          problems.push(`${a.id} relève la confiance sans ajouter de source par rapport à ${prev.id}`);
        }
      }
    }
    add(
      'INV-003',
      'Monotonie de certitude : pas de hausse sans preuve nouvelle',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : `${assessments.filter((a) => a.supersedes).length} chaîne(s) de révision contrôlée(s)`
    );
  }

  // --- INV-004 Conservation de cannotConclude dans les projections ---------
  {
    const claims = of('claim');
    const lost = [];
    for (const c of claims) {
      if (!Array.isArray(c.cannotConclude)) {
        lost.push(`${c.id} : champ absent`);
        continue;
      }
      const projected = projectClaimToWikiEntry(c);
      const kept = projected.cannotConclude ?? [];
      if (kept.length !== c.cannotConclude.length || c.cannotConclude.some((x) => !kept.includes(x))) {
        lost.push(`${c.id} : perdu à la projection`);
      }
    }
    add(
      'INV-004',
      'cannotConclude conservé dans toutes les projections',
      lost.length ? 'FAIL' : 'PASS',
      lost.length ? lost.join(' ; ') : `${claims.length} claims projetées, aucun contenu perdu`
    );
  }

  // --- INV-005 EMG ≠ hypertrophie -----------------------------------------
  {
    const problems = [];
    const claims = of('claim');
    const claimById = new Map(claims.map((c) => [c.id, c]));
    const outcomes = new Map(of('outcome').map((o) => [o.id, o]));

    for (const a of of('evidence-assessment')) {
      if (a.directness === 'emg_only' && a.supportsHypertrophySuperiority === true) {
        problems.push(`${a.id} : preuve EMG déclarée soutenir une supériorité hypertrophique`);
      }
    }
    for (const c of claims) {
      if (c.knowledgeType !== 'EMG_OBSERVATION') continue;
      for (const oRef of c.outcomeRefs ?? []) {
        const o = outcomes.get(oRef);
        if (!o) continue;
        if (['muscle_size', 'regional_muscle_size'].includes(o.construct) && !o.isProxyFor) {
          problems.push(`${c.id} : claim EMG rattachée à un outcome de taille musculaire non déclaré proxy (${oRef})`);
        }
      }
    }
    for (const s of of('substitution-relation')) {
      const refs = s.justification?.claimRefs ?? [];
      const emg = refs.filter((r) => claimById.get(r)?.knowledgeType === 'EMG_OBSERVATION');
      if (emg.length && s.objective?.forHypertrophy === 'equivalent') {
        problems.push(`${s.id} : équivalence hypertrophique justifiée par une claim EMG (${emg.join(', ')})`);
      }
    }
    add(
      'INV-005',
      'Une mesure EMG ne devient jamais une preuve hypertrophique',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : 'aucune promotion EMG → hypertrophie détectée'
    );
  }

  // --- INV-006 Biomécanique ≠ risque clinique démontré ---------------------
  {
    const problems = [];
    const jlo = new Map(of('joint-load-observation').map((o) => [o.id, o]));
    for (const o of jlo.values()) {
      if (o.observationType === 'risque_demontre' && !o.epidemiologicalEvidence) {
        problems.push(`${o.id} : risque démontré sans donnée épidémiologique`);
      }
    }
    for (const ci of of('contraindication')) {
      for (const r of collectRefs(ci)) {
        if (jlo.has(r.value)) {
          problems.push(`${ci.id} : contre-indication justifiée par une observation de charge (${r.value})`);
        }
      }
    }
    for (const a of of('evidence-assessment')) {
      if (['biomechanical_only', 'mechanistic_hypothesis', 'animal_model'].includes(a.directness) && a.supportsDemonstratedClinicalRisk === true) {
        problems.push(`${a.id} : preuve biomécanique déclarée soutenir un risque clinique démontré`);
      }
    }
    add(
      'INV-006',
      'Une observation biomécanique ne devient jamais un risque démontré',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : 'aucune conversion charge mécanique → danger détectée'
    );
  }

  // --- INV-007 Priorité des red flags -------------------------------------
  {
    const problems = [];
    const redFlags = of('red-flag');
    const referral = of('referral-rule');
    for (const r of of('adaptation-rule')) {
      if (r.yieldsToActiveRedFlag !== true) problems.push(`${r.id} : ne cède pas devant un red flag actif`);
    }
    for (const z of of('safety-zone')) {
      if (z.zone === 'RED' && (z.haltsNormalCoaching !== true || !(z.referralRuleRefs ?? []).length)) {
        problems.push(`${z.id} : zone RED sans arrêt du coaching ou sans voie d'orientation`);
      }
    }
    for (const rf of redFlags) {
      if (rf.urgency !== 'emergency_now') continue;
      const covered = referral.some((rr) => (rr.redFlagRefs ?? []).includes(rf.id));
      if (!covered) problems.push(`${rf.id} : urgence immédiate sans règle d'orientation associée`);
    }
    add(
      'INV-007',
      "Un red flag actif ne peut pas être contourné par le flux normal",
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : `${redFlags.length} red flags, ${of('adaptation-rule').length} règles d'adaptation contrôlées`
    );
  }

  // --- INV-008 Justification des contre-indications ------------------------
  {
    const problems = [];
    for (const ci of of('contraindication')) {
      if (ci.basis === 'red_flag') {
        const t = byId.get(ci.redFlagRef);
        if (!t || t.kind !== 'red-flag') problems.push(`${ci.id} : redFlagRef ne pointe pas un red flag`);
      } else if (ci.basis === 'explicit_guideline_statement') {
        if (!ci.quotedStatement || !(ci.sourceRefs ?? []).length) problems.push(`${ci.id} : énoncé cité ou source manquants`);
      } else if (ci.basis === 'clinician_order') {
        if (!ci.clinicianInstructionRef) problems.push(`${ci.id} : consigne de professionnel non référencée`);
      }
    }
    add(
      'INV-008',
      'Toute contre-indication repose sur un fondement admissible et vérifié',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : `${of('contraindication').length} contre-indication(s) justifiée(s)`
    );
  }

  // --- INV-009 Aucune fusion inter-fichiers automatique --------------------
  {
    const problems = [];
    for (const inst of instances) {
      const p = inst.record.provenance;
      if (!Array.isArray(p) || p.length < 2) continue;
      const files = new Set(p.map((x) => x.corpusFileRef));
      // Une entité dont la provenance croise deux fichiers du corpus n'est
      // légitime que si une décision humaine a explicitement accepté le
      // rapprochement. Sans elle, c'est une fusion inter-fichiers automatique.
      const decided = inst.record.reviewDecisionRef ?? inst.record.crossFileMergeDecisionRef;
      if (files.size > 1 && !decided) {
        problems.push(`${inst.record.id} : provenance multi-fichiers sans décision de revue`);
      }
    }
    for (const sr of of('source-resolution')) {
      if (sr.mergeAllowed && !['identical_doi', 'identical_pmid', 'human_review_decision'].includes(sr.mergeBasis)) {
        problems.push(`${sr.id} : fusion sans identifiant fort ni décision humaine`);
      }
      if (sr.status === 'ambiguous' && sr.mergeAllowed) {
        problems.push(`${sr.id} : conflit d'attribution fusionné`);
      }
    }
    add(
      'INV-009',
      'Aucune fusion automatique entre fichiers ou sur similarité',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : 'aucune fusion non fondée détectée'
    );
  }

  // --- INV-010 Stabilité des IDs et rôle du hash ---------------------------
  {
    const registryPath = join(root, 'governance/id-registry.json');
    const registry = parsed.get(registryPath);
    const problems = [];
    if (!registry) {
      add('INV-010', 'Stabilité des identifiants', 'FAIL', 'governance/id-registry.json introuvable');
    } else {
      const known = new Map(registry.entries.map((e) => [e.id, e]));
      for (const [id, inst] of byId) {
        if (/^(frag|corpus|rt)\./.test(id)) continue;
        const e = known.get(id);
        if (!e) {
          problems.push(`${id} absent du registre`);
          continue;
        }
        if (e.kind !== inst.kind) problems.push(`${id} : kind du registre (${e.kind}) ≠ kind de l'instance (${inst.kind})`);
        if (inst.record.slug && e.currentSlug !== inst.record.slug) {
          problems.push(`${id} : slug courant du registre (${e.currentSlug}) ≠ slug de l'instance (${inst.record.slug})`);
        }
        if (inst.record.revision && e.currentRevision !== inst.record.revision) {
          problems.push(`${id} : révision du registre (${e.currentRevision}) ≠ révision de l'instance (${inst.record.revision})`);
        }
      }
      // Le hash détecte un changement mais ne fait pas l'identité : on vérifie
      // qu'il est bien calculé sur le contenu hors identité, sinon renommer un
      // slug changerait le hash et laisserait croire à une modification de fond.
      for (const [id, inst] of byId) {
        const h = inst.record.contentHash;
        // Sur un CorpusFile, contentHash est le hash du FICHIER, pas celui de
        // l'enregistrement : le recalculer comme une entité n'aurait aucun sens.
        if (!h || /^(corpus|frag|rt)\./.test(id)) continue;
        if (h !== contentHashOf(inst.record)) {
          problems.push(`${id} : contentHash ne correspond pas au contenu normalisé`);
        }
      }
      add(
        'INV-010',
        'Stabilité des identifiants ; le hash détecte, il n identifie pas',
        problems.length ? 'FAIL' : 'PASS',
        problems.length ? problems.slice(0, 8).join(' ; ') : `${known.size} identifiants au registre, tous cohérents`
      );
    }
  }

  // --- INV-011 Idempotence -------------------------------------------------
  {
    const config = parsed.get(join(root, 'corpus/corpus-files.config.json'));
    const resolved = new Map((config?.files ?? []).map((f) => [f.corpusFileId, loadCorpus(f, config, root)]));
    const available =
      (config?.files ?? []).length > 0 && [...resolved.values()].every((hit) => hit.bytes);
    if (!available) {
      add(
        'INV-011',
        'Idempotence de la fragmentation',
        'NOT_TESTABLE',
        'les fichiers du corpus ne sont pas accessibles (fetcher archive/fittrack-kb-corpus) ; relancer ensuite'
      );
    } else {
      const spec = parsed.get(join(root, 'fragments/fragment-spec.json'));
      const onDisk = parsed.get(join(root, 'fragments/fragments.json'));
      const problems = [];
      for (const fs of spec.fragments) {
        const lines = resolved.get(fs.corpusFileId).bytes.toString('utf8').split('\n');
        const raw = lines.slice(fs.startLine - 1, fs.endLine).join('\n');
        const stored = onDisk.fragments.find((f) => f.fragmentId === fs.fragmentId);
        if (!stored) {
          problems.push(`${fs.fragmentId} absent de fragments.json`);
          continue;
        }
        if (stored.rawText !== raw) problems.push(`${fs.fragmentId} : texte recalculé différent`);
        if (stored.textHash !== sha256(raw)) problems.push(`${fs.fragmentId} : hash recalculé différent`);
      }
      add(
        'INV-011',
        'Idempotence : deux exécutions sur le même corpus produisent la même sortie',
        problems.length ? 'FAIL' : 'PASS',
        problems.length ? problems.slice(0, 5).join(' ; ') : `${spec.fragments.length} fragments recalculés à l identique`
      );
    }
  }

  // --- INV-012 Conservation de l'historique --------------------------------
  {
    const problems = [];
    const decisions = new Map(of('review-decision').map((d) => [d.id, d]));
    for (const a of of('evidence-assessment')) {
      if (a.supersedes && !byId.has(a.supersedes)) {
        problems.push(`${a.id} : l évaluation remplacée ${a.supersedes} a disparu`);
      }
    }
    for (const inst of instances) {
      const lc = inst.record.lifecycle;
      if (!lc) continue;
      if (lc.status === 'retired') {
        const d = decisions.get(lc.retirementDecisionRef);
        if (!d) problems.push(`${inst.record.id} : retrait sans décision de revue`);
        else if (!['retire', 'supersede'].includes(d.action)) problems.push(`${inst.record.id} : décision de retrait de type inattendu (${d.action})`);
      }
      if (lc.status === 'superseded' && !byId.has(lc.supersededBy)) {
        problems.push(`${inst.record.id} : supersededBy pointe une entité absente`);
      }
    }
    add(
      'INV-012',
      "Conservation de l'historique : rien ne disparaît sans décision tracée",
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.join(' ; ') : 'aucune entité remplacée ou retirée sans trace'
    );
  }

  // --- INV-013 Aucune perte pendant la migration clinique -------------------
  {
    const config = parsed.get(join(root, 'corpus/corpus-files.config.json'));
    const f4 = loadCorpus(
      config?.files?.find((f) => f.corpusFileId === 'corpus.f4.schema-ia-coaching'),
      config,
      root
    );
    const mapping = parsed.get(join(root, 'mappings/clinical-schema-migration.json'));
    if (!f4.bytes) {
      add('INV-013', 'Aucune perte silencieuse dans la migration clinique', 'NOT_TESTABLE', 'fichier F4 inaccessible');
    } else if (!mapping) {
      add('INV-013', 'Aucune perte silencieuse dans la migration clinique', 'FAIL', 'mappings/clinical-schema-migration.json introuvable');
    } else {
      const schema = JSON.parse(f4.bytes.toString('utf8'));
      const paths = new Set();
      flattenSchemaPaths(schema, '', paths);
      const covered = new Set(mapping.mappings.map((m) => m.sourcePath));
      const missing = [...paths].filter((p) => !covered.has(p));
      const extra = [...covered].filter((p) => !paths.has(p));
      const problems = [];
      if (missing.length) problems.push(`${missing.length} champ(s) de F4 non couvert(s) : ${missing.slice(0, 6).join(', ')}`);
      if (extra.length) problems.push(`${extra.length} chemin(s) du mapping absent(s) de F4 : ${extra.slice(0, 6).join(', ')}`);
      add(
        'INV-013',
        'Aucune perte silencieuse dans la migration clinique',
        problems.length ? 'FAIL' : 'PASS',
        problems.length ? problems.join(' ; ') : `${paths.size} chemins de F4 énumérés depuis le fichier réel, tous couverts par le mapping`
      );
    }
  }

  // --- INV-014 Unicité des identifiants ------------------------------------
  add(
    'INV-014',
    'Unicité des identifiants',
    duplicates.length ? 'FAIL' : 'PASS',
    duplicates.length ? `doublons : ${[...new Set(duplicates)].join(', ')}` : `${byId.size} identifiants distincts`
  );

  // --- INV-015 Séparation KB / POLICY / RUNTIME ----------------------------
  {
    const problems = [];
    const runtimeOnlyFields = ['testedLoad', 'symptomDuring', 'symptomAfter24h', 'irritability', 'testedRange'];
    for (const inst of instances) {
      const meta = catalogByKind.get(inst.kind);
      if (!meta) continue;
      const text = JSON.stringify(inst.record);
      if (meta.space === 'runtime') {
        if (inst.record.provenance) problems.push(`${inst.record.id} : entité runtime porteuse d une provenance de corpus`);
        if (!/^rt\./.test(inst.record.id ?? '')) problems.push(`${inst.record.id} : identifiant runtime sans préfixe rt.`);
      } else {
        for (const f of runtimeOnlyFields) {
          if (new RegExp(`"${f}"\\s*:`).test(text)) {
            problems.push(`${inst.record.id} (${inst.kind}) : champ runtime « ${f} » présent hors du runtime`);
          }
        }
        for (const r of collectRefs(inst.record)) {
          if (/^rt\./.test(r.value)) problems.push(`${inst.record.id} : référence vers une entité runtime (${r.value})`);
        }
      }
      if (meta.isNormative && inst.record.lifecycle && !inst.record.lifecycle.reviewedAt) {
        problems.push(`${inst.record.id} : entité normative sans date de revue`);
      }
      if (meta.space === 'policies' && inst.record.presentedAsMedicalTruth !== false) {
        problems.push(`${inst.record.id} : politique produit non déclarée comme non médicale`);
      }
    }
    add(
      'INV-015',
      'Séparation stricte KB / POLICY / RUNTIME',
      problems.length ? 'FAIL' : 'PASS',
      problems.length ? problems.slice(0, 8).join(' ; ') : 'aucune fuite de couche détectée'
    );
  }

  return { results };
}
