export { DEFAULT_DB_NAME, openDatabase, type OpenDatabaseOptions } from './database';
export { createKeyValueStore, type KeyValueStore } from './kv';
export {
  countNotes,
  deleteNote,
  getNote,
  listNotes,
  restoreSnapshot,
  saveNote,
  snapshotNotes,
  subscribeNotes,
  trackCreated,
  type NoteChange,
  type NoteCounts,
  type NoteKind,
  type NoteRecord,
  type NoteSnapshot,
  type VersionNotes,
} from './notes';
export { getPosition, savePosition } from './positions';
export {
  DB_VERSION,
  HIGHLIGHT_COLORS,
  type AnnotationRecord,
  type Citation,
  type CitationName,
  type CollectionRecord,
  type DefinitionRecord,
  type HighlightColor,
  type Link,
  type Origin,
  type ReadingPosition,
  type ShakespeerDatabase,
  type ShakespeerSchema,
} from './schema';
