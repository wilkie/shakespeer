# Storage

Status: Draft

Everything the reader creates is stored locally in the browser with IndexedDB, through the
`@shakespeer/storage` package. There is no server.

## Database

- **STO-001** — The database is named `shakespeer`. Its schema changes only by appending
  migrations (`packages/storage/src/schema.ts`); a shipped migration is never edited.
- **STO-002** — On first creating a note, the app MUST request persistent storage
  (`navigator.storage.persist()`). If the browser refuses, the overflow menu MUST show a one-time
  notice that the browser may clear notes under storage pressure, and suggest exporting as a
  backup.
- **STO-003** — Multi-record changes (an import, a Cancel that reverts several notes) MUST happen
  in a single transaction, so a failure leaves nothing half-done.
- **STO-004** — Changes MUST be broadcast to other open tabs (`BroadcastChannel`), which refresh
  the affected notes, so two tabs never overwrite each other with stale data.

## Stores

All IDs are UUIDs from `crypto.randomUUID()`. Timestamps are ISO 8601 strings in UTC.

- **STO-010** — `definitions`: own and imported definitions (sourced definitions stay in the
  corpus files).

  ```ts
  interface DefinitionRecord {
    id: string;
    playId: string;
    versionId: string;
    anchor: TextAnchor; // ANC-002
    meaning: string;
    partOfSpeech?: PartOfSpeech; // DEF-002
    source?: string; // free text, e.g. "OED"
    origin: Origin; // STO-020
    createdAt: string;
    updatedAt: string;
  }
  ```

  A term is the group of definition records (plus sourced definitions) with equal anchors
  (ANC-010); terms are not stored separately.

- **STO-011** — `annotations`:

  ```ts
  interface AnnotationRecord {
    id: string;
    playId: string;
    versionId: string;
    anchor: TextAnchor;
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple'; // ANN-010
    notes: string; // Markdown, may be empty
    links: { url: string; label?: string }[];
    citations: Citation[]; // CSL-JSON item subset, ANN-004
    origin: Origin;
    createdAt: string;
    updatedAt: string;
  }
  ```

- **STO-012** — Both note stores MUST be indexed by `[playId, versionId]` (loading a version) and
  by `origin.collectionId` (collection updates).
- **STO-013** — `collections`: one record per imported collection: `id`, `playId`, `name`,
  `importedAt`, `updatedAt`, `fileName`. Unique index on `[playId, name]` (IOX-014).
- **STO-014** — `tombstones`: `[collectionId, sourceItemId]` pairs for imported notes the reader
  deleted, so updates do not bring them back (XCH-041).
- **STO-015** — `positions`: reading position per `[playId, versionId]`: `nodeId`, `updatedAt`
  (RDR-033).
- **STO-016** — `kv`: settings, with these keys: `reader.lastVersion.<playId>` (RDR-041),
  `map.showAnnotationMarks` (MAP-044), `annotations.lastColor` (ANN-011),
  `definitions.enabledSources` (DEF-012), `export.lastName.<playId>` (IOX-002).

## Origin

- **STO-020** — Each note records its origin:

  ```ts
  type Origin =
    | { kind: 'own' }
    | {
        kind: 'imported';
        collectionId: string; // STO-013
        sourceItemId: string; // the note's id in the imported file
        modified: boolean; // edited locally since last import (DEF-024, ANN-031)
        removedFromSource?: boolean; // kept after an update removed it (XCH-040)
      };
  ```

## Data API

- **STO-030** — The app MUST access notes only through a repository API in
  `@shakespeer/storage`, never through raw IndexedDB calls in components:
  - `listNotes(playId, versionId)` → definitions and annotations for a version;
  - `countNotes(playId)` → counts per version and origin (SEL-006, RDR-042);
  - `putDefinition`, `putAnnotation`, `deleteNote(id)` (records a tombstone for imported
    notes, STO-014);
  - `runEditSession()` → snapshot/restore for Cancel (PNL-023), restored in one transaction;
  - `exportCollection(...)`, `previewImport(file)`, `applyImport(preview, mode)` (XCH);
  - `subscribe(playId, versionId, listener)` → change notifications, including from other
    tabs (STO-004).
- **STO-031** — Corpus access goes through `@shakespeer/corpus`: `listPlays()`,
  `loadVersion(playId, versionId)`, `loadAlignment(...)`, `loadSourcedDefinitions(...)`,
  `getSources()`. The UI never imports corpus JSON directly.
