/**
 * The cuts repository (CUT-050): every read and write of cuts goes through here. Cuts change
 * notifications are separate from notes', on their own channel (STO-004).
 */
import type { CutRecord, ShakespeerDatabase } from './schema';

/** A version's own and imported cuts, by name. */
export async function listCuts(
  db: ShakespeerDatabase,
  playId: string,
  versionId: string,
): Promise<CutRecord[]> {
  const cuts = await db.getAllFromIndex('cuts', 'byVersion', [playId, versionId]);
  return cuts.sort(
    (a, b) => a.name.localeCompare(b.name) || a.createdAt.localeCompare(b.createdAt),
  );
}

export async function getCut(db: ShakespeerDatabase, id: string): Promise<CutRecord | undefined> {
  return db.get('cuts', id);
}

export class CutNameTakenError extends Error {
  override name = 'CutNameTakenError';
}

/**
 * Saves a cut, stamping `updatedAt`. Names are unique per version (CUT-021). Editing an imported
 * cut marks it locally modified, so collection updates keep the reader's changes (XCH-040).
 */
export async function saveCut(
  db: ShakespeerDatabase,
  record: CutRecord,
  now: Date = new Date(),
): Promise<CutRecord> {
  const name = record.name.trim();
  const tx = db.transaction('cuts', 'readwrite');
  const others = await tx.store.index('byVersion').getAll([record.playId, record.versionId]);
  if (others.some((other) => other.id !== record.id && other.name === name)) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new CutNameTakenError(`A cut named “${name}” already exists.`);
  }
  const saved: CutRecord = {
    ...record,
    name,
    updatedAt: now.toISOString(),
    origin:
      record.origin.kind === 'imported' ? { ...record.origin, modified: true } : record.origin,
  };
  await tx.store.put(saved);
  await tx.done;
  notifyCutsChange(record.playId, record.versionId);
  return saved;
}

/** Deletes a cut; an imported one leaves a tombstone so updates do not bring it back (XCH-041). */
export async function deleteCut(db: ShakespeerDatabase, id: string): Promise<void> {
  const tx = db.transaction(['cuts', 'tombstones'], 'readwrite');
  const record = await tx.objectStore('cuts').get(id);
  if (record) {
    await tx.objectStore('cuts').delete(id);
    if (record.origin.kind === 'imported') {
      const { collectionId, sourceItemId } = record.origin;
      await tx.objectStore('tombstones').put({ collectionId, sourceItemId });
    }
  }
  await tx.done;
  if (record) {
    notifyCutsChange(record.playId, record.versionId);
  }
}

// ---------------------------------------------------------------------------------------------
// Change notifications (STO-004)

export interface CutsChange {
  playId: string;
  versionId: string;
}

type ChangeListener = (change: CutsChange) => void;

const CHANNEL = 'shakespeer-cuts';
const listeners = new Set<ChangeListener>();
let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel | undefined {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
    channel.onmessage = (event: MessageEvent<CutsChange>) => {
      for (const listener of listeners) {
        listener(event.data);
      }
    };
  }
  return channel;
}

export function notifyCutsChange(playId: string, versionId: string) {
  const change = { playId, versionId };
  for (const listener of listeners) {
    listener(change);
  }
  getChannel()?.postMessage(change);
}

/** Calls `listener` when cuts change, in this tab or another. Returns unsubscribe. */
export function subscribeCuts(listener: ChangeListener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
