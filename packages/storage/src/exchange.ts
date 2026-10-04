/**
 * Exporting and importing notes (specs/behavior/import-export.md, specs/data/exchange-format.md).
 */
import { notifyCutsChange } from './cuts';
import {
  CUTS_FORMAT,
  CUTS_FORMAT_VERSION,
  LIMITS,
  NOTES_FORMAT,
  NOTES_FORMAT_VERSION,
  type CutsFile,
  type CutsFileCut,
  type NotesFile,
  type NotesFileAnnotation,
  type NotesFileDefinition,
} from './notes-file';
import { notifyChange } from './notes';
import {
  HIGHLIGHT_COLORS,
  type AnnotationRecord,
  type Citation,
  type CollectionRecord,
  type DefinitionRecord,
  type HighlightColor,
  type ShakespeerDatabase,
} from './schema';

// ---------------------------------------------------------------------------------------------
// Export

export interface ExportOptions {
  playId: string;
  collectionName: string;
  /** Also export imported notes (IOX-002). */
  includeImported: boolean;
  appVersion: string;
  now?: Date;
}

async function playNotes(db: ShakespeerDatabase, playId: string) {
  const range = IDBKeyRange.bound([playId, ''], [playId, '￿']);
  const [definitions, annotations] = await Promise.all([
    db.getAllFromIndex('definitions', 'byVersion', range),
    db.getAllFromIndex('annotations', 'byVersion', range),
  ]);
  return { definitions, annotations };
}

/**
 * The notes file for a play: own notes of every version, and imported ones if asked (IOX-003).
 * Item IDs are the local record IDs, stable across exports (XCH-003).
 */
