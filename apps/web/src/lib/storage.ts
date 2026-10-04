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
  /** Definition sources switched on or off; sources not listed are on (DEF-012). */
  'definitions.enabledSources': Record<string, boolean>;
  [key: `reader.lastVersion.${string}`]: string;
  /** The cut last used per version; empty for Full play (CUT-022). */
  [key: `reader.lastCut.${string}`]: string;
  'cuts.showCutText': boolean;
  [key: `export.lastName.${string}`]: string;
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
