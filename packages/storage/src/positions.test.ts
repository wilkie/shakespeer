import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { openDatabase } from './database';
import { getPosition, savePosition } from './positions';
import type { ShakespeerDatabase } from './schema';

describe('reading positions', () => {
  let db: ShakespeerDatabase;

  beforeEach(async () => {
    db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  });

  afterEach(() => {
    db.close();
  });

  it('STO-015: stores one position per play version', async () => {
    await savePosition(db, 'hamlet', 'folger', 'ftln-0001', new Date('2026-01-01T00:00:00Z'));
    await savePosition(db, 'hamlet', 'folger', 'ftln-0420', new Date('2026-01-02T00:00:00Z'));
    await savePosition(db, 'hamlet', 'f1-1623', 'ham-f1-00010');

    await expect(getPosition(db, 'hamlet', 'folger')).resolves.toStrictEqual({
      playId: 'hamlet',
      versionId: 'folger',
      nodeId: 'ftln-0420',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    await expect(getPosition(db, 'hamlet', 'f1-1623')).resolves.toMatchObject({
      nodeId: 'ham-f1-00010',
    });
    await expect(getPosition(db, 'the-tempest', 'folger')).resolves.toBeUndefined();
  });
});
