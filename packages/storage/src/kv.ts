import type { ShakespeerDatabase } from './schema';

/**
 * A typed view over the `kv` object store. `TMap` maps each key to its value type, so
 * callers get compile-time checking without a dedicated object store per setting.
 *
 * @example
 *   const prefs = createKeyValueStore<{ fontScale: number }>(db);
 *   await prefs.set('fontScale', 1.25);
 */
export interface KeyValueStore<TMap extends Record<string, unknown>> {
  get<K extends keyof TMap & string>(key: K): Promise<TMap[K] | undefined>;
  set<K extends keyof TMap & string>(key: K, value: TMap[K]): Promise<void>;
  delete(key: keyof TMap & string): Promise<void>;
  clear(): Promise<void>;
}

export function createKeyValueStore<TMap extends Record<string, unknown>>(
  db: ShakespeerDatabase,
): KeyValueStore<TMap> {
  return {
    async get(key) {
      return (await db.get('kv', key)) as TMap[typeof key] | undefined;
    },
    async set(key, value) {
      await db.put('kv', value, key);
    },
    async delete(key) {
      await db.delete('kv', key);
    },
    async clear() {
      await db.clear('kv');
    },
  };
}
