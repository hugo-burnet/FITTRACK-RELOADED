import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@/lib/backup';
import { db } from './db';

/**
 * `lib/backup` may not import `db` — `db.ts` already imports that layer — so it
 * restates the schema version as a constant. This is what stops the two from
 * drifting: append a `version(n)` block to `db.ts` and this test fails until
 * the backfill table has been told what that version changed.
 */
describe('la version de schéma connue de la sauvegarde', () => {
  it('suit celle que Dexie ouvre', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(db.verno);
  });
});
