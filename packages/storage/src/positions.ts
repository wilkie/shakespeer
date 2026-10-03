import type { ReadingPosition, ShakespeerDatabase } from './schema';

/** The saved reading position for a play version (RDR-033), if any. */
export async function getPosition(
  db: ShakespeerDatabase,
  playId: string,
  versionId: string,
): Promise<ReadingPosition | undefined> {
  return db.get('positions', [playId, versionId]);
}

export async function savePosition(
  db: ShakespeerDatabase,
  playId: string,
  versionId: string,
  nodeId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.put('positions', { playId, versionId, nodeId, updatedAt: now.toISOString() });
}
