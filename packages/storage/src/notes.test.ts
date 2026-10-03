import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { openDatabase } from './database';
import {
  countNotes,
  deleteNote,
  getNote,
  listNotes,
  restoreSnapshot,
  saveNote,
  snapshotNotes,
  subscribeNotes,
  trackCreated,
  updateAnchor,
} from './notes';
import type { AnnotationRecord, DefinitionRecord, ShakespeerDatabase } from './schema';

const anchor = {
  start: { nodeId: 'ftln-0001', offset: 0 },
  end: { nodeId: 'ftln-0001', offset: 9 },
  quote: { exact: 'Boatswain', prefix: '', suffix: '!' },
  revision: 'sha256:0000000000000000',
};

function definition(overrides: Partial<DefinitionRecord> = {}): DefinitionRecord {
  return {
    id: crypto.randomUUID(),
    playId: 'the-tempest',
    versionId: 'folger',
    anchor,
    meaning: 'an officer on board a ship',
    origin: { kind: 'own' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function annotation(overrides: Partial<AnnotationRecord> = {}): AnnotationRecord {
  return {
    id: crypto.randomUUID(),
    playId: 'the-tempest',
    versionId: 'folger',
    anchor,
    color: 'yellow',
    notes: '',
    links: [],
    citations: [],
    origin: { kind: 'own' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const imported = {
  kind: 'imported',
  collectionId: 'c1',
  sourceItemId: 's1',
  modified: false,
} as const;

describe('notes repository', () => {
  let db: ShakespeerDatabase;

  beforeEach(async () => {
    db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  });

  afterEach(() => {
    db.close();
  });

  it('STO-012: lists notes by play version', async () => {
    const mine = await saveNote(db, 'definitions', definition());
    await saveNote(db, 'annotations', annotation({ versionId: 'f1-1623' }));
    await saveNote(db, 'annotations', annotation({ playId: 'hamlet' }));

    const notes = await listNotes(db, 'the-tempest', 'folger');
    expect(notes.definitions.map((d) => d.id)).toStrictEqual([mine.id]);
    expect(notes.annotations).toStrictEqual([]);
  });

  it('SEL-006: counts own and imported notes per version', async () => {
    await saveNote(db, 'definitions', definition());
    await saveNote(db, 'annotations', annotation());
    await db.put('annotations', annotation({ origin: imported }));
    await saveNote(db, 'annotations', annotation({ versionId: 'f1-1623' }));
    await saveNote(db, 'annotations', annotation({ playId: 'hamlet' }));

    expect(await countNotes(db, 'the-tempest')).toStrictEqual(
      new Map([
        ['folger', { own: 2, imported: 1 }],
        ['f1-1623', { own: 1, imported: 0 }],
      ]),
    );
  });

  it('DEF-024, ANN-031: saving an imported note marks it modified', async () => {
    const saved = await saveNote(
      db,
      'annotations',
      annotation({ origin: imported }),
      new Date('2026-02-02T00:00:00Z'),
    );

    expect(saved.origin).toStrictEqual({ ...imported, modified: true });
    expect(saved.updatedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('STO-014, XCH-041: deleting an imported note leaves a tombstone; own notes leave none', async () => {
    const own = await saveNote(db, 'definitions', definition());
    const theirs = annotation({ origin: imported });
    await db.put('annotations', theirs);

    await deleteNote(db, 'definitions', own.id);
    await deleteNote(db, 'annotations', theirs.id);

    await expect(getNote(db, 'annotations', theirs.id)).resolves.toBeUndefined();
    expect(await db.getAll('tombstones')).toStrictEqual([
      { collectionId: 'c1', sourceItemId: 's1' },
    ]);
  });

  it('PNL-023: restoring a snapshot reverts edits and removes notes created since', async () => {
    const existing = await saveNote(db, 'annotations', annotation({ notes: 'before' }));
    let snapshot = await snapshotNotes(db, 'the-tempest', 'folger', [
      { kind: 'annotations', id: existing.id },
    ]);
    await saveNote(db, 'annotations', { ...existing, notes: 'after' });
    const created = await saveNote(db, 'definitions', definition());
    snapshot = trackCreated(snapshot, 'definitions', created.id);

    await restoreSnapshot(db, snapshot);

    await expect(getNote(db, 'annotations', existing.id)).resolves.toMatchObject({
      notes: 'before',
    });
    await expect(getNote(db, 'definitions', created.id)).resolves.toBeUndefined();
  });

  it('ANC-031: storing a repaired anchor is not an edit', async () => {
    const theirs = annotation({ origin: imported });
    await db.put('annotations', theirs);
    const repaired = { ...anchor, revision: 'sha256:1111111111111111' };

    await updateAnchor(db, 'annotations', theirs.id, repaired);

    await expect(getNote(db, 'annotations', theirs.id)).resolves.toStrictEqual({
      ...theirs,
      anchor: repaired,
    });
  });

  it('STO-004: notifies subscribers of changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeNotes(listener);

    await saveNote(db, 'definitions', definition());
    unsubscribe();
    await saveNote(db, 'definitions', definition());

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ playId: 'the-tempest', versionId: 'folger' });
  });
});
