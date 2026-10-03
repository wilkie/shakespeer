# Import and export

Status: Approved

Readers exchange notes as files: a teacher exports a collection, students import it. Imported
notes stay distinguishable from a reader's own, and re-importing an updated file updates them.

## Export

- **IOX-001** — The reader's overflow menu MUST offer **Export notes…** for the current play.
- **IOX-002** — Export MUST ask for a **collection name** (required; prefilled with the name
  last used for this play, or "<Play title> notes"), and offer a checkbox **Include imported
  notes** (off by default).
- **IOX-003** — Export MUST include every own definition and annotation for the play, across
  all of its versions (each note records its version). With the checkbox, it also includes
  imported notes. Sourced definitions are never exported.
- **IOX-004** — Export MUST download a `.zip` file containing the notes as JSON in the format of
  [XCH](../data/exchange-format.md). The file name is
  `shakespeer-<playId>-<collection-name-slug>-<YYYY-MM-DD>.zip`.
- **IOX-005** — Export MUST work offline and entirely in the browser.

## Import

- **IOX-010** — The reader's overflow menu and the play selection page MUST offer **Import
  notes…**, accepting a `.zip` file chosen from a file picker or dropped on the page.
- **IOX-011** — The file MUST be validated before anything is written (XCH-030). An invalid file
  shows an error explaining the problem in plain language and changes nothing.
- **IOX-012** — Before importing, a summary MUST show: the collection name, the play, and counts
  of definitions and annotations per version. Import happens only on confirmation.
- **IOX-013** — If the file's play differs from the open play, the summary says so and importing
  opens that play afterwards.
- **IOX-014** — If a collection with the same name is already imported for that play, the
  summary MUST say so and offer **Update "<name>"** (the default) or **Import as a new
  collection** (which asks for a different name).
- **IOX-015** — Notes are matched by collection name (per play) and note ID; local edits are
  detected by each imported note's locally-modified flag (STO-020). An update MUST follow XCH-040 and report what it did: added, updated, removed,
  and kept because you changed them locally.
- **IOX-016** — Imported notes MUST be shown with their collection name (PNL-011) and are fully
  editable (DEF-022, ANN-031).
- **IOX-017** — Notes whose anchors cannot be resolved in the current corpus (ANC-030) MUST
  still be imported and are listed under "Unattached notes" (ANC-032); the summary reports how
  many.

## Managing collections

- **IOX-020** — The overflow menu MUST offer **Imported collections…**, listing each imported
  collection for the play with its name, import date, and note counts.
- **IOX-021** — Each collection MAY be renamed. _Later:_ **Remove collection** (deletes its
  unmodified notes after confirmation, the "clear imported" feature).

## Open questions

1. Tombstones (XCH-041) keep deleted imported notes from returning on an update. Each is two
   IDs, removed when its collection is removed. Should **Imported collections…** also offer
   **Restore deleted notes** for a collection (clearing its tombstones so the next update brings
   them back)? Proposed: yes, it is cheap and makes the behavior reversible.
