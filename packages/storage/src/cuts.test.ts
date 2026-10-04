import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CutNameTakenError, deleteCut, listCuts, saveCut, subscribeCuts } from './cuts';
import { openDatabase } from './database';
import { deletedItems } from './exchange';
import type { CutRecord, ShakespeerDatabase } from './schema';

const anchor = {
  start: { nodeId: 'ftln-0001', offset: 0 },
  end: { nodeId: 'ftln-0001', offset: 9 },
  quote: { exact: 'Boatswain', prefix: '', suffix: '!' },
  revision: 'sha256:0000000000000000',
};

function cut(overrides: Partial<CutRecord> = {}): CutRecord {
  return {
    id: crypto.randomUUID(),
    playId: 'the-tempest',
    versionId: 'folger',
    name: 'Study cut',
    origin: { kind: 'own' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    operations: [{ id: 'o1', type: 'hide', anchor }],
    ...overrides,
  };
}

describe('cuts repository', () => {
  let db: ShakespeerDatabase;

  beforeEach(async () => {
    db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  });

  afterEach(() => {
    db.close();
  });

  it('CUT-050: stores cuts per version, listed by name', async () => {
    await saveCut(db, cut({ name: 'Zed' }));
    await saveCut(db, cut({ name: 'Alpha' }));
    await saveCut(db, cut({ versionId: 'f1-1623' }));
    expect((await listCuts(db, 'the-tempest', 'folger')).map((c) => c.name)).toStrictEqual([
      'Alpha',
      'Zed',
    ]);
  });

  it('CUT-021: names are unique per version', async () => {
    await saveCut(db, cut({ name: 'Study cut' }));
    await expect(saveCut(db, cut({ name: ' Study cut ' }))).rejects.toThrow(CutNameTakenError);
    await expect(saveCut(db, cut({ versionId: 'f1-1623' }))).resolves.toBeDefined();
  });

  it('XCH-040/041: editing an imported cut marks it modified; deleting it leaves a tombstone', async () => {
    const origin = {
      kind: 'imported',
      collectionId: 'c1',
      sourceItemId: 's1',
      modified: false,
    } as const;
    const saved = await saveCut(db, cut({ origin }));
    expect(saved.origin).toMatchObject({ modified: true });
    await deleteCut(db, saved.id);
    expect(await listCuts(db, 'the-tempest', 'folger')).toStrictEqual([]);
    expect(await deletedItems(db, 'c1')).toStrictEqual(['s1']);
  });

  it('STO-004: notifies listeners of changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCuts(listener);
    const saved = await saveCut(db, cut());
    await deleteCut(db, saved.id);
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith({ playId: 'the-tempest', versionId: 'folger' });
  });
});
