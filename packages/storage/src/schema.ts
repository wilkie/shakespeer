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
];

export const DB_VERSION = migrations.length;
