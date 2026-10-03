# Exchange format

Status: Draft

The file produced by export and accepted by import ([IOX](../behavior/import-export.md)).

## File

- **XCH-001** — The file is a ZIP archive containing `shakespeer-notes.json` at its root. Other
  entries are ignored (reserved for future use, e.g. cuts, CUT-006).
- **XCH-002** — `shakespeer-notes.json` is UTF-8 JSON with this shape:

  ```ts
  interface NotesFile {
    format: 'shakespeer-notes';
    formatVersion: 1;
    exportedAt: string; // ISO 8601
    generator: { app: 'shakespeer'; version: string };
    collection: { name: string };
    play: { id: string };
    versions: Record<string, { revision: string }>; // corpus revision per version, CRP-025
    definitions: {
      id: string; // stable across exports from the same device
      versionId: string;
      anchor: TextAnchor; // ANC-002
      meaning: string;
      partOfSpeech?: PartOfSpeech;
      source?: string;
      createdAt: string;
      updatedAt: string;
    }[];
    annotations: {
      id: string;
      versionId: string;
      anchor: TextAnchor;
      color: HighlightColor;
      notes: string;
      links: { url: string; label?: string }[];
      citations: Citation[]; // CSL-JSON item subset
      createdAt: string;
      updatedAt: string;
    }[];
  }
  ```

- **XCH-003** — Note `id`s in the file are the exporting device's record IDs, so a teacher who
  edits and re-exports produces the same IDs for the same notes; that is what lets an update
  (XCH-040) match notes.
- **XCH-004** — A JSON Schema for the file MUST be published in the repository
  (`packages/storage/schema/notes-file.v1.json`) and used for validation.
- **XCH-010** — Format changes that older apps cannot read increase `formatVersion`. The app MUST
  read every earlier `formatVersion` it has ever written.

## Validation

- **XCH-030** — Before writing anything, import MUST check, rejecting the file with a
  plain-language reason on failure:
  - the archive is a ZIP, at most 10 MB, and `shakespeer-notes.json` inflates to at most 50 MB
    (inflation stops at the limit, guarding against zip bombs);
  - the JSON parses and matches the schema; `formatVersion` is supported (a newer one says
    "This file was made by a newer version of Shakespeer");
  - the play exists in the corpus.
    Then, item by item (skipped items are counted in the summary, IOX-012): version IDs must exist;
    unknown colors become yellow; link URLs other than http/https are dropped; strings are limited
    in length (meaning 5,000 characters, notes 100,000).

## Applying an import

- **XCH-039** — A **new collection** import creates a `collections` record and adds every item
  as a new note with a fresh local ID and origin `imported` (`sourceItemId` = the item's file
  ID, `modified: false`).
- **XCH-040** — An **update** of an existing collection (same play and name, IOX-014) MUST, in
  one transaction:
  1. for each incoming item: if a tombstone exists for it, skip it; if a local note has its
     `sourceItemId`, replace that note's content and anchor unless `modified` is true (then keep
     the local note); otherwise add it;
  2. for each local note of the collection whose `sourceItemId` is not in the file: delete it
     unless `modified` is true (then keep it with `removedFromSource: true`);
  3. update the collection's `updatedAt` and `fileName`;
  4. report counts: added, updated, removed, kept because changed locally, previously deleted.
- **XCH-041** — Deleting an imported note records a tombstone (STO-014), so updates do not
  restore it.
- **XCH-042** — Own notes are never touched by an import.
