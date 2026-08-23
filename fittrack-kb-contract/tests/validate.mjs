#!/usr/bin/env node
// Validation complète du contrat.
//
// Ce script n'est pas décoratif : VALIDATION_REPORT.md est écrit à partir de sa
// sortie, et le prompt de phase 2 interdit de déclarer le paquet valide sans
// avoir réellement exécuté les tests.
//
// Étapes :
//   1. tous les JSON sont syntaxiquement valides
//   2. tous les schemas compilent et tous les $ref résolvent localement
//   3. les vocabulaires générés sont cohérents avec leur source
//   4. les fixtures valides passent leur schéma
//   5. les fixtures invalides échouent, et pour la RAISON attendue
//   6. les invariants sémantiques (tests/invariants.mjs) passent

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { runInvariants } from './invariants.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const results = { steps: [], failures: [], warnings: [] };
const ok = (step, detail) => results.steps.push({ step, status: 'PASS', detail });
const fail = (step, detail) => {
  results.steps.push({ step, status: 'FAIL', detail });
  results.failures.push(`${step} — ${detail}`);
};

function walk(dir, filter) {
  const out = [];
  const visit = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules') continue;
        visit(p);
      } else if (filter(name)) out.push(p);
    }
  };
  visit(dir);
  return out.sort();
}

const rel = (p) => relative(root, p).split(sep).join('/');

// --- 1. Syntaxe JSON ------------------------------------------------------
const allJson = walk(root, (n) => n.endsWith('.json')).filter(
  (p) => !rel(p).startsWith('node_modules/') && rel(p) !== 'package-lock.json'
);
const parsed = new Map();
let syntaxErrors = 0;
for (const p of allJson) {
  try {
    parsed.set(p, JSON.parse(readFileSync(p, 'utf8')));
  } catch (e) {
    syntaxErrors++;
    fail('1. Syntaxe JSON', `${rel(p)} : ${e.message}`);
  }
}
if (!syntaxErrors) ok('1. Syntaxe JSON', `${allJson.length} fichiers JSON analysés, 0 erreur`);

// --- 2. Compilation des schemas et résolution des $ref ---------------------
const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
addFormats(ajv);

const schemaFiles = walk(join(root, 'schemas'), (n) => n.endsWith('.schema.json')).concat(
  walk(join(root, 'extraction-contract'), (n) => n.endsWith('.schema.json'))
);
const byId = new Map();
for (const p of schemaFiles) {
  const s = parsed.get(p);
  if (!s || !s.$id) {
    fail('2. Schemas', `${rel(p)} : $id manquant`);
    continue;
  }
  if (byId.has(s.$id)) {
    fail('2. Schemas', `$id dupliqué : ${s.$id}`);
    continue;
  }
  byId.set(s.$id, p);
  try {
    ajv.addSchema(s, s.$id);
  } catch (e) {
    fail('2. Schemas', `${rel(p)} : ${e.message}`);
  }
}

const compiled = new Map();
let refErrors = 0;
for (const [id, p] of byId) {
  try {
    compiled.set(id, ajv.getSchema(id) ?? ajv.compile(parsed.get(p)));
  } catch (e) {
    refErrors++;
    fail('2. Schemas', `compilation de ${rel(p)} : ${e.message}`);
  }
}
if (!refErrors && byId.size)
  ok('2. Schemas', `${byId.size} schemas compilés, tous les $ref résolus localement`);

// --- 3. Cohérence vocabulaires ↔ enums de schéma ---------------------------
{
  const src = parsed.get(join(root, 'vocabularies/vocabularies.source.json'));
  const vocabSchema = parsed.get(join(root, 'schemas/common/vocab.schema.json'));
  const vocabFileSchema = compiled.get('https://fittrack.local/kb/schemas/common/vocabulary-file.schema.json');
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  let mismatches = 0;

  for (const v of src.vocabularies) {
    const def = vocabSchema.$defs[camel(v.vocabularyId)];
    const expected = v.terms.map((t) => t.term);
    if (!def) {
      mismatches++;
      fail('3. Vocabulaires', `${v.vocabularyId} absent de vocab.schema.json`);
      continue;
    }
    if (JSON.stringify(def.enum) !== JSON.stringify(expected)) {
      mismatches++;
      fail('3. Vocabulaires', `${v.vocabularyId} : enum du schéma divergent de la source`);
    }
    const filePath = join(root, 'vocabularies', `${v.vocabularyId}.vocab.json`);
    const file = parsed.get(filePath);
    if (!file) {
      mismatches++;
      fail('3. Vocabulaires', `${v.vocabularyId}.vocab.json manquant`);
      continue;
    }
    if (vocabFileSchema && !vocabFileSchema(file)) {
      mismatches++;
      fail('3. Vocabulaires', `${v.vocabularyId}.vocab.json invalide : ${ajv.errorsText(vocabFileSchema.errors)}`);
    }
  }
  if (!mismatches)
    ok('3. Vocabulaires', `${src.vocabularies.length} vocabulaires, enums et fichiers cohérents avec la source`);
}

