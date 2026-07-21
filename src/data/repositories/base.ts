import type { PromiseExtended } from 'dexie';
import type { Syncable } from '@/data/types';

/**
 * The four primitives every repository is built on. They encode ADR-002 —
 * client-generated UUIDs and soft delete everywhere — so no caller has to
 * remember it.
 */

/** Stamps a new entity: UUID, both timestamps, and `deletedAt: 0` (alive). */
export function newEntity<T extends Syncable>(data: Omit<T, keyof Syncable>): T {
  const now = Date.now();
  return { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: 0 } as T;
}

/** Applies changes and moves `updatedAt` — the field the Lot 14 sync reads. */
export function touch<T extends Syncable>(entity: T, changes: Partial<T>): T {
  return { ...entity, ...changes, updatedAt: Date.now() };
}

/**
 * The only capability `softDelete` needs: stamp two numbers on a row addressed
 * by its string id.
 *
 * Deliberately narrower than `EntityTable<T, 'id'>`, which drags a generic `T`
 * through a function that never reads one — and which TypeScript then cannot
 * prove is keyed by a string, since `IDType<T, 'id'>` stays unresolved while `T`
 * is a type parameter.
 */
export interface SoftDeletableTable {
  update(id: string, changes: { deletedAt: number; updatedAt: number }): PromiseExtended<number>;
}

/** Marks a row deleted. The row stays: it feeds the trash and the Lot 14 sync. */
export async function softDelete(table: SoftDeletableTable, id: string): Promise<void> {
  const now = Date.now();
  await table.update(id, { deletedAt: now, updatedAt: now });
}

/** Keeps only live rows. Every read goes through this — a component never does. */
export function alive<T extends { deletedAt: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.deletedAt === 0);
}
