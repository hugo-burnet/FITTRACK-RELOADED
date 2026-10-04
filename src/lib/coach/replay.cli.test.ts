import { readFileSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { parseBackup } from '@/lib/backup/parse';
import { coachLinesFromBackup } from './backupLines';
import { formatReplay, replayCoach } from './replay';

/**
 * Banc de rejeu du coach (spec coach v2 § 7), lancé par `npm run coach:replay`.
 *
 *   COACH_REPLAY_BACKUP=chemin/vers/sauvegarde.json npm run coach:replay
 *   COACH_REPLAY_OUT=avant.txt …   # écrit dans un fichier au lieu de la sortie
 *
 * Sauté sans sauvegarde, donc muet dans `npm run test:run`. Vitest sert ici de
 * lanceur, comme pour les `bench:*` : il résout les alias `@/` et le TypeScript
 * sans dépendance de plus. La sauvegarde reste hors du dépôt (`.gitignore`).
 */
const backupPath = process.env.COACH_REPLAY_BACKUP;

describe.skipIf(!backupPath)('banc de rejeu du coach', () => {
  it('rejoue la sauvegarde séance par séance', () => {
    const parsed = parseBackup(readFileSync(backupPath!, 'utf8'));
    if (!parsed.ok) throw new Error(`Sauvegarde illisible : ${parsed.problem}`);

    const names = new Map<string, string>();
    for (const row of parsed.backup.tables.exercises) {
      if (typeof row.id === 'string' && typeof row.name === 'string') names.set(row.id, row.name);
    }
    const text = formatReplay(replayCoach(coachLinesFromBackup(parsed.backup)), names);

    const out = process.env.COACH_REPLAY_OUT;
    if (out) writeFileSync(out, text);
    else process.stdout.write(`${text}\n`);
  });
});
