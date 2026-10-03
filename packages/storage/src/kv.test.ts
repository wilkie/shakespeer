import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { openDatabase } from './database';
import { createKeyValueStore, type KeyValueStore } from './kv';
import type { ShakespeerDatabase } from './schema';

interface TestMap extends Record<string, unknown> {
  fontScale: number;
  lastPlay: { id: string; act: number };
}

describe('createKeyValueStore', () => {
  let db: ShakespeerDatabase;
  let store: KeyValueStore<TestMap>;

  beforeEach(async () => {
    db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
    store = createKeyValueStore<TestMap>(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns undefined for missing keys', async () => {
    await expect(store.get('fontScale')).resolves.toBeUndefined();
  });

  it('round-trips structured values', async () => {
    await store.set('lastPlay', { id: 'hamlet', act: 3 });

    await expect(store.get('lastPlay')).resolves.toStrictEqual({ id: 'hamlet', act: 3 });
  });

  it('deletes and clears values', async () => {
    await store.set('fontScale', 1.25);
    await store.set('lastPlay', { id: 'macbeth', act: 1 });

    await store.delete('fontScale');
    await expect(store.get('fontScale')).resolves.toBeUndefined();
    await expect(store.get('lastPlay')).resolves.toBeDefined();

    await store.clear();
    await expect(store.get('lastPlay')).resolves.toBeUndefined();
  });
});
