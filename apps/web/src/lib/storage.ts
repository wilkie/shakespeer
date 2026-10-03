import {
  createKeyValueStore,
  openDatabase,
  type KeyValueStore,
  type ShakespeerDatabase,
} from '@shakespeer/storage';

/** Typed map of everything the app keeps in the IndexedDB key/value store. */
export interface Preferences extends Record<string, unknown> {
  /** Reader text size multiplier. */
  fontScale: number;
}

let dbPromise: Promise<ShakespeerDatabase> | undefined;

/** Lazily opens a single shared database connection for the app. */
export function getDatabase(): Promise<ShakespeerDatabase> {
  dbPromise ??= openDatabase();
  return dbPromise;
}

export async function getPreferences(): Promise<KeyValueStore<Preferences>> {
  return createKeyValueStore<Preferences>(await getDatabase());
}
