// Résout un fichier du corpus : chemin local d'abord, sinon lecture git
// depuis la branche archive. Les octets sont l'autorité ; le chemin n'est
// qu'une étiquette pour les messages d'erreur.
//
// Pourquoi git en secours : le corpus n'est plus dupliqué dans le working
// tree. Il vit sur archive/fittrack-kb-corpus. Un clone qui a fetch les
// branches distantes peut régénérer sans checkout de l'archive.

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { isAbsolute, join } from 'node:path';

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function gitShow(repoRoot, spec) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'show', spec], {
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true
    });
  } catch {
    return null;
  }
}

export function archiveSpecs(file, archiveRef) {
  if (!archiveRef || !file?.originalFilename) return [];
  const local = archiveRef;
  const remote = archiveRef.startsWith('origin/') ? null : `origin/${archiveRef}`;
  return unique([local, remote]).map((ref) => `${ref}:${file.originalFilename}`);
}

export function resolveCorpusFile(file, { packageRoot, repoRoot, archiveRef }) {
  const tried = [];
  const candidates = (file.candidatePaths ?? [file.path]).filter(Boolean);

  for (const p of candidates) {
    const resolved = isAbsolute(p) ? p : join(packageRoot, p);
    tried.push(resolved);
    if (existsSync(resolved)) {
      return { source: resolved, bytes: readFileSync(resolved), tried };
    }
  }

  for (const spec of archiveSpecs(file, archiveRef)) {
    tried.push(spec);
    const bytes = gitShow(repoRoot, spec);
    if (bytes) return { source: spec, bytes, tried };
  }

  return { source: null, bytes: null, tried };
}