// --- 4 & 5. Fixtures ------------------------------------------------------
const entityCatalog = parsed.get(join(root, 'schemas/entity-catalog.json'));

function schemaIdForKind(kind) {
  const entry = entityCatalog.entities.find((e) => e.kind === kind);
  return entry ? entry.schemaId : null;
}

// Chargement de toutes les instances (golden set + valid) pour la validation
// et pour les invariants.
const instances = [];
function loadInstanceFile(p) {
  const data = parsed.get(p);
  if (!data) return;
  // Deux formes acceptées : un fichier mono-kind, ou un fichier regroupant
  // plusieurs collections. Le regroupement évite d'éparpiller le golden set en
  // quarante fichiers d'une entité chacun.
  const collections = Array.isArray(data.collections)
    ? data.collections
    : Array.isArray(data.records)
      ? [{ kind: data.kind, records: data.records }]
      : null;
  if (!collections) {
    fail('4. Fixtures valides', `${rel(p)} : attendu { kind, records } ou { collections: [...] }`);
    return;
  }
  for (const c of collections) {
    for (const rec of c.records) instances.push({ kind: c.kind, record: rec, file: rel(p) });
  }
}

const validFiles = walk(join(root, 'fixtures/valid'), (n) => n.endsWith('.json')).concat(
  walk(join(root, 'fixtures/golden-set'), (n) => n.endsWith('.json'))
);
for (const p of validFiles) loadInstanceFile(p);

{
  let bad = 0;
  for (const { kind, record, file } of instances) {
    const id = schemaIdForKind(kind);
    if (!id) {
      bad++;
      fail('4. Fixtures valides', `${file} : kind « ${kind} » absent du catalogue d'entités`);
      continue;
    }
    const v = compiled.get(id);
    if (!v) {
      bad++;
      fail('4. Fixtures valides', `${file} : schéma ${id} non compilé`);
      continue;
    }
    if (!v(record)) {
      bad++;
      fail(
        '4. Fixtures valides',
        `${file} → ${record.id ?? record.fragmentId ?? record.corpusFileId ?? '?'} : ${ajv.errorsText(v.errors, { separator: ' | ' })}`
      );
    }
  }
  if (!bad) ok('4. Fixtures valides', `${instances.length} instances validées contre leur schéma`);
}

