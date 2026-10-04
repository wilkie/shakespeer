import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { strToU8, zipSync } from 'fflate';
import { z } from 'zod';

import { openDatabase } from './database';
import {
  applyImport,
  checkItems,
  CollectionNameTakenError,
  deletedItems,
  exportCuts,
  exportFileName,
  exportNotes,
  findCollection,
  listCollections,
  renameCollection,
} from './exchange';
import { deleteCut, listCuts, saveCut } from './cuts';
import { deleteNote, listNotes, saveNote } from './notes';
import {
  CutsFileSchema,
  NotesFileError,
  NotesFileSchema,
  readArchive,
  readNotesArchive,
  writeNotesArchive,
  type CutsFile,
  type NotesFile,
} from './notes-file';
import type { AnnotationRecord, DefinitionRecord, ShakespeerDatabase } from './schema';

const anchor = {
  start: { nodeId: 'ftln-0001', offset: 0 },
  end: { nodeId: 'ftln-0001', offset: 9 },
  quote: { exact: 'Boatswain', prefix: '', suffix: '!' },
  revision: 'sha256:0000000000000000',
};
const VERSIONS = new Set(['folger', 'f1-1623']);
const NOW = new Date('2026-10-03T12:00:00.000Z');

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
    color: 'green',
    notes: 'The first word.',
    links: [{ url: 'https://example.org/' }],
    citations: [{ type: 'book', title: 'A Shakespeare Lexicon' }],
    origin: { kind: 'own' },
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function file(overrides: Partial<NotesFile> = {}): NotesFile {
  return {
    format: 'shakespeer-notes',
    formatVersion: 1,
    exportedAt: NOW.toISOString(),
    generator: { app: 'shakespeer', version: 'test' },
    collection: { name: 'Act 1 notes' },
    play: { id: 'the-tempest' },
    versions: { folger: { revision: anchor.revision } },
    definitions: [
      { id: 'd1', versionId: 'folger', anchor, meaning: 'officer', createdAt: '', updatedAt: '' },
      {
        id: 'd2',
        versionId: 'folger',
        anchor,
        meaning: 'deck officer',
        createdAt: '',
        updatedAt: '',
      },
    ],
    annotations: [
      {
        id: 'a1',
        versionId: 'folger',
        anchor,
        color: 'blue',
        notes: 'Storm',
        links: [],
        citations: [],
        createdAt: '',
        updatedAt: '',
      },
    ],
    ...overrides,
  };
}

const zip = (entries: Record<string, string>) =>
  zipSync(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, strToU8(v)])));

function cutsFile(overrides: Partial<CutsFile> = {}): CutsFile {
  return {
    format: 'shakespeer-cuts',
    formatVersion: 1,
    play: { id: 'the-tempest' },
    cuts: [
      {
        id: 'k1',
        versionId: 'folger',
        name: 'Study cut',
        createdAt: '',
        updatedAt: '',
        operations: [{ id: 'o1', type: 'hide', anchor }],
      },
    ],
    ...overrides,
  };
}

