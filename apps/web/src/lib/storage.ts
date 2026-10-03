import {
  createKeyValueStore,
  openDatabase,
  type HighlightColor,
  type KeyValueStore,
  type ShakespeerDatabase,
} from '@shakespeer/storage';

/** Everything the app keeps in the IndexedDB key/value store (STO-016). */
export interface Settings extends Record<string, unknown> {
  'definitions.showUnderlines': boolean;
  'map.showAnnotationMarks': boolean;
  'annotations.lastColor': HighlightColor;
  [key: `reader.lastVersion.${string}`]: string;
}

let dbPromise: Promise<ShakespeerDatabase> | undefined;

/** Lazily opens a single shared database connection for the app. */
export function getDatabase(): Promise<ShakespeerDatabase> {
  dbPromise ??= openDatabase();
  return dbPromise;
}

export async function getSettings(): Promise<KeyValueStore<Settings>> {
  return createKeyValueStore<Settings>(await getDatabase());
}
