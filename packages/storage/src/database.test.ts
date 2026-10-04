import { describe, expect, it } from '@jest/globals';

import { openDatabase } from './database';
import { DB_VERSION } from './schema';

describe('openDatabase', () => {
  it('creates the database at the latest schema version', async () => {
    const db = await openDatabase({ name: `test-${crypto.randomUUID()}` });

    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toStrictEqual([
      'annotations',
      'collections',
      'cuts',
      'definitions',
      'kv',
      'positions',
      'tombstones',
    ]);

    db.close();
  });
});
