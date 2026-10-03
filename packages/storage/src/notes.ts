/**
 * The notes repository (STO-030): every read and write of definitions and annotations goes
 * through here, never through raw IndexedDB calls in components.
 */
import type { AnnotationRecord, DefinitionRecord, ShakespeerDatabase } from './schema';

export type NoteKind = 'definitions' | 'annotations';

export type NoteRecord<K extends NoteKind> = K extends 'definitions'
  ? DefinitionRecord
  : AnnotationRecord;

export interface VersionNotes {
  definitions: DefinitionRecord[];
  annotations: AnnotationRecord[];
}

/** All own and imported notes for a play version. */
export async function listNotes(
  db: ShakespeerDatabase,
  playId: string,
  versionId: string,
): Promise<VersionNotes> {
  const tx = db.transaction(['definitions', 'annotations']);
  const [definitions, annotations] = await Promise.all([
    tx.objectStore('definitions').index('byVersion').getAll([playId, versionId]),
    tx.objectStore('annotations').index('byVersion').getAll([playId, versionId]),
  ]);
  await tx.done;
  return { definitions, annotations };
}

export interface NoteCounts {
  own: number;
  imported: number;
}

/** Note counts per version of a play (SEL-006, RDR-042). */
export async function countNotes(
  db: ShakespeerDatabase,
  playId: string,
): Promise<Map<string, NoteCounts>> {
  const counts = new Map<string, NoteCounts>();
  const range = IDBKeyRange.bound([playId, ''], [playId, '￿']);
  for (const kind of ['definitions', 'annotations'] as const) {
    for (const record of await db.getAllFromIndex(kind, 'byVersion', range)) {
      const count = counts.get(record.versionId) ?? { own: 0, imported: 0 };
      count[record.origin.kind === 'own' ? 'own' : 'imported'] += 1;
      counts.set(record.versionId, count);
    }
  }
  return counts;
}

export async function getNote<K extends NoteKind>(
  db: ShakespeerDatabase,
  kind: K,
  id: string,
): Promise<NoteRecord<K> | undefined> {
  return (await db.get(kind, id)) as NoteRecord<K> | undefined;
}

/**
 * Saves a note, stamping `updatedAt`. Editing an imported note marks it locally modified, so
 * collection updates keep the reader's changes (DEF-024, ANN-031, XCH-040).
 */
export async function saveNote<K extends NoteKind>(
  db: ShakespeerDatabase,
  kind: K,
  record: NoteRecord<K>,
  now: Date = new Date(),
): Promise<NoteRecord<K>> {
  const saved = {
    ...record,
    updatedAt: now.toISOString(),
    origin:
      record.origin.kind === 'imported' ? { ...record.origin, modified: true } : record.origin,
  } as NoteRecord<K>;
  await db.put(kind, saved);
  notifyChange(record.playId, record.versionId);
  return saved;
}

/**
 * Stores a repaired anchor (ANC-031). This is not an edit by the reader: `updatedAt` and the
 * imported note's modified flag are left alone.
 */
export async function updateAnchor(
  db: ShakespeerDatabase,
  kind: NoteKind,
  id: string,
  anchor: DefinitionRecord['anchor'],
): Promise<void> {
  const tx = db.transaction(kind, 'readwrite');
  const record = await tx.store.get(id);
  if (record) {
    await tx.store.put({ ...record, anchor });
  }
  await tx.done;
}

/**
 * Deletes a note. Deleting an imported note leaves a tombstone so collection updates do not
 * bring it back (STO-014, XCH-041).
 */
export async function deleteNote(
  db: ShakespeerDatabase,
  kind: NoteKind,
  id: string,
): Promise<void> {
  const tx = db.transaction([kind, 'tombstones'], 'readwrite');
  const record = await tx.objectStore(kind).get(id);
  if (record) {
    await tx.objectStore(kind).delete(id);
    if (record.origin.kind === 'imported') {
      const { collectionId, sourceItemId } = record.origin;
      await tx.objectStore('tombstones').put({ collectionId, sourceItemId });
    }
  }
  await tx.done;
  if (record) {
    notifyChange(record.playId, record.versionId);
  }
}

/** The state of some notes when an edit session began: a record, or absent. */
export interface NoteSnapshot {
  playId: string;
  versionId: string;
  entries: {
    kind: NoteKind;
    id: string;
    record: DefinitionRecord | AnnotationRecord | undefined;
  }[];
}

/** Captures notes as they are now, so an edit session can be cancelled (PNL-023). */
export async function snapshotNotes(
  db: ShakespeerDatabase,
  playId: string,
  versionId: string,
  notes: readonly { kind: NoteKind; id: string }[],
): Promise<NoteSnapshot> {
  const entries = await Promise.all(
    notes.map(async ({ kind, id }) => ({ kind, id, record: await db.get(kind, id) })),
  );
  return { playId, versionId, entries };
}

/** Adds notes created during an edit session to its snapshot, as absent. */
export function trackCreated(snapshot: NoteSnapshot, kind: NoteKind, id: string): NoteSnapshot {
  return snapshot.entries.some((entry) => entry.id === id)
    ? snapshot
    : { ...snapshot, entries: [...snapshot.entries, { kind, id, record: undefined }] };
}

/**
 * Puts every note back as it was in the snapshot, deleting notes created since, in one
 * transaction (STO-003, PNL-023).
 */
export async function restoreSnapshot(
  db: ShakespeerDatabase,
  snapshot: NoteSnapshot,
): Promise<void> {
  const tx = db.transaction(['definitions', 'annotations'], 'readwrite');
  for (const { kind, id, record } of snapshot.entries) {
    const store = tx.objectStore(kind);
    if (record) {
      await store.put(record);
    } else {
      await store.delete(id);
    }
  }
  await tx.done;
  notifyChange(snapshot.playId, snapshot.versionId);
}

// ---------------------------------------------------------------------------------------------
// Change notifications (STO-004)

export interface NoteChange {
  playId: string;
  versionId: string;
}

type ChangeListener = (change: NoteChange) => void;

const CHANNEL = 'shakespeer-notes';
const listeners = new Set<ChangeListener>();
let channel: BroadcastChannel | undefined;

function getChannel(): BroadcastChannel | undefined {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    // In Node (tests), don't keep the process alive just for this channel.
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
    channel.onmessage = (event: MessageEvent<NoteChange>) => {
      for (const listener of listeners) {
        listener(event.data);
      }
    };
  }
  return channel;
}

function notifyChange(playId: string, versionId: string) {
  const change = { playId, versionId };
  for (const listener of listeners) {
    listener(change);
  }
  getChannel()?.postMessage(change);
}

/** Calls `listener` when notes change, in this tab or another (STO-004). Returns unsubscribe. */
export function subscribeNotes(listener: ChangeListener): () => void {
  getChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
