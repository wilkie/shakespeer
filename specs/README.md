# Shakespeer specifications

These documents define what Shakespeer does. Code implements the specs; when behavior and spec
disagree, one of them is a bug. Behavior changes start as spec changes, reviewed like code.

## Layout

| Spec                                                     | Prefix | Covers                                                        |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| [glossary.md](glossary.md)                               | —      | Shared vocabulary. Every spec uses these terms exactly.       |
| **Behavior**                                             |        | What a reader sees and does                                   |
| [behavior/play-selection.md](behavior/play-selection.md) | SEL    | The entry page: choosing a play                               |
| [behavior/reader.md](behavior/reader.md)                 | RDR    | The play page: layout, top bar, scrolling, position, versions |
| [behavior/scene-map.md](behavior/scene-map.md)           | MAP    | The right-hand scene map and previous/next scene buttons      |
| [behavior/text-selection.md](behavior/text-selection.md) | SELX   | Selecting text and the selection menu                         |
| [behavior/side-panel.md](behavior/side-panel.md)         | PNL    | The notes panel: viewing, editing, saving, deleting           |
| [behavior/definitions.md](behavior/definitions.md)       | DEF    | Definitions of words and phrases                              |
| [behavior/annotations.md](behavior/annotations.md)       | ANN    | Highlights with notes, links and citations                    |
| [behavior/import-export.md](behavior/import-export.md)   | IOX    | Exporting and importing notes                                 |
| [behavior/attribution.md](behavior/attribution.md)       | ATR    | Showing sources and licenses                                  |
| [behavior/cuts.md](behavior/cuts.md)                     | CUT    | Cuts, text edits, added stage directions                      |
| [behavior/variants.md](behavior/variants.md)             | VAR    | Variant marks and comparing versions                          |
| **Data**                                                 |        | How the behavior is represented                               |
| [data/corpus.md](data/corpus.md)                         | CRP    | Plays, versions, text structure, IDs, alignment, sources      |
| [data/anchors.md](data/anchors.md)                       | ANC    | How notes point at text and survive corpus changes            |
| [data/storage.md](data/storage.md)                       | STO    | IndexedDB stores, records and the app's data API              |
| [data/exchange-format.md](data/exchange-format.md)       | XCH    | The export/import file format and import algorithm            |

## Conventions

- **Requirement IDs.** Each requirement has a stable ID such as `RDR-012`. IDs are never reused or
  renumbered; a removed requirement keeps its ID with the text `_Removed._` Tests cite the IDs
  they cover (`it('RDR-012: resumes at the last read line', …)`).
- **Keywords.** MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119: SHOULD means "do this
  unless there is a documented reason not to".
- **Cross-references.** Cite the ID with a link to its spec, e.g. "as in
  [ANC-004](data/anchors.md)".
  Data specs reference the behavior they serve; behavior specs reference data only where the
  reader can observe it (for example, the export file).
- **Status.** Each spec starts with a status line: `Draft` (under review), `Approved` (ready to
  build), or `Planned` (direction agreed, details pending). Only Approved specs are implemented.
- **Open questions** are listed at the end of each spec and must be resolved before it is
  Approved.
- **Least surprise.** Where a spec is silent, choose the behavior a reader would expect from
  common reading and note-taking apps, then add it to the spec.

## Scope of the first release

Three plays: _Hamlet_, _Troilus and Cressida_, _The Tempest_. Each is available as the Folger
edition and in the original printings (quartos and First Folio), with notes, definitions,
import/export, full phone support, and cuts and text edits ([CUT](behavior/cuts.md)).
