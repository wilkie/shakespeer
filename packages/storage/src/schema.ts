import type { PartOfSpeech, TextAnchor } from '@shakespeer/corpus/schema';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

/**
 * The complete IndexedDB schema. Add object stores here, then add a migration in
 * `migrations` below — never edit a migration that has already shipped.
 */
export interface ShakespeerSchema extends DBSchema {
  /** Generic key/value store for user preferences and small app state. */
  kv: {
    key: string;
    value: unknown;
  };
  /** Own and imported definitions (STO-010). */
  definitions: {
    key: string;
    value: DefinitionRecord;
    indexes: { byVersion: [string, string]; byCollection: string };
  };
  /** Own and imported annotations (STO-011). */
  annotations: {
    key: string;
    value: AnnotationRecord;
    indexes: { byVersion: [string, string]; byCollection: string };
  };
  /** Imported collections (STO-013). */
  collections: {
    key: string;
    value: CollectionRecord;
    indexes: { byPlayName: [string, string] };
  };
  /** Imported notes the reader deleted (STO-014). */
  tombstones: {
    key: [collectionId: string, sourceItemId: string];
    value: { collectionId: string; sourceItemId: string };
    indexes: { byCollection: string };
  };
  /** Own and imported cuts (STO-017, CUT-050). */
  cuts: {
    key: string;
    value: CutRecord;
    indexes: { byVersion: [string, string]; byCollection: string };
  };
  /** Reading position per play version (STO-015). */
  positions: {
    key: [playId: string, versionId: string];
    value: ReadingPosition;
  };
}

/** Who a note belongs to (STO-020). */
export type Origin =
  | { kind: 'own' }
  | {
      kind: 'imported';
      collectionId: string;
      /** The note's ID in the imported file. */
      sourceItemId: string;
      /** Edited locally since last imported (DEF-024, ANN-031). */
      modified: boolean;
      /** Kept after an update removed it from the collection (XCH-040). */
      removedFromSource?: boolean;
    };

interface NoteBase {
  id: string;
  playId: string;
  versionId: string;
  anchor: TextAnchor;
  origin: Origin;
  createdAt: string;
  updatedAt: string;
}

export interface DefinitionRecord extends NoteBase {
  meaning: string;
  partOfSpeech?: PartOfSpeech;
  /** Free text, e.g. "OED". */
  source?: string;
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export interface Link {
  url: string;
  label?: string;
}

/** A name in a citation: family and given names, or a literal name (CSL-JSON). */
export type CitationName = { family: string; given?: string } | { literal: string };

/** The subset of a CSL-JSON item kept for citations (ANN-004). */
export interface Citation {
  type: 'book' | 'chapter' | 'article-journal' | 'webpage' | 'document';
  title: string;
  author?: CitationName[];
  /** Year, or year-month(-day), as CSL date parts. */
  issued?: { 'date-parts': [number, number?, number?][] };
  'container-title'?: string;
  publisher?: string;
  'publisher-place'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  URL?: string;
  DOI?: string;
  note?: string;
}

export interface AnnotationRecord extends NoteBase {
  color: HighlightColor;
  /** Markdown; may be empty. */
  notes: string;
  links: Link[];
  citations: Citation[];
}

/** One change a cut makes to its version (CUT-050). */
export type CutOperation =
  | { id: string; type: 'hide'; anchor: TextAnchor }
  | { id: string; type: 'replace'; anchor: TextAnchor; text: string }
  | { id: string; type: 'insert'; after: string; kind: 'sd' | 'narration'; text: string };

/** A named arrangement of a version (CUT-050). */
export interface CutRecord {
  id: string;
  playId: string;
  versionId: string;
  name: string;
  origin: Origin;
  createdAt: string;
  updatedAt: string;
  operations: CutOperation[];
}

export interface CollectionRecord {
  id: string;
  playId: string;
  name: string;
  importedAt: string;
  updatedAt: string;
  fileName: string;
}

export interface ReadingPosition {
  playId: string;
  versionId: string;
  /** The current line (RDR-030) when last read. */
  nodeId: string;
  updatedAt: string;
}

export type ShakespeerDatabase = IDBPDatabase<ShakespeerSchema>;

export type Migration = (
  db: ShakespeerDatabase,
  transaction: IDBPTransaction<ShakespeerSchema, StoreNames<ShakespeerSchema>[], 'versionchange'>,
) => void;

/**
 * Ordered, append-only list of schema migrations. Index `i` upgrades the database from
 * version `i` to `i + 1`, so the database version is always `migrations.length`.
 */
export const migrations: readonly Migration[] = [
  // v1: initial schema
  (db) => {
    db.createObjectStore('kv');
  },
  // v2: reading positions
  (db) => {
    db.createObjectStore('positions', { keyPath: ['playId', 'versionId'] });
  },
  // v3: notes and imported collections
  (db) => {
    for (const name of ['definitions', 'annotations'] as const) {
      const store = db.createObjectStore(name, { keyPath: 'id' });
      store.createIndex('byVersion', ['playId', 'versionId']);
      store.createIndex('byCollection', 'origin.collectionId');
    }
    const collections = db.createObjectStore('collections', { keyPath: 'id' });
    collections.createIndex('byPlayName', ['playId', 'name'], { unique: true });
    const tombstones = db.createObjectStore('tombstones', {
      keyPath: ['collectionId', 'sourceItemId'],
    });
    tombstones.createIndex('byCollection', 'collectionId');
  },
  // v4: cuts
  (db) => {
    const cuts = db.createObjectStore('cuts', { keyPath: 'id' });
    cuts.createIndex('byVersion', ['playId', 'versionId']);
    cuts.createIndex('byCollection', 'origin.collectionId');
  },
];

export const DB_VERSION = migrations.length;