describe('notes exchange file', () => {
  it('XCH-001/002: a written archive reads back unchanged', () => {
    const original = file();
    expect(readNotesArchive(writeNotesArchive(original))).toStrictEqual(original);
  });

  it('XCH-004/005: the published JSON Schemas match the schema definitions', () => {
    const published = (name: string): unknown =>
      JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), 'utf8'));
    expect(published('notes-file.v1.json')).toStrictEqual(
      z.toJSONSchema(NotesFileSchema, { io: 'input' }),
    );
    expect(published('cuts-file.v1.json')).toStrictEqual(
      z.toJSONSchema(CutsFileSchema, { io: 'input' }),
    );
  });

  it('CUT-052: cuts are written beside the notes and read back', () => {
    const cuts = cutsFile();
    expect(readArchive(writeNotesArchive(file(), cuts))).toStrictEqual({ notes: file(), cuts });
    expect(readArchive(writeNotesArchive(file())).cuts).toBeUndefined();
  });

  it('XCH-001: ignores other entries in the archive', () => {
    const archive = zip({ 'cuts.json': '{}', 'shakespeer-notes.json': JSON.stringify(file()) });
    expect(readNotesArchive(archive).collection.name).toBe('Act 1 notes');
  });

  it.each([
    ['not a ZIP file', strToU8('hello'), /not a ZIP file/],
    [
      'a ZIP without the notes',
      zip({ 'other.json': '{}' }),
      /does not contain shakespeer-notes.json/,
    ],
    ['invalid JSON', zip({ 'shakespeer-notes.json': '{' }), /not valid JSON/],
    [
      'another kind of file',
      zip({ 'shakespeer-notes.json': '{"format":"x"}' }),
      /not a Shakespeer notes file/,
    ],
    [
      'a newer format',
      zip({ 'shakespeer-notes.json': JSON.stringify({ ...file(), formatVersion: 2 }) }),
      /newer version of Shakespeer/,
    ],
    [
      'a file missing fields',
      zip({ 'shakespeer-notes.json': JSON.stringify({ ...file(), collection: {} }) }),
      /incomplete or damaged \(at collection.name\)/,
    ],
  ])('XCH-030: rejects %s with a plain reason', (_, archive, reason) => {
    expect(() => readNotesArchive(archive)).toThrow(NotesFileError);
    expect(() => readNotesArchive(archive)).toThrow(reason);
  });

  it('XCH-030: stops inflating past 50 MB', () => {
    const archive = zipSync({ 'shakespeer-notes.json': new Uint8Array(51 * 1024 * 1024) });
    expect(archive.byteLength).toBeLessThan(1024 * 1024);
    expect(() => readNotesArchive(archive)).toThrow(/larger than 50 MB/);
  });

  it('XCH-030: skips unknown versions and overlong text, fixes colors and links', () => {
    const checked = checkItems(
      file({
        definitions: [
          { id: 'd1', versionId: 'q9', anchor, meaning: 'x', createdAt: '', updatedAt: '' },
          {
            id: 'd2',
            versionId: 'folger',
            anchor,
            meaning: 'x'.repeat(5001),
            createdAt: '',
            updatedAt: '',
          },
          { id: 'd3', versionId: 'folger', anchor, meaning: 'kept', createdAt: '', updatedAt: '' },
        ],
        annotations: [
          {
            id: 'a1',
            versionId: 'folger',
            anchor,
            color: 'chartreuse',
            notes: '',
            links: [{ url: 'javascript:alert(1)' }, { url: 'https://example.org/' }],
            citations: [{ type: 'thesis', title: 'T' }],
            createdAt: '',
            updatedAt: '',
          },
        ],
      }),
      VERSIONS,
    );
    expect(checked.skipped).toStrictEqual({ unknownVersion: 1, tooLong: 1 });
    expect(checked.definitions.map((d) => d.id)).toStrictEqual(['d3']);
    expect(checked.annotations[0]).toMatchObject({
      color: 'yellow',
      links: [{ url: 'https://example.org/' }],
      citations: [{ type: 'document', title: 'T' }],
    });
  });
});