export async function exportNotes(
  db: ShakespeerDatabase,
  options: ExportOptions,
): Promise<NotesFile> {
  const { playId, collectionName, includeImported, appVersion, now = new Date() } = options;
  const keep = (record: DefinitionRecord | AnnotationRecord) =>
    includeImported || record.origin.kind === 'own';
  const notes = await playNotes(db, playId);
  const definitions = notes.definitions.filter(keep);
  const annotations = notes.annotations.filter(keep);

  // The corpus revision each version's anchors were made against (CRP-025): the latest seen.
  const versions: NotesFile['versions'] = {};
  for (const record of [...definitions, ...annotations]) {
    const current = versions[record.versionId];
    if (!current || current.revision < record.anchor.revision) {
      versions[record.versionId] = { revision: record.anchor.revision };
    }
  }

  const byCreation = (a: { createdAt: string }, b: { createdAt: string }) =>
    a.createdAt.localeCompare(b.createdAt);
  return {
    format: NOTES_FORMAT,
    formatVersion: NOTES_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    generator: { app: 'shakespeer', version: appVersion },
    collection: { name: collectionName.trim() },
    play: { id: playId },
    versions,
    definitions: definitions.sort(byCreation).map((d) => ({
      id: d.id,
      versionId: d.versionId,
      anchor: d.anchor,
      meaning: d.meaning,
      ...(d.partOfSpeech ? { partOfSpeech: d.partOfSpeech } : {}),
      ...(d.source ? { source: d.source } : {}),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    annotations: annotations.sort(byCreation).map((a) => ({
      id: a.id,
      versionId: a.versionId,
      anchor: a.anchor,
      color: a.color,
      notes: a.notes,
      links: a.links,
      // Stored citations are the file's subset (CSL date parts as optional tuple members).
      citations: a.citations as NotesFileAnnotation['citations'],
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  };
}

/**
 * The cuts file for a play: own cuts of every version, and imported ones if asked (CUT-052).
 * Cut IDs are the local record IDs, stable across exports (XCH-003).
 */
export async function exportCuts(
  db: ShakespeerDatabase,
  options: Pick<ExportOptions, 'playId' | 'includeImported'>,
): Promise<CutsFile> {
  const range = IDBKeyRange.bound([options.playId, ''], [options.playId, '￿']);
  const cuts = (await db.getAllFromIndex('cuts', 'byVersion', range)).filter(
    (cut) => options.includeImported || cut.origin.kind === 'own',
  );
  return {
    format: CUTS_FORMAT,
    formatVersion: CUTS_FORMAT_VERSION,
    play: { id: options.playId },
    cuts: cuts
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((cut) => ({
        id: cut.id,
        versionId: cut.versionId,
        name: cut.name,
        createdAt: cut.createdAt,
        updatedAt: cut.updatedAt,
        operations: cut.operations,
      })),
  };
}

/** `shakespeer-<playId>-<collection-name-slug>-<YYYY-MM-DD>.zip` (IOX-004). */
export function exportFileName(playId: string, collectionName: string, now = new Date()): string {
  const slug =
    collectionName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'notes';
  const date = now.toISOString().slice(0, 10);
  return `shakespeer-${playId}-${slug}-${date}.zip`;
}

// ---------------------------------------------------------------------------------------------
// Checking items (XCH-030)

export interface SkippedItems {
  /** Items for versions this app does not have. */
  unknownVersion: number;
  /** Items with text beyond the length limits. */
  tooLong: number;
}

export interface CheckedNotes {
  definitions: NotesFileDefinition[];
  annotations: NotesFileAnnotation[];
  /** Cuts in the file (CUT-052). */
  cuts: CutsFileCut[];
  skipped: SkippedItems;
}

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const CITATION_TYPES = new Set<string>([
  'book',
  'chapter',
  'article-journal',
  'webpage',
  'document',
]);

/**
 * Checks a file's items one by one: unknown versions and overlong text are skipped and counted;
 * unknown colors become yellow and unsafe links are dropped (XCH-030).
 */
export function checkItems(
  file: NotesFile,
  versionIds: ReadonlySet<string>,
  cutsFile?: CutsFile,
): CheckedNotes {
  const skipped: SkippedItems = { unknownVersion: 0, tooLong: 0 };
  const known = (item: { versionId: string }) => {
    if (!versionIds.has(item.versionId)) {
      skipped.unknownVersion += 1;
      return false;
    }
    return true;
  };
  const definitions = file.definitions.filter((d) => {
    if (!known(d)) {
      return false;
    }
    if (d.meaning.length > LIMITS.meaning) {
      skipped.tooLong += 1;
      return false;
    }
    return true;
  });
  const annotations = file.annotations
    .filter((a) => {
      if (!known(a)) {
        return false;
      }
      if (a.notes.length > LIMITS.notes) {
        skipped.tooLong += 1;
        return false;
      }
      return true;
    })
    .map((a) => ({
      ...a,
      color: (HIGHLIGHT_COLORS as readonly string[]).includes(a.color) ? a.color : 'yellow',
      links: a.links.filter((link) => isSafeUrl(link.url)),
      citations: a.citations.map((c) => ({
        ...c,
        type: CITATION_TYPES.has(c.type) ? c.type : 'document',
      })),
    }));
  const cuts = (cutsFile?.cuts ?? []).filter((cut) => {
    if (!known(cut)) {
      return false;
    }
    if (cut.operations.some((op) => op.type !== 'hide' && op.text.length > LIMITS.cutText)) {
      skipped.tooLong += 1;
      return false;
    }
    return true;
  });
  return { definitions, annotations, cuts, skipped };
}

// ---------------------------------------------------------------------------------------------
// Collections (IOX-020, IOX-021)

export async function findCollection(
  db: ShakespeerDatabase,
  playId: string,
  name: string,
): Promise<CollectionRecord | undefined> {
  return db.getFromIndex('collections', 'byPlayName', [playId, name.trim()]);
}

export interface CollectionSummary extends CollectionRecord {
  definitions: number;
  annotations: number;
  cuts: number;
}

/** A play's imported collections with their note counts, oldest first (IOX-020). */
export async function listCollections(
  db: ShakespeerDatabase,
  playId: string,
): Promise<CollectionSummary[]> {
  const range = IDBKeyRange.bound([playId, ''], [playId, '￿']);
  const collections = await db.getAllFromIndex('collections', 'byPlayName', range);
  const summaries = await Promise.all(
    collections.map(async (collection) => ({
      ...collection,
      definitions: await db.countFromIndex('definitions', 'byCollection', collection.id),
      annotations: await db.countFromIndex('annotations', 'byCollection', collection.id),
      cuts: await db.countFromIndex('cuts', 'byCollection', collection.id),
    })),
  );
  return summaries.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
}

export class CollectionNameTakenError extends Error {
  override name = 'CollectionNameTakenError';
}

/** Renames a collection; names are unique per play (IOX-021). */
export async function renameCollection(
  db: ShakespeerDatabase,
  id: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  const tx = db.transaction('collections', 'readwrite');
  const collection = await tx.store.get(id);
  if (!collection) {
    await tx.done;
    return;
  }
  const existing = await tx.store.index('byPlayName').get([collection.playId, trimmed]);
  if (existing && existing.id !== id) {
    tx.abort();
    await tx.done.catch(() => undefined);
    throw new CollectionNameTakenError(`A collection named “${trimmed}” already exists.`);
  }
  await tx.store.put({ ...collection, name: trimmed });
  await tx.done;
  notifyChange(collection.playId, '');
}

// ---------------------------------------------------------------------------------------------
// Applying an import (XCH-039 – XCH-042)

export type ImportTarget =
  | { mode: 'new'; collectionName: string }
  | {
      mode: 'update';
      collectionId: string;
      /** Bring back notes of the collection the reader deleted (IOX-014a). */
      restoreDeleted?: boolean;
    };

export interface ImportCounts {
  added: number;
  updated: number;
  removed: number;
  keptModified: number;
  previouslyDeleted: number;
  restored: number;
}

export interface ImportReport extends ImportCounts {
  collectionId: string;
  added: number;
  updated: number;
  removed: number;
  /** Kept because they were changed locally (in the file or removed from it). */
  keptModified: number;
  /** Skipped because the reader had deleted them (XCH-041). */
  previouslyDeleted: number;
  /** Deleted by the reader and brought back on request (IOX-014a). */
  restored: number;
  /** The same counts for cuts (CUT-052); the fields above count notes. */
  cuts: ImportCounts;
}

/**
 * Source item IDs of a collection's notes the reader deleted (XCH-041): what restoring them on
 * an update would bring back, if the file still has them (IOX-014a).
 */
export async function deletedItems(
  db: ShakespeerDatabase,
  collectionId: string,
): Promise<string[]> {
  const tombstones = await db.getAllFromIndex('tombstones', 'byCollection', collectionId);
  return tombstones.map((t) => t.sourceItemId);
}

function definitionContent(item: NotesFileDefinition) {
  return {
    versionId: item.versionId,
    anchor: item.anchor,
    meaning: item.meaning,
    ...(item.partOfSpeech ? { partOfSpeech: item.partOfSpeech } : {}),
    ...(item.source ? { source: item.source } : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function cutContent(item: CutsFileCut) {
  return {
    versionId: item.versionId,
    name: item.name.trim(),
    operations: item.operations,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function annotationContent(item: NotesFileAnnotation) {
  return {
    versionId: item.versionId,
    anchor: item.anchor,
    color: item.color as HighlightColor,
    notes: item.notes,
    links: item.links,
    citations: item.citations as Citation[],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/**
 * Applies checked notes to a new or existing collection in one transaction. Own notes are never
 * touched (XCH-042).
 */
export async function applyImport(
  db: ShakespeerDatabase,
  playId: string,
  notes: CheckedNotes,
  target: ImportTarget,
  fileName: string,
  now: Date = new Date(),
): Promise<ImportReport> {
  const stamp = now.toISOString();
  const tx = db.transaction(
    ['definitions', 'annotations', 'cuts', 'collections', 'tombstones'],
    'readwrite',
  );
  const collections = tx.objectStore('collections');

  let collection: CollectionRecord;
  if (target.mode === 'new') {
    collection = {
      id: crypto.randomUUID(),
      playId,
      name: target.collectionName.trim(),
      importedAt: stamp,
      updatedAt: stamp,
      fileName,
    };
  } else {
    const existing = await collections.get(target.collectionId);
    if (!existing) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw new Error('The collection to update no longer exists.');
    }
    collection = { ...existing, updatedAt: stamp, fileName };
  }
  await collections.put(collection);

  const report: ImportReport = {
    collectionId: collection.id,
    added: 0,
    updated: 0,
    removed: 0,
    keptModified: 0,
    previouslyDeleted: 0,
    restored: 0,
    cuts: { added: 0, updated: 0, removed: 0, keptModified: 0, previouslyDeleted: 0, restored: 0 },
  };
  const versions = new Set<string>();
  const cutVersions = new Set<string>();
  const tombstones = tx.objectStore('tombstones');
  // Restoring deleted notes clears the collection's tombstones first (XCH-040 step 1).
  const restoring = new Set<string>();
  if (target.mode === 'update' && target.restoreDeleted) {
    for (const tombstone of await tombstones.index('byCollection').getAll(collection.id)) {
      restoring.add(tombstone.sourceItemId);
      await tombstones.delete([tombstone.collectionId, tombstone.sourceItemId]);
    }
  }

  type Item = NotesFileDefinition | NotesFileAnnotation | CutsFileCut;
  const apply = async <T extends Item>(
    kind: 'definitions' | 'annotations' | 'cuts',
    items: readonly T[],
    content: (item: T) => object,
    counts: ImportCounts,
    changed: Set<string>,
  ) => {
    // The stores share the same indexes and origin; one store type serves for each.
    const store = tx.objectStore(kind as 'definitions');
    const local = new Map<string, DefinitionRecord | AnnotationRecord>();
    if (target.mode === 'update') {
      for (const record of await store.index('byCollection').getAll(collection.id)) {
        if (record.origin.kind === 'imported') {
          local.set(record.origin.sourceItemId, record);
        }
      }
    }
    const incoming = new Set<string>();
    for (const item of items) {
      if (incoming.has(item.id)) {
        continue; // A repeated ID in the file: the first wins.
      }
      incoming.add(item.id);
      if (target.mode === 'update' && (await tombstones.get([collection.id, item.id]))) {
        counts.previouslyDeleted += 1;
        continue;
      }
      const existing = local.get(item.id);
      if (existing?.origin.kind === 'imported' && existing.origin.modified) {
        counts.keptModified += 1;
        continue;
      }
      const record = {
        id: existing?.id ?? crypto.randomUUID(),
        playId,
        ...content(item),
        ...(kind === 'cuts'
          ? {
              name: await freeCutName(
                (item as CutsFileCut).versionId,
                (item as CutsFileCut).name.trim(),
                existing?.id,
              ),
            }
          : {}),
        origin: {
          kind: 'imported',
          collectionId: collection.id,
          sourceItemId: item.id,
          modified: false,
        },
      } as unknown as DefinitionRecord;
      await store.put(record);
      changed.add(item.versionId);
      if (existing) {
        changed.add(existing.versionId);
        counts.updated += 1;
      } else if (restoring.has(item.id)) {
        counts.restored += 1;
      } else {
        counts.added += 1;
      }
    }
    // Notes no longer in the file: removed, unless changed locally (XCH-040 step 2).
    for (const [sourceItemId, record] of local) {
      if (incoming.has(sourceItemId) || record.origin.kind !== 'imported') {
        continue;
      }
      changed.add(record.versionId);
      if (record.origin.modified) {
        counts.keptModified += 1;
        if (!record.origin.removedFromSource) {
          await store.put({
            ...record,
            origin: { ...record.origin, removedFromSource: true },
          } as never);
        }
      } else {
        await store.delete(record.id);
        counts.removed += 1;
      }
    }
  };

  /**
   * Cut names are unique per version (CUT-021): an imported cut whose name is taken is named
   * after its collection too.
   */
  const freeCutName = async (versionId: string, name: string, ownId: string | undefined) => {
    const taken = new Set(
      (await tx.objectStore('cuts').index('byVersion').getAll([playId, versionId]))
        .filter((cut) => cut.id !== ownId)
        .map((cut) => cut.name),
    );
    for (let n = 1; ; n += 1) {
      const candidate =
        n === 1 ? name : `${name} (${collection.name}${n === 2 ? '' : ` ${String(n - 1)}`})`;
      if (!taken.has(candidate)) {
        return candidate;
      }
    }
  };

  await apply('definitions', notes.definitions, definitionContent, report, versions);
  await apply('annotations', notes.annotations, annotationContent, report, versions);
  await apply('cuts', notes.cuts, cutContent, report.cuts, cutVersions);
  await tx.done;

  for (const versionId of versions) {
    notifyChange(playId, versionId);
  }
  for (const versionId of cutVersions) {
    notifyCutsChange(playId, versionId);
  }
  notifyChange(playId, '');
  return report;
}