const expectations = parsed.get(join(root, 'fixtures/invalid/expectations.json'));
{
  let bad = 0;
  let schemaCases = 0;
  let invariantCases = 0;

  for (const exp of expectations.cases) {
    const p = join(root, 'fixtures/invalid', exp.file);
    const data = parsed.get(p);
    if (!data) {
      bad++;
      fail('5. Fixtures invalides', `${exp.file} : fichier introuvable ou JSON illisible`);
      continue;
    }
    const entry = (data.collections ?? [{ kind: data.kind, records: data.records }]).find(
      (c) => c.records.some((r) => (r.id ?? r.fragmentId) === exp.recordId)
    );
    if (!entry) {
      bad++;
      fail('5. Fixtures invalides', `${exp.file} : enregistrement ${exp.recordId} introuvable`);
      continue;
    }
    const record = entry.records.find((r) => (r.id ?? r.fragmentId) === exp.recordId);

    if (exp.failsAt === 'schema') {
      schemaCases++;
      const v = compiled.get(schemaIdForKind(entry.kind));
      if (!v) {
        bad++;
        fail('5. Fixtures invalides', `${exp.file} : schéma introuvable pour kind ${entry.kind}`);
        continue;
      }
      if (v(record)) {
        bad++;
        fail('5. Fixtures invalides', `${exp.id} : le schéma ACCEPTE un cas qui doit échouer`);
        continue;
      }
      // On exige que l'échec vienne bien de la contrainte visée, pas d'une
      // coquille : une fixture qui échoue pour la mauvaise raison ne teste rien.
      const text = JSON.stringify(v.errors);
      if (!exp.expectedErrorContains.every((needle) => text.includes(needle))) {
        bad++;
        fail(
          '5. Fixtures invalides',
          `${exp.id} : échoue mais pas pour la raison attendue. Attendu ${JSON.stringify(
            exp.expectedErrorContains
          )}, obtenu ${ajv.errorsText(v.errors, { separator: ' | ' }).slice(0, 300)}`
        );
      }
    } else if (exp.failsAt === 'invariant') {
      invariantCases++;
      // Un cas qui viole un invariant peut parfaitement être valide au sens du
      // schéma : c'est même l'intérêt de ces quinze contrôles. On l'injecte
      // dans le jeu et on exige que l'invariant nommé bascule en échec.
      const injected = instances.concat([{ kind: entry.kind, record, file: `invalid/${exp.file}` }]);
      const r = runInvariants({ root, instances: injected, parsed, rel }).results.find(
        (x) => x.id === exp.expectedInvariant
      );
      if (!r) {
        bad++;
        fail('5. Fixtures invalides', `${exp.id} : invariant ${exp.expectedInvariant} inconnu`);
        continue;
      }
      if (r.status !== 'FAIL') {
        bad++;
        fail(
          '5. Fixtures invalides',
          `${exp.id} : ${exp.expectedInvariant} n a PAS échoué alors qu il devait (${r.status})`
        );
        continue;
      }
      if (!(exp.expectedDetailContains ?? []).every((n) => r.detail.includes(n))) {
        bad++;
        fail(
          '5. Fixtures invalides',
          `${exp.id} : ${exp.expectedInvariant} échoue mais pas pour la raison attendue — ${r.detail.slice(0, 300)}`
        );
      }
    } else {
      bad++;
      fail('5. Fixtures invalides', `${exp.id} : failsAt inconnu (${exp.failsAt})`);
    }
  }
  if (!bad)
    ok(
      '5. Fixtures invalides',
      `${expectations.cases.length} cas rejetés pour la raison attendue (${schemaCases} par le schéma, ${invariantCases} par un invariant)`
    );
}

// --- 6. Invariants sémantiques --------------------------------------------
const invReport = runInvariants({ root, instances, parsed, rel });
for (const r of invReport.results) {
  if (r.status === 'PASS') ok(`6. ${r.id}`, `${r.title} — ${r.detail}`);
  else if (r.status === 'NOT_TESTABLE') results.warnings.push(`${r.id} — ${r.title} : ${r.detail}`);
  else fail(`6. ${r.id}`, `${r.title} — ${r.detail}`);
}

// --- Sortie ---------------------------------------------------------------
const summary = {
  generatedAt: new Date().toISOString().slice(0, 10),
  totals: {
    jsonFiles: allJson.length,
    schemas: byId.size,
    validInstances: instances.length,
    invalidCases: expectations.cases.length,
    invariantsRun: invReport.results.filter((r) => r.status !== 'NOT_TESTABLE').length,
    invariantsNotTestable: invReport.results.filter((r) => r.status === 'NOT_TESTABLE').length
  },
  steps: results.steps,
  warnings: results.warnings,
  failures: results.failures
};
writeFileSync(join(root, 'tests/validation-results.json'), JSON.stringify(summary, null, 2) + '\n');

for (const s of results.steps) console.log(`${s.status === 'PASS' ? '  ok ' : 'FAIL '} ${s.step} : ${s.detail}`);
for (const w of results.warnings) console.log(`  -- non testable : ${w}`);
console.log('');
if (results.failures.length) {
  console.log(`ÉCHEC : ${results.failures.length} problème(s).`);
  process.exit(1);
}
console.log(
  `OK : ${summary.totals.schemas} schemas, ${summary.totals.validInstances} instances valides, ` +
    `${summary.totals.invalidCases} cas invalides rejetés, ${summary.totals.invariantsRun} invariants exécutés ` +
    `(${summary.totals.invariantsNotTestable} non testables à ce stade).`
);