describe('export and import', () => {
  let db: ShakespeerDatabase;

  beforeEach(async () => {
    db = await openDatabase({ name: `test-${crypto.randomUUID()}` });
  });

  afterEach(() => {
    db.close();
  });

  const importFile = (notes: NotesFile, target: Parameters<typeof applyImport>[3]) =>
    applyImport(db, 'the-tempest', checkItems(notes, VERSIONS), target, 'notes.zip', NOW);

  it('IOX-003: exports own notes of every version; imported ones only when asked', async () => {
    const own = await saveNote(db, 'definitions', definition());
    const original = await saveNote(db, 'annotations', annotation({ versionId: 'f1-1623' }));
    await saveNote(db, 'definitions', definition({ playId: 'hamlet' }));
    const theirs = await saveNote(
      db,
      'definitions',
      definition({
        origin: { kind: 'imported', collectionId: 'c', sourceItemId: 's', modified: false },
      }),
    );

    const mine = await exportNotes(db, {
      playId: 'the-tempest',
      collectionName: ' Mine ',
      includeImported: false,
      appVersion: '1.0',
      now: NOW,
    });
    expect(mine.collection.name).toBe('Mine');
    expect(mine.definitions.map((d) => d.id)).toStrictEqual([own.id]);
    expect(mine.annotations.map((a) => a.id)).toStrictEqual([original.id]);
    expect(mine.versions).toStrictEqual({
      folger: { revision: anchor.revision },
      'f1-1623': { revision: anchor.revision },
    });
    expect(NotesFileSchema.parse(mine)).toStrictEqual(mine);

    const all = await exportNotes(db, {
      playId: 'the-tempest',
      collectionName: 'All',
      includeImported: true,
      appVersion: '1.0',
      now: NOW,
    });
    expect(all.definitions.map((d) => d.id).sort()).toStrictEqual([own.id, theirs.id].sort());
  });

  it('IOX-004: names the file by play, collection and date', () => {
    expect(exportFileName('the-tempest', 'Mrs. Ó Brien’s Class!', NOW)).toBe(
      'shakespeer-the-tempest-mrs-o-brien-s-class-2026-10-03.zip',
    );
  });

  it('XCH-039: a new collection adds every item as an unmodified imported note', async () => {
    const own = await saveNote(db, 'definitions', definition());
    const report = await importFile(file(), { mode: 'new', collectionName: 'Act 1 notes' });

    expect(report).toMatchObject({ added: 3, updated: 0, removed: 0, keptModified: 0 });
    const collection = await findCollection(db, 'the-tempest', 'Act 1 notes');
    expect(collection).toMatchObject({ id: report.collectionId, fileName: 'notes.zip' });
    const notes = await listNotes(db, 'the-tempest', 'folger');
    const imported = notes.definitions.filter((d) => d.origin.kind === 'imported');
    expect(imported.map((d) => d.origin)).toContainEqual({
      kind: 'imported',
      collectionId: report.collectionId,
      sourceItemId: 'd1',
      modified: false,
    });
    expect(imported.every((d) => d.id !== 'd1' && d.id !== 'd2')).toBe(true);
    // XCH-042: own notes are untouched.
    expect(notes.definitions).toContainEqual(own);
  });

  it('XCH-040/041: an update keeps local changes and deletions, and reports what it did', async () => {
    const { collectionId } = await importFile(
      file({
        definitions: [
          ...file().definitions,
          { id: 'd3', versionId: 'folger', anchor, meaning: 'gone', createdAt: '', updatedAt: '' },
          {
            id: 'd4',
            versionId: 'folger',
            anchor,
            meaning: 'gone but edited',
            createdAt: '',
            updatedAt: '',
          },
        ],
      }),
      { mode: 'new', collectionName: 'Act 1 notes' },
    );
    const local = async () =>
      new Map(
        (await listNotes(db, 'the-tempest', 'folger')).definitions.map((d) => [
          d.origin.kind === 'imported' ? d.origin.sourceItemId : d.id,
          d,
        ]),
      );
    const before = await local();
    // The reader edits d2 and d4, and deletes the annotation.
    for (const id of ['d2', 'd4']) {
      const record = before.get(id);
      if (record) {
        await saveNote(db, 'definitions', { ...record, meaning: `${record.meaning} (mine)` });
      }
    }
    const [annotationRecord] = (await listNotes(db, 'the-tempest', 'folger')).annotations;
    await deleteNote(db, 'annotations', annotationRecord?.id ?? '');

    const updated = file({
      definitions: [
        {
          id: 'd1',
          versionId: 'folger',
          anchor,
          meaning: 'officer, revised',
          createdAt: '',
          updatedAt: '',
        },
        { id: 'd2', versionId: 'folger', anchor, meaning: 'theirs', createdAt: '', updatedAt: '' },
        { id: 'd5', versionId: 'folger', anchor, meaning: 'new', createdAt: '', updatedAt: '' },
      ],
    });
    const report = await importFile(updated, { mode: 'update', collectionId });

    expect(report).toStrictEqual({
      collectionId,
      added: 1,
      updated: 1,
      removed: 1,
      keptModified: 2,
      previouslyDeleted: 1,
      restored: 0,
      cuts: {
        added: 0,
        updated: 0,
        removed: 0,
        keptModified: 0,
        previouslyDeleted: 0,
        restored: 0,
      },
    });
    const after = await local();
    expect(after.get('d1')?.meaning).toBe('officer, revised');
    expect(after.get('d1')?.id).toBe(before.get('d1')?.id);
    expect(after.get('d2')?.meaning).toBe('deck officer (mine)');
    expect(after.has('d3')).toBe(false);
    expect(after.get('d4')?.origin).toMatchObject({ modified: true, removedFromSource: true });
    expect(after.get('d5')?.meaning).toBe('new');
    expect((await listNotes(db, 'the-tempest', 'folger')).annotations).toStrictEqual([]);
  });

  it('IOX-014a: an update can bring back notes the reader deleted', async () => {
    const { collectionId } = await importFile(file(), {
      mode: 'new',
      collectionName: 'Act 1 notes',
    });
    const [deleted] = (await listNotes(db, 'the-tempest', 'folger')).definitions;
    await deleteNote(db, 'definitions', deleted?.id ?? '');
    expect(await deletedItems(db, collectionId)).toHaveLength(1);

    const report = await importFile(file(), { mode: 'update', collectionId, restoreDeleted: true });

    expect(report).toMatchObject({ restored: 1, previouslyDeleted: 0, added: 0 });
    expect(await deletedItems(db, collectionId)).toStrictEqual([]);
    expect((await listNotes(db, 'the-tempest', 'folger')).definitions).toHaveLength(2);
  });

  it('IOX-020/021: lists collections with counts and renames them, names unique per play', async () => {
    const first = await importFile(file(), { mode: 'new', collectionName: 'First' });
    await importFile(file(), { mode: 'new', collectionName: 'Second' });

    expect(
      (await listCollections(db, 'the-tempest')).map((c) => [c.name, c.definitions, c.annotations]),
    ).toStrictEqual([
      ['First', 2, 1],
      ['Second', 2, 1],
    ]);
    await expect(renameCollection(db, first.collectionId, 'Second')).rejects.toThrow(
      CollectionNameTakenError,
    );
    await renameCollection(db, first.collectionId, 'Renamed');
    expect((await findCollection(db, 'the-tempest', 'Renamed'))?.id).toBe(first.collectionId);
  });

  it('CUT-052: exports own cuts; imports them as a collection’s, updating like notes', async () => {
    const now = '2026-01-01T00:00:00.000Z';
    await saveCut(db, {
      id: 'mine',
      playId: 'the-tempest',
      versionId: 'folger',
      name: 'Study cut',
      origin: { kind: 'own' },
      createdAt: now,
      updatedAt: now,
      operations: [],
    });
    const exported = await exportCuts(db, { playId: 'the-tempest', includeImported: false });
    expect(exported.cuts.map((c) => c.id)).toStrictEqual(['mine']);

    const notes = file({ definitions: [], annotations: [] });
    const importWithCuts = (cuts: CutsFile, target: Parameters<typeof applyImport>[3]) =>
      applyImport(db, 'the-tempest', checkItems(notes, VERSIONS, cuts), target, 'n.zip', NOW);
    const first = await importWithCuts(cutsFile(), { mode: 'new', collectionName: 'Class' });
    expect(first.cuts.added).toBe(1);
    // The reader already has a cut of that name: the imported one is named after its collection.
    const names = async () => (await listCuts(db, 'the-tempest', 'folger')).map((c) => c.name);
    expect(await names()).toStrictEqual(['Study cut', 'Study cut (Class)']);

    const update = await importWithCuts(
      cutsFile({
        cuts: [
          {
            id: 'k1',
            versionId: 'folger',
            name: 'Study cut',
            createdAt: '',
            updatedAt: '',
            operations: [],
          },
        ],
      }),
      { mode: 'update', collectionId: first.collectionId },
    );
    expect(update.cuts.updated).toBe(1);
    expect(await names()).toStrictEqual(['Study cut', 'Study cut (Class)']);

    const imported = (await listCuts(db, 'the-tempest', 'folger')).find((c) => c.id !== 'mine');
    await deleteCut(db, imported?.id ?? '');
    const again = await importWithCuts(cutsFile(), {
      mode: 'update',
      collectionId: first.collectionId,
    });
    expect(again.cuts.previouslyDeleted).toBe(1);
    expect((await listCollections(db, 'the-tempest'))[0]?.cuts).toBe(0);
  });
});
