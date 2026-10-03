import { openDB } from 'idb';

import { DB_VERSION, migrations, type ShakespeerDatabase, type ShakespeerSchema } from './schema';

export const DEFAULT_DB_NAME = 'shakespeer';

export interface OpenDatabaseOptions {
  /** Override the database name (useful for tests or multiple profiles). */
  name?: string;
}

/**
 * Opens (creating or upgrading as needed) the application database.
 *
 * When another tab holds an older version open, this connection closes itself on
 * `versionchange` so the upgrade in the other tab is never blocked indefinitely.
 */
export function openDatabase({
  name = DEFAULT_DB_NAME,
}: OpenDatabaseOptions = {}): Promise<ShakespeerDatabase> {
  return openDB<ShakespeerSchema>(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      for (const migrate of migrations.slice(oldVersion)) {
        migrate(db, transaction);
      }
    },
    blocking(_currentVersion, _blockedVersion, event) {
      (event.target as IDBDatabase).close();
    },
  });
}
