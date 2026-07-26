import { db } from '@/data/db';
import type { RoutineFolder } from '@/data/types';
import { alive, newEntity, softDelete, touch } from './base';

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

// ---------------------------------------------------------------------------
// Folders (RF-12)
// ---------------------------------------------------------------------------

export async function listFolders(): Promise<RoutineFolder[]> {
  return alive(await db.routineFolders.toArray()).sort(byOrder);
}

export async function createFolder(name: string): Promise<RoutineFolder> {
  const order = (await listFolders()).length;
  const folder = newEntity<RoutineFolder>({ name, order });
  await db.routineFolders.add(folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const folder = await db.routineFolders.get(id);
  if (folder === undefined) return;
  await db.routineFolders.put(touch(folder, { name }));
}

export async function countRoutinesInFolder(id: string): Promise<number> {
  return alive(await db.routines.where('folderId').equals(id).toArray()).length;
}

/**
 * Deletes the folder and **keeps its routines**, which return to the root.
 *
 * Filing and destroying are two different acts, and conflating them is the
 * fastest way to lose twenty minutes of writing to a tap meant to tidy up. The
 * confirmation text announces how many routines are about to move — hence
 * `countRoutinesInFolder`.
 */
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.routineFolders, db.routines, async () => {
    await db.routines.where('folderId').equals(id).modify({ folderId: '', updatedAt: Date.now() });
    await softDelete(db.routineFolders, id);
  });
}
