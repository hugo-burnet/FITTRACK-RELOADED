#!/usr/bin/env node
// Génère mappings/clinical-schema-migration.md depuis le mapping machine.
//
// La table lisible et le mapping exécutable disent la même chose. Les écrire
// deux fois garantirait qu'ils finissent par se contredire, et c'est justement
// la table lisible qu'un relecteur humain croira.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const m = JSON.parse(readFileSync(join(root, 'mappings/clinical-schema-migration.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
const byAction = {};
for (const x of m.mappings) (byAction[x.action] ??= []).push(x);

const lines = [];
lines.push('# Migration du schéma clinique existant');
lines.push('');
lines.push('> **Document généré** par `tools/build-migration-doc.mjs` depuis');
lines.push('> `mappings/clinical-schema-migration.json`. Ne pas éditer à la main.');
lines.push('');
lines.push(
  "Le schéma clinique existant est migré, pas utilisé comme squelette. Chacun de ses champs est repris, renommé, déplacé, scindé, promu, étendu ou explicitement dissous — jamais abandonné en silence."
);
lines.push('');
lines.push('## Preuve d\'absence de perte');
lines.push('');
lines.push(
  "`tests/invariants.mjs` (INV-013) énumère les chemins de champs **depuis le fichier réel** et exige que chacun apparaisse exactement une fois comme `sourcePath` de ce mapping, sans chemin surnuméraire. La validation échoue sinon."
);
lines.push('');
lines.push(`- champs d'origine couverts : **${m.mappings.length}**`);
lines.push(`- hash du fichier d'origine : \`${m.sourceSchema.contentHash}\``);
lines.push('');
lines.push('## Répartition des actions');
lines.push('');
lines.push('| Action | Nombre | Sens |');
lines.push('|---|---|---|');
for (const [action, desc] of Object.entries(m.actions)) {
  lines.push(`| \`${action}\` | ${byAction[action]?.length ?? 0} | ${esc(desc)} |`);
}
lines.push('');
lines.push('## Les trois transformations qui comptent');
lines.push('');
lines.push(
  "**`toleranceDimension` portait deux choses.** La définition générale d'un axe et l'observation datée d'une personne cohabitaient dans le même objet. Une base de connaissances scientifique ne peut pas changer parce qu'un utilisateur a soulevé une barre : les champs `status`, `basis`, `testedRange`, `testedLoad`, `symptomDuring`, `symptomAfter24h` et `notes` partent au runtime, la KB ne garde que la définition et les valeurs admissibles."
);
lines.push('');
lines.push(
  "**`irritability` n'avait pas sa place dans une condition.** L'irritabilité change d'une semaine à l'autre chez une même personne ; au niveau d'une condition générale, elle n'a pas de valeur. Elle devient `IrritabilityState`, datée et argumentée par les indices qui l'ont produite."
);
lines.push('');
lines.push(
  "**`expert_practice` n'était pas un niveau de preuve.** Le laisser dans l'échelle A/B/C/D permettait de le comparer à `A_high`, ce qui n'a pas de sens. Il devient `knowledgeType: EXPERT_PRACTICE` avec un niveau clinique nul. C'est la seule modification de valeur de toute la migration, et le seul changement majeur du contrat."
);
lines.push('');
lines.push('## Destination des champs runtime');
lines.push('');
lines.push('| Champ d\'origine | Destination |');
lines.push('|---|---|');
for (const [k, v] of Object.entries(m.runtimeDestinations)) {
  lines.push(`| \`${k}\` | \`${esc(v)}\` |`);
}
lines.push('');
lines.push('## Règles de priorité des red flags');
lines.push('');
for (const r of m.redFlagPriorityRules) lines.push(`- ${r}`);
lines.push('');
lines.push('## Table complète, champ par champ');
lines.push('');
for (const action of Object.keys(m.actions)) {
  const rows = byAction[action] ?? [];
  if (!rows.length) continue;
  lines.push(`### ${action} — ${rows.length} champ${rows.length > 1 ? 's' : ''}`);
  lines.push('');
  lines.push('| Champ d\'origine | Destination | Changement de contrainte | Justification |');
  lines.push('|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| \`${esc(r.sourcePath)}\` | \`${esc(r.targetPath)}\` | ${r.requirementChange ? esc(r.requirementChange) : '—'} | ${esc(r.rationale)} |`
    );
  }
  lines.push('');
}

writeFileSync(join(root, 'mappings/clinical-schema-migration.md'), lines.join('\n') + '\n');
console.log(`table de migration : ${m.mappings.length} champs, ${Object.keys(byAction).length} actions`);
