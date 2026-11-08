import type { BackupFile } from '@/lib/backup';
import { backupAccountTables } from './backupAccount';

export const syncGeneration = '11111111-1111-4111-8111-111111111111';
export function syncSnapshot(): BackupFile {
  return {
    format: 'fittrack-backup',
    version: 1,
    exportedAt: 1,
    app: { name: 'FitTrack', schemaVersion: 13 },
    preferences: {},
    tables: backupAccountTables(),
  };
}
